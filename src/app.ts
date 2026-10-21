import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { CLIENT_DIR } from "./config/paths.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { securityHeaders } from "./middlewares/security-headers.js";
import { serveMedia } from "./middlewares/serve-media.js";
import type { MediaStorage } from "./media/media-storage.js";
import { createApiRouter, type ApiDependencies } from "./routes/index.js";

export interface AppOptions {
  /** Cookies and HSTS are only sent when the site is served over HTTPS. */
  secureCookies: boolean;
  /** Reverse proxies in front of the app. Client addresses are read past this many X-Forwarded-For hops. */
  trustProxyHops: number;
  /** Where each shop's photos are kept. */
  media: MediaStorage;
}

export function createApp(deps: ApiDependencies, options: AppOptions): express.Express {
  const app = express();

  app.disable("x-powered-by");
  // With no proxy in front, req.ip is the socket address and X-Forwarded-For is ignored.
  if (options.trustProxyHops > 0) {
    app.set("trust proxy", options.trustProxyHops);
  }

  app.use(securityHeaders({ hsts: options.secureCookies }));
  app.use(express.json({ limit: "64kb" }));
  // Shop and owner responses are personal, so browsers and shared caches must not keep them.
  app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  // Hosts poll this to decide whether an instance is up. It does not touch the database.
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.use("/api", createApiRouter(deps));
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.get("/media/:slug/:file", serveMedia(options.media));
  app.use("/media", (_req: Request, res: Response) => {
    res.status(404).end();
  });

  app.use(express.static(CLIENT_DIR));

  // Every other address (a shop's site, its owner area, the platform page) is the single-page app.
  app.get("/*splat", (_req: Request, res: Response) => {
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
  });

  app.use(errorHandler);

  return app;
}
