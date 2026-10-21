import type { Request, Response } from "express";
import { OWNER_COOKIE, ownerCookiePath, SESSION_SECONDS } from "../auth/session-config.js";
import { issueToken } from "../auth/tokens.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import type { OwnerAccount } from "../repositories/types.js";
import type { AccountService } from "../services/account-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { buildCookie } from "../utils/cookies.js";
import { parseLogin, parsePasswordChange } from "../validations/accounts.js";
import { licenseSummary } from "./summaries.js";

interface OwnerControllerOptions {
  accounts: AccountService;
  secret: string;
  secureCookies: boolean;
  clock: Clock;
}

/** Owner sign-in, sign-out, session check and password changes for one shop. */
export class OwnerController {
  private readonly accounts: AccountService;
  private readonly secret: string;
  private readonly secureCookies: boolean;
  private readonly clock: Clock;

  constructor(options: OwnerControllerOptions) {
    this.accounts = options.accounts;
    this.secret = options.secret;
    this.secureCookies = options.secureCookies;
    this.clock = options.clock;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const { email, password } = parseLogin(req.body);
    const owner = await this.accounts.signInOwner(tenant, email, password);

    this.issueSession(res, tenant.slug, owner);
    res.json({ ok: true });
  };

  logout = (req: Request, res: Response): void => {
    const tenant = tenantOf(req);
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
    // Other sessions are now stale. Issue a fresh one for this browser so it stays signed in.
    this.issueSession(res, tenant.slug, { ...owner, sessionVersion });
    res.json({ ok: true });
  };

  private issueSession(res: Response, slug: string, owner: Pick<OwnerAccount, "id" | "tenantId" | "sessionVersion">): void {
    const expiresAt = Math.floor(this.clock.now().getTime() / 1000) + SESSION_SECONDS;
    const token = issueToken(this.secret, {
      kind: "owner",
      exp: expiresAt,
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
