import express, { type Express } from "express";
import path from "path";

// The log function is safe for production
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// This function serves the pre-built static files in production
export function serveStatic(app: Express) {
  // Use process.cwd() to get the root directory and point to 'dist'
  const distPath = path.resolve(process.cwd(), "dist");

  // Serve static assets from the dist folder
  app.use(express.static(distPath));

  // For any other request, fall back to the main index.html file
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
