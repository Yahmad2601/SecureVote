import type { Express, Request, Response } from "express";

type CreateApp = (mode: "development" | "production") => Promise<{ app: Express }>;

let appPromise: Promise<Express> | undefined;
let createAppPromise: Promise<CreateApp> | undefined;

function isIgnorableModuleError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };

  if (
    maybeError.code === "ERR_MODULE_NOT_FOUND" ||
    maybeError.code === "MODULE_NOT_FOUND" ||
    maybeError.code === "ERR_UNKNOWN_FILE_EXTENSION"
  ) {
    return true;
  }

  if (typeof maybeError.message === "string" && maybeError.message.includes("Cannot find module")) {
    return true;
  }

  return false;
}

async function loadCreateApp(): Promise<CreateApp> {
  if (!createAppPromise) {
    createAppPromise = (async () => {
      const isProduction = process.env.NODE_ENV === "production";
      const candidates = isProduction
        ? ["../dist/server/app.js", "../server/app.js", "../server/app.ts", "../server/app"]
        : ["../server/app.ts", "../server/app.js", "../server/app", "../dist/server/app.js"];

      for (const specifier of candidates) {
        try {
          const moduleUrl = new URL(specifier, import.meta.url);
          const module = (await import(moduleUrl.href)) as { createApp?: CreateApp };

          if (typeof module.createApp === "function") {
            return module.createApp;
          }
        } catch (error) {
          if (isIgnorableModuleError(error)) {
            continue;
          }

          throw error;
        }
      }

      throw new Error("Unable to locate createApp implementation.");
    })();
  }

  return createAppPromise;
}

async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      const createApp = await loadCreateApp();
      const { app } = await createApp("production");

      return app;
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
    console.error(error);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
}
