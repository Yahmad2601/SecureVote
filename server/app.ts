import express, { type NextFunction, type Request, type Response, type Express } from "express";
import { type Server } from "http";
import { registerRoutes } from "./routes";
import { log, serveStatic, setupVite } from "./vite";

export type AppMode = "development" | "production";

export interface CreateAppResult {
  app: Express;
  server: Server;
}

export async function createApp(mode: AppMode = (process.env.NODE_ENV === "production" ? "production" : "development")): Promise<CreateAppResult> {
  const app = express();

  app.set("env", mode);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json.bind(res);
    res.json = ((bodyJson, ...args) => {
      capturedJsonResponse = bodyJson;
      return originalResJson(bodyJson, ...args);
    }) as typeof res.json;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (mode === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return { app, server };
}
