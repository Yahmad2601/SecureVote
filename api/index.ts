import type { Express, Request, Response } from "express";

type CreateApp = (typeof import("../server/app"))["createApp"];

let appPromise: Promise<Express> | undefined;

async function loadCreateApp(): Promise<CreateApp> {
  try {
    const module = (await import("../dist/server/app.js")) as { createApp: CreateApp };
    return module.createApp;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    const module = (await import("../server/app.ts")) as { createApp: CreateApp };
    return module.createApp;
  }
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
