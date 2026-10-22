import type { Request, Response } from "express";
import { decoyPasswordHash, verifyPassword } from "../auth/passwords.js";
import { PLATFORM_COOKIE, PLATFORM_COOKIE_PATH, SESSION_SECONDS } from "../auth/session-config.js";
import { issueToken, readToken } from "../auth/tokens.js";
import type { DeveloperRepository } from "../repositories/types.js";
import type { AccountService } from "../services/account-service.js";
import type { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { buildCookie, parseCookies } from "../utils/cookies.js";
import { parseLicense, parseLogin, parseNewTenant } from "../validations/accounts.js";
import { tenantSummary } from "./summaries.js";

interface PlatformControllerOptions {
  developers: DeveloperRepository;
  /** Key that signs platform sessions. Derived from the session secret, separate from the owner key. */
  platformKey: string;
  accounts: AccountService;
  sessions: SessionService;
  secureCookies: boolean;
  clock: Clock;
}

/** The developer's view: every barbershop and its license. */
export class PlatformController {
  private readonly options: PlatformControllerOptions;

  constructor(options: PlatformControllerOptions) {
    this.options = options;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const { developers, platformKey, secureCookies, sessions } = this.options;
    const { email, password } = parseLogin(req.body);

    const developer = await developers.findByEmail(email);
    // The hash is checked even for an unknown email, so response time does not reveal who has an account.
    const passwordMatches = await verifyPassword(password, developer?.passwordHash ?? (await decoyPasswordHash));
    if (!developer || !passwordMatches) {
      throw new AppError(401, "Email or password is not correct");
    }

    const session = await sessions.openPlatformSession(developer.id);
    const value = issueToken(platformKey, { kind: "platform", exp: session.expiresAt, sid: session.id });
    res.setHeader(
      "Set-Cookie",
      buildCookie(PLATFORM_COOKIE, value, { path: PLATFORM_COOKIE_PATH, maxAgeSeconds: SESSION_SECONDS, secure: secureCookies }),
    );
    res.json({ ok: true });
  };

  /** Ends the platform session on the server, so a copy of the cookie stops working at once. */
  logout = async (req: Request, res: Response): Promise<void> => {
    const { platformKey, secureCookies, sessions, clock } = this.options;
    const payload = readToken(platformKey, parseCookies(req.headers.cookie)[PLATFORM_COOKIE], clock.now().getTime());
    if (payload?.sid) {
      await sessions.revoke(payload.sid);
    }

    res.setHeader(
      "Set-Cookie",
      buildCookie(PLATFORM_COOKIE, "", { path: PLATFORM_COOKIE_PATH, maxAgeSeconds: 0, secure: secureCookies }),
    );
    res.status(204).end();
  };

  session = (_req: Request, res: Response): void => {
    res.json({ ok: true });
  };

  listTenants = async (_req: Request, res: Response): Promise<void> => {
    const now = this.options.clock.now();
    const tenants = await this.options.accounts.listTenants();
    res.json(tenants.map((tenant) => tenantSummary(tenant, now)));
  };

  createTenant = async (req: Request, res: Response): Promise<void> => {
    const tenant = await this.options.accounts.createTenant(parseNewTenant(req.body));
    res.status(201).json(tenantSummary(tenant, this.options.clock.now()));
  };

  setLicense = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, "Barbershop id must be a positive integer");
    }
    const tenant = await this.options.accounts.setLicense(id, parseLicense(req.body));
    res.json(tenantSummary(tenant, this.options.clock.now()));
  };
}
