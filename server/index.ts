import express, { type Request, Response, NextFunction } from "express";
import http from "http"; // Import the 'http' module
import { registerRoutes } from "./routes.js";
import { serveStatic, log } from "./vite.js"; // This now only imports prod-safe functions
import "dotenv/config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Your existing logging middleware is perfectly fine.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

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

(async () => {
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // 👇 THIS IS THE CORE LOGIC CHANGE 👇
  // It separates what runs on Vercel (production) from what runs on your machine (development)
  if (process.env.NODE_ENV === "production") {
    // Vercel will run this block
    serveStatic(app);
  } else {
    // Your local machine will run this block
    const server = http.createServer(app);

    // Dynamically import the new dev-only file. This line is ignored by the production build.
    const { setupVite } = await import("./vite.dev.js");
    await setupVite(app, server);

    // The server only listens locally, not on Vercel
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen({ port, host: "127.0.0.1" }, () => {
      log(`serving on port ${port}`);
    });
  }
})();

// Export the app for Vercel. It will be run as a serverless function.
export default app;
