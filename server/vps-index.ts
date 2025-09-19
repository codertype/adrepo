import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vps-vite";
import path from "path";
import fs from "fs";

const app = express();

// Enable trust proxy for secure cookies behind Nginx reverse proxy
app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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

// Security headers middleware
app.use((req, res, next) => {
  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  
  // Cache-Control headers for better performance
  if (req.path.startsWith('/api/')) {
    // API responses should not be cached
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    // Static assets can be cached for a long time
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    // HTML and other content with moderate caching
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  
  // Remove problematic headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.removeHeader('P3P');
  
  next();
});

// Error handler middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  console.error(`${status}: ${message}`);
  res.status(status).json({ message });
});

// START SERVER FIRST - before any async operations
const rawPort = process.env.PORT;
const parsedPort = Number(rawPort);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;

if (parsedPort === 0) {
  console.warn("⚠️ PORT=0 not allowed; forcing port 3000");
}

console.log(`🚀 Starting server on port ${port}...`);

const server = app.listen(port, "0.0.0.0", () => {
  const addr = server.address();
  console.log(`✅ Server actually listening on:`, addr);
  log(`✅ Server listening on port ${port}`);
  
  if (addr && typeof addr === 'object' && addr.port !== port) {
    console.warn(`⚠️ WARNING: Requested port ${port} but bound to ${addr.port}`);
  }
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error);
});

// Initialize routes and database IMMEDIATELY - BEFORE static files
(async () => {
  try {
    console.log(`🔧 Initializing routes and database...`);
    await registerRoutes(app);
    console.log(`✅ Routes and database initialized successfully`);
    
    // ONLY AFTER routes are registered, set up static file serving
    if (process.env.NODE_ENV === "production") {
      try {
        serveStatic(app);
      } catch (error) {
        console.error("Failed to serve static files:", error);
        // Fallback to serving from public directory (VPS deployment location)
        const vpsPublicPath = path.resolve(process.cwd(), "public");
        const devPublicPath = path.resolve(process.cwd(), "dist", "public");
        const fallbackPath = fs.existsSync(vpsPublicPath) ? vpsPublicPath : devPublicPath;
        
        console.log(`📁 Fallback: serving static files from ${fallbackPath}`);
        app.use(express.static(fallbackPath));
        app.use("*", (_req, res) => {
          res.sendFile(path.resolve(fallbackPath, "index.html"));
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to initialize routes/database:', error);
    // Don't exit - server should still respond to health checks
  }
})();