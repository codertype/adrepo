import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

// Dynamic imports for dev dependencies - only available in development
let viteLogger: any = null;

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
  // Only available in development - will throw in production if called
  if (process.env.NODE_ENV === "production") {
    throw new Error("setupVite should only be called in development mode");
  }

  try {
    // Dynamic imports for dev-only dependencies
    const { createServer: createViteServer, createLogger } = await import("vite");
    const { default: react } = await import("@vitejs/plugin-react");
    const { nanoid } = await import("nanoid");
    
    viteLogger = createLogger();

    const viteConfig = {
      plugins: [react()],
      resolve: {
        alias: {
          "@": path.resolve(process.cwd(), "client", "src"),
          "@shared": path.resolve(process.cwd(), "shared"),
          "@assets": path.resolve(process.cwd(), "attached_assets"),
        },
      },
      root: path.resolve(process.cwd(), "client"),
      build: {
        outDir: path.resolve(process.cwd(), "dist/public"),
        emptyOutDir: true,
      },
      server: {
        fs: {
          strict: true,
          deny: ["**/.*"],
        },
      },
    };

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
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          process.cwd(),
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
  } catch (error) {
    throw new Error(`Failed to setup Vite in development mode: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function serveStatic(app: Express) {
  // Check for assets in VPS deployment location first, fallback to development location
  const vpsPublicPath = path.resolve(process.cwd(), "public");
  const devPublicPath = path.resolve(process.cwd(), "dist", "public");
  
  const publicPath = fs.existsSync(vpsPublicPath) ? vpsPublicPath : devPublicPath;
  console.log(`📁 Serving static files from: ${publicPath}`);

  if (!fs.existsSync(publicPath)) {
    throw new Error(
      `Could not find the build directory: ${publicPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(publicPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(publicPath, "index.html"));
  });
}