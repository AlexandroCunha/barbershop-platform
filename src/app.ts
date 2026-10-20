import express, { type Request, type Response } from "express";
import path from "node:path";
import { CLIENT_DIR } from "./config/paths.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { securityHeaders } from "./middlewares/security-headers.js";
import { serveMedia } from "./middlewares/serve-media.js";
import { createApiRouter, type ApiDependencies } from "./routes/index.js";

export interface AppOptions {
  /** Cookies and HSTS are only sent when the site is served over HTTPS. */
  secureCookies: boolean;
  /** Set when running behind a reverse proxy, so client addresses come from its X-Forwarded-For header. */
  trustProxy: boolean;
  /** Folder that holds each shop's photos, one sub-folder per shop. */
  mediaRoot: string;
}

export function createApp(deps: ApiDependencies, options: AppOptions): express.Express {
  const app = express();

  app.disable("x-powered-by");
  if (options.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(securityHeaders({ hsts: options.secureCookies }));
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createApiRouter(deps));
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.get("/media/:slug/:file", serveMedia(options.mediaRoot));
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
