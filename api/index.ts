import type { Express, Request, Response } from "express";
import { createApp, type AppMode } from "../server/app";

let appPromise: Promise<Express> | undefined;

function resolveMode(): AppMode {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

async function initializeApp(): Promise<Express> {
  try {
    const { app } = await createApp(resolveMode());
    return app;
  } catch (error) {
    appPromise = undefined;
    throw error;
  }
}

async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = initializeApp();
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
