import type { NextFunction, Request, RequestHandler, Response } from "express";
import { OWNER_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import type { OwnerRepository } from "../repositories/types.js";
import type { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";
import { tenantOf } from "./load-tenant.js";

const NOT_SIGNED_IN = "Please sign in to continue";

/**
 * Lets a request through only with a live owner session for this shop. Three checks must
 * all pass: the token's signature and expiry, an active session record for it, and the
 * owner's current session version. Signing out or changing the password ends the access.
 */
export function requireOwner(secret: string, owners: OwnerRepository, sessions: SessionService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const tenant = tenantOf(req);
    const payload = readToken(secret, parseCookies(req.headers.cookie)[OWNER_COOKIE], Date.now());

    if (
      !payload ||
      payload.kind !== "owner" ||
      payload.tenantId !== tenant.id ||
      payload.ownerId === undefined ||
      payload.version === undefined ||
      payload.sid === undefined
    ) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    const session = await sessions.findActive(payload.sid);
    if (!session || session.kind !== "owner" || session.tenantId !== tenant.id || session.ownerId !== payload.ownerId) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    const owner = await owners.findById(payload.ownerId);
    if (!owner || owner.tenantId !== tenant.id || owner.sessionVersion !== payload.version) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    req.owner = owner;
    next();
  };
}
