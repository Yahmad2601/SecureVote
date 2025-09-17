import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { nanoid } from "nanoid";

type ViteModule = typeof import("vite");
type ViteConfigModule = Awaited<typeof import("../vite.config")>;

async function loadViteDependencies(): Promise<{
  createViteServer: ViteModule["createServer"];
  createLogger: ViteModule["createLogger"];
  viteConfig: ViteConfigModule["default"];
}> {
  const [viteModule, viteConfigModule] = await Promise.all([
    import("vite"),
    import("../vite.config"),
  ]);

  return {
    createViteServer: viteModule.createServer,
    createLogger: viteModule.createLogger,
    viteConfig: viteConfigModule.default,
  };
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const { createViteServer, createLogger, viteConfig } = await loadViteDependencies();

  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        currentDir,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));

  const candidatePaths = [
    path.resolve(currentDir, "public"),
    path.resolve(process.cwd(), "dist", "public"),
  ];

  const distPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!distPath) {
    throw new Error(
      `Could not find the build directory. Looked in: ${candidatePaths.join(", ")}. Make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
