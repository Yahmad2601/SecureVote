import type { Express, Request, Response } from "express";
import type { AppMode, CreateAppResult } from "../server/app";

type CreateApp = (mode?: AppMode) => Promise<CreateAppResult>;

const distCandidates = [
  "../dist/server/app.js",
  "../dist/server/app.mjs",
  "../dist/server/app.cjs",
];

const sourceCandidates = [
  "../server/app.js",
  "../server/app.mjs",
  "../server/app.cjs",
];

const candidatePaths =
  process.env.NODE_ENV === "production"
    ? [...distCandidates, ...sourceCandidates]
    : [...sourceCandidates, ...distCandidates];

let createAppPromise: Promise<CreateApp> | undefined;

async function loadCreateApp(): Promise<CreateApp> {
  if (!createAppPromise) {
    createAppPromise = (async () => {
      const triedPaths: string[] = [];

      for (const candidate of candidatePaths) {
        const candidateUrl = new URL(candidate, import.meta.url);
        triedPaths.push(candidateUrl.pathname);

        try {
          const moduleExports = await import(candidateUrl.href);
          const resolved = extractCreateApp(moduleExports);

          if (resolved) {
            console.info(`Loaded createApp from ${candidateUrl.pathname}`);
            return resolved;
          }
        } catch (error) {
          if (isModuleNotFoundError(error, candidateUrl.pathname)) {
            continue;
          }

          throw error;
        }
      }

      throw new Error(
        `Unable to locate createApp implementation. Checked paths: ${triedPaths.join(", ")}`,
      );
    })().catch((error) => {
      createAppPromise = undefined;
      throw error;
    });
  }

  return createAppPromise;
}

function extractCreateApp(moduleExports: unknown): CreateApp | undefined {
  if (!moduleExports || typeof moduleExports !== "object") {
    return undefined;
  }

  const exports = moduleExports as Record<string, unknown>;

  const direct = exports.createApp;
  if (typeof direct === "function") {
    return direct as CreateApp;
  }

  const defaultExport = exports.default;
  if (typeof defaultExport === "function") {
    return defaultExport as CreateApp;
  }

  if (
    defaultExport &&
    typeof defaultExport === "object" &&
    typeof (defaultExport as Record<string, unknown>).createApp === "function"
  ) {
    return (defaultExport as Record<string, unknown>).createApp as CreateApp;
  }

  return undefined;
}

function isModuleNotFoundError(error: unknown, attemptedPath: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const normalize = (value: string) => value.replace(/\\/g, "/");

  const attemptedNormalized = normalize(attemptedPath);

  if ("code" in error && typeof (error as { code?: unknown }).code === "string") {
    const code = (error as { code: string }).code;
    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      if (error instanceof Error) {
        return normalize(error.message).includes(attemptedNormalized);
      }

      return true;
    }
  }

  if (error instanceof Error) {
    const message = normalize(error.message);
    return /Cannot find module/i.test(message) && message.includes(attemptedNormalized);
  }

  return false;
}

let appPromise: Promise<Express> | undefined;

async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const createApp = await loadCreateApp();
        const { app } = await createApp("production");
        return app;
      } catch (error) {
        appPromise = undefined;
        throw error;
      }
    })();
  }

  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();

    await new Promise<void>((resolve, reject) => {
      app(req as any, res as any, (err?: unknown) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  } catch (error) {
    console.error("Failed to handle request", error);

    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
}
