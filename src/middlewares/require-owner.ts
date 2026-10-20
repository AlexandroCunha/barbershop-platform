import type { NextFunction, Request, RequestHandler, Response } from "express";
import { OWNER_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import type { OwnerRepository } from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";
import { tenantOf } from "./load-tenant.js";

const NOT_SIGNED_IN = "Please sign in to continue";

/**
 * Lets a request through only with a live owner session for this shop.
 * The session must name this shop, and its version must match the owner's
 * current one, so a password change signs out every other session.
 */
export function requireOwner(secret: string, owners: OwnerRepository): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const tenant = tenantOf(req);
    const token = parseCookies(req.headers.cookie)[OWNER_COOKIE];
    const payload = readToken(secret, token, Date.now());

    if (!payload || payload.kind !== "owner" || payload.tenantId !== tenant.id) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }
    if (payload.ownerId === undefined || payload.version === undefined) {
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
