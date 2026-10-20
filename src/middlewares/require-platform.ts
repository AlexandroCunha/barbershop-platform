import type { NextFunction, Request, RequestHandler, Response } from "express";
import { PLATFORM_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";

/**
 * Only the platform owner may pass. `platformKey` is derived from the platform
 * token, so changing that token signs the platform owner out.
 */
export function requirePlatform(platformKey: string | undefined): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (platformKey === undefined) {
      next(new AppError(503, "The platform area is not available."));
      return;
    }

    const payload = readToken(platformKey, parseCookies(req.headers.cookie)[PLATFORM_COOKIE], Date.now());
    if (!payload || payload.kind !== "platform") {
      next(new AppError(401, "Please sign in to the platform area"));
      return;
    }

    next();
  };
}
