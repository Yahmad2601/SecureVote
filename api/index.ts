import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Express, Request, Response } from "express";
import type { AppMode, CreateAppResult } from "../server/app";

type CreateApp = (mode?: AppMode) => Promise<CreateAppResult>;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

const searchRoots = deriveSearchRoots(moduleDirectory);

const distCandidates = buildCandidatePaths(
  ["dist/server/app.js", "dist/server/app.mjs", "dist/server/app.cjs"],
  searchRoots,
);

const sourceCandidates = buildCandidatePaths(
  ["server/app.js", "server/app.mjs", "server/app.cjs"],
  searchRoots,
);

const candidatePaths =
  process.env.NODE_ENV === "production"
    ? [...distCandidates, ...sourceCandidates]
    : [...sourceCandidates, ...distCandidates];

let createAppPromise: Promise<CreateApp> | undefined;

async function loadCreateApp(): Promise<CreateApp> {
  if (!createAppPromise) {
    createAppPromise = (async () => {
      const attemptedPaths: string[] = [];
      const existingCandidates: string[] = [];

      for (const candidate of candidatePaths) {
        attemptedPaths.push(candidate);

        if (!(await fileExists(candidate))) {
          continue;
        }

        existingCandidates.push(candidate);

        const candidateUrl = pathToFileURL(candidate).href;

        const moduleExports = await import(candidateUrl);
        const resolved = extractCreateApp(moduleExports);

        if (resolved) {
          console.info(`Loaded createApp from ${candidate}`);
          return resolved;
        }

        console.warn(
          `Found module at ${candidate} but it did not export a createApp factory.`,
        );
      }

      const messageLines = [
        "Unable to locate createApp implementation.",
        `Checked paths: ${attemptedPaths.join(", ")}`,
      ];

      if (existingCandidates.length > 0) {
        messageLines.push(
          `Modules existed at: ${existingCandidates.join(", ")} but did not expose a compatible createApp export.`,
        );
      }

      messageLines.push(`Search roots: ${searchRoots.join(", ")}`);

      throw new Error(messageLines.join("\n"));
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildCandidatePaths(relativePaths: string[], roots: string[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    for (const relative of relativePaths) {
      const candidate = path.resolve(root, relative);
      if (seen.has(candidate)) {
        continue;
      }

      seen.add(candidate);
      results.push(candidate);
    }
  }

  return results;
}

function deriveSearchRoots(start: string): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();

  let current: string | undefined = start;

  for (let index = 0; index < 5 && current; index += 1) {
    if (!seen.has(current)) {
      roots.push(current);
      seen.add(current);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  const additionalRoots = [process.cwd(), process.env.LAMBDA_TASK_ROOT].filter(
    (value): value is string => Boolean(value),
  );

  for (const root of additionalRoots) {
    if (!seen.has(root)) {
      roots.push(root);
      seen.add(root);
    }
  }

  return roots;
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
