import type { NextFunction, Request, RequestHandler, Response } from "express";
import { PLATFORM_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import type { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";

const NOT_SIGNED_IN = "Please sign in to the platform area";

/**
 * Only a signed-in developer may pass. The token must be signed with `platformKey`, and its
 * session must still be active and belong to a developer.
 */
export function requirePlatform(platformKey: string, sessions: SessionService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const payload = readToken(platformKey, parseCookies(req.headers.cookie)[PLATFORM_COOKIE], Date.now());
    if (!payload || payload.kind !== "platform" || payload.sid === undefined) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    const session = await sessions.findActive(payload.sid);
    if (!session || session.kind !== "platform" || session.developerId === null) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    next();
  };
}
