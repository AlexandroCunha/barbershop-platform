import type { NextFunction, Request, RequestHandler, Response } from "express";
import { BARBER_COOKIE } from "../auth/session-config.js";
import { readToken } from "../auth/tokens.js";
import type { BarberAccountRepository } from "../repositories/types.js";
import type { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import { parseCookies } from "../utils/cookies.js";
import { tenantOf } from "./load-tenant.js";

const NOT_SIGNED_IN = "Please sign in to your barber area";

/**
 * Lets a request through only with a live barber session for this shop: a valid token, an active
 * session record for that barber login, and a login that still belongs to this shop.
 */
export function requireBarber(
  secret: string,
  accounts: BarberAccountRepository,
  sessions: SessionService,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const tenant = tenantOf(req);
    const payload = readToken(secret, parseCookies(req.headers.cookie)[BARBER_COOKIE], Date.now());

    if (
      !payload ||
      payload.kind !== "barber" ||
      payload.tenantId !== tenant.id ||
      payload.sid === undefined ||
      payload.barberAccountId === undefined
    ) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    const session = await sessions.findActive(payload.sid);
    if (
      !session ||
      session.kind !== "barber" ||
      session.tenantId !== tenant.id ||
      session.barberAccountId !== payload.barberAccountId
    ) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    const account = await accounts.findById(payload.barberAccountId);
    if (!account || account.tenantId !== tenant.id) {
      next(new AppError(401, NOT_SIGNED_IN));
      return;
    }

    req.barber = account;
    next();
  };
}
