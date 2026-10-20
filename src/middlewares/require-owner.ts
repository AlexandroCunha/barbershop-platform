import type { NextFunction, Request, RequestHandler, Response } from "express";
import { SESSION_COOKIE, type OwnerAuth } from "../auth/owner-auth.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";

/** Lets a request through only when it carries a valid, unexpired owner session. */
export function requireOwner(auth: OwnerAuth): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!auth.isConfigured) {
      next(new AppError(503, "The owner area is disabled. Set ADMIN_TOKEN in .env to enable it."));
      return;
    }

    const session = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!auth.verifySession(session)) {
      next(new AppError(401, "Please sign in to the owner area"));
      return;
    }

    next();
  };
}
