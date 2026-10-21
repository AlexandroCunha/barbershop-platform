import type { NextFunction, Request, RequestHandler, Response } from "express";
import { PLATFORM_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import type { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";

/**
 * Only the platform owner may pass. The token must be signed with `platformKey` (derived from
 * the platform token, so changing that token ends every platform session) and its session
 * record must still be active.
 */
export function requirePlatform(platformKey: string | undefined, sessions: SessionService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (platformKey === undefined) {
      next(new AppError(503, "The platform area is not available."));
      return;
    }

    const payload = readToken(platformKey, parseCookies(req.headers.cookie)[PLATFORM_COOKIE], Date.now());
    if (!payload || payload.kind !== "platform" || payload.sid === undefined) {
      next(new AppError(401, "Please sign in to the platform area"));
      return;
    }

    const session = await sessions.findActive(payload.sid);
    if (!session || session.kind !== "platform") {
      next(new AppError(401, "Please sign in to the platform area"));
      return;
    }

    next();
  };
}
