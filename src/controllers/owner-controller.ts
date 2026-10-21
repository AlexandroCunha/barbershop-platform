import type { Request, Response } from "express";
import { OWNER_COOKIE, ownerCookiePath, SESSION_SECONDS } from "../auth/session-config.js";
import { issueToken, readToken } from "../auth/tokens.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import type { OwnerAccount } from "../repositories/types.js";
import type { AccountService } from "../services/account-service.js";
import type { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { buildCookie, parseCookies } from "../utils/cookies.js";
import { parseLogin, parsePasswordChange } from "../validations/accounts.js";
import { licenseSummary } from "./summaries.js";

interface OwnerControllerOptions {
  accounts: AccountService;
  sessions: SessionService;
  secret: string;
  secureCookies: boolean;
  clock: Clock;
}

/** Owner sign-in, sign-out, session check and password changes for one shop. */
export class OwnerController {
  private readonly accounts: AccountService;
  private readonly sessions: SessionService;
  private readonly secret: string;
  private readonly secureCookies: boolean;
  private readonly clock: Clock;

  constructor(options: OwnerControllerOptions) {
    this.accounts = options.accounts;
    this.sessions = options.sessions;
    this.secret = options.secret;
    this.secureCookies = options.secureCookies;
    this.clock = options.clock;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const { email, password } = parseLogin(req.body);
    const owner = await this.accounts.signInOwner(tenant, email, password);

    await this.issueSession(res, tenant.slug, owner);
    res.json({ ok: true });
  };

  /** Ends this browser's session on the server as well, so a copy of the cookie stops working at once. */
  logout = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const payload = readToken(this.secret, parseCookies(req.headers.cookie)[OWNER_COOKIE], this.clock.now().getTime());
    if (payload?.sid) {
      await this.sessions.revoke(payload.sid);
    }

    res.setHeader(
      "Set-Cookie",
      buildCookie(OWNER_COOKIE, "", { path: ownerCookiePath(tenant.slug), maxAgeSeconds: 0, secure: this.secureCookies }),
    );
    res.status(204).end();
  };

  /** Reached only through requireOwner, so a response here means the session is valid. */
  session = (req: Request, res: Response): void => {
    const tenant = tenantOf(req);
    res.json({ ok: true, license: licenseSummary(tenant, this.clock.now()) });
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const owner = ownerOf(req);
    const { current, next } = parsePasswordChange(req.body);

    const sessionVersion = await this.accounts.changeOwnerPassword(owner, current, next);
    // Every other session of this owner is ended; this browser gets a fresh one so it stays signed in.
    await this.sessions.revokeAllForOwner(owner.id);
    await this.issueSession(res, tenant.slug, { ...owner, sessionVersion });
    res.json({ ok: true });
  };

  private async issueSession(
    res: Response,
    slug: string,
    owner: Pick<OwnerAccount, "id" | "tenantId" | "sessionVersion">,
  ): Promise<void> {
    const session = await this.sessions.openOwnerSession({ tenantId: owner.tenantId, ownerId: owner.id });
    const token = issueToken(this.secret, {
      kind: "owner",
      exp: session.expiresAt,
      sid: session.id,
      tenantId: owner.tenantId,
      ownerId: owner.id,
      version: owner.sessionVersion,
    });
    res.setHeader(
      "Set-Cookie",
      buildCookie(OWNER_COOKIE, token, {
        path: ownerCookiePath(slug),
        maxAgeSeconds: SESSION_SECONDS,
        secure: this.secureCookies,
      }),
    );
  }
}

function ownerOf(req: Request): OwnerAccount {
  if (!req.owner) {
    throw new AppError(401, "Please sign in to continue");
  }
  return req.owner;
}
