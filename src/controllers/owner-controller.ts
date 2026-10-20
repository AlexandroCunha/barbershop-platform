import type { Request, Response } from "express";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, type OwnerAuth } from "../auth/owner-auth.js";
import { AppError } from "../utils/app-error.js";

const COOKIE_PATH = "/api/admin";

/** Signs the owner in with the access token, and out again. */
export class OwnerController {
  constructor(
    private readonly auth: OwnerAuth,
    private readonly secureCookies: boolean,
  ) {}

  login = (req: Request, res: Response): void => {
    if (!this.auth.isConfigured) {
      throw new AppError(503, "The owner area is disabled. Set ADMIN_TOKEN in .env to enable it.");
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!this.auth.checkToken(token)) {
      throw new AppError(401, "Invalid access token");
    }

    res.setHeader("Set-Cookie", this.cookie(this.auth.issueSession(), SESSION_TTL_SECONDS));
    res.json({ ok: true });
  };

  logout = (_req: Request, res: Response): void => {
    res.setHeader("Set-Cookie", this.cookie("", 0));
    res.status(204).end();
  };

  /** Only reached through requireOwner, so a response here means the session is valid. */
  session = (_req: Request, res: Response): void => {
    res.json({ ok: true });
  };

  /** HttpOnly keeps the session away from scripts; SameSite=Strict stops cross-site requests from carrying it. */
  private cookie(value: string, maxAge: number): string {
    const attributes = [
      `${SESSION_COOKIE}=${value}`,
      `Path=${COOKIE_PATH}`,
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${maxAge}`,
    ];
    if (this.secureCookies) {
      attributes.push("Secure");
    }
    return attributes.join("; ");
  }
}
