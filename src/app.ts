import express, { type Request, type Response } from "express";
import { CLIENT_DIR, MEDIA_DIR } from "./config/paths.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { securityHeaders } from "./middlewares/security-headers.js";
import { createApiRouter, type ApiControllers } from "./routes/index.js";

export interface AppOptions {
  /** Cookies and HSTS are only sent when the site is served over HTTPS. */
  secureCookies: boolean;
  /** Set when running behind a reverse proxy, so client addresses come from its X-Forwarded-For header. */
  trustProxy: boolean;
}

export function createApp(controllers: ApiControllers, options: AppOptions): express.Express {
  const app = express();

  app.disable("x-powered-by");
  if (options.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(securityHeaders({ hsts: options.secureCookies }));
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", createApiRouter(controllers));

  // Owner uploads, served as-is. The folder is created on startup.
  app.use("/media", express.static(MEDIA_DIR, { dotfiles: "ignore", index: false }));

  app.use(express.static(CLIENT_DIR));
  // The owner area is part of the single-page app, so it serves the same entry page.
  app.get("/admin", (_req: Request, res: Response) => {
    res.sendFile("index.html", { root: CLIENT_DIR });
  });

  app.use(errorHandler);

  return app;
}
