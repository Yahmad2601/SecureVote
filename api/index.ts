import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Express, Request, Response } from "express";

type CreateApp = (mode: "development" | "production") => Promise<{ app: Express }>;

let appPromise: Promise<Express> | undefined;
let createAppPromise: Promise<CreateApp> | undefined;

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function buildCandidatePaths(isProduction: boolean): string[] {
  const searchRoots = new Set<string>();

  let currentDir: string | undefined = moduleDirectory;
  for (let depth = 0; depth < 4 && currentDir; depth += 1) {
    searchRoots.add(currentDir);
    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) {
      break;
    }
    currentDir = nextDir;
  }

  searchRoots.add(process.cwd());
  searchRoots.add(path.resolve(process.cwd(), "api"));
  searchRoots.add(path.resolve(process.cwd(), ".."));

  const distFiles = [
    "dist/server/app.js",
    "dist/server/app.mjs",
    "dist/server/app.cjs",
  ];
  const sourceFiles = [
    "server/app.ts",
    "server/app.js",
    "server/app.mjs",
    "server/app.cjs",
  ];

  const priorityList = isProduction ? [...distFiles, ...sourceFiles] : [...sourceFiles, ...distFiles];

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const relativePath of priorityList) {
    for (const root of searchRoots) {
      const candidate = path.resolve(root, relativePath);
      if (!seen.has(candidate)) {
        seen.add(candidate);
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function resolveCreateAppExport(candidateModule: unknown): CreateApp | undefined {
  if (!candidateModule || typeof candidateModule !== "object") {
    return undefined;
  }

  const moduleRecord = candidateModule as Record<string, unknown>;

  const directExport = moduleRecord.createApp;
  if (typeof directExport === "function") {
    return directExport as CreateApp;
  }

  const defaultExport = moduleRecord.default;

  if (typeof defaultExport === "function") {
    return defaultExport as CreateApp;
  }

  if (defaultExport && typeof defaultExport === "object") {
    const nestedCreateApp = (defaultExport as Record<string, unknown>).createApp;
    if (typeof nestedCreateApp === "function") {
      return nestedCreateApp as CreateApp;
    }
  }

  return undefined;
}

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
      const candidates = buildCandidatePaths(isProduction);

      for (const candidatePath of candidates) {
        const hasExtension = path.extname(candidatePath) !== "";
        if (hasExtension && !existsSync(candidatePath)) {
          continue;
        }

        try {
          const moduleUrl = pathToFileURL(candidatePath);
          const importedModule = await import(moduleUrl.href);
          const resolvedCreateApp = resolveCreateAppExport(importedModule);

          if (resolvedCreateApp) {
            return resolvedCreateApp;
          }
        } catch (error) {
          if (isIgnorableModuleError(error)) {
            continue;
          }

          throw error;
        }
      }

      throw new Error(
        `Unable to locate createApp implementation. Checked paths: ${candidates.join(", ")}`,
      );
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
