import type { Request, Response } from "express";
import { PLATFORM_COOKIE, PLATFORM_COOKIE_PATH, SESSION_SECONDS } from "../auth/session-config.js";
import { issueToken, stringsMatch } from "../auth/tokens.js";
import type { AccountService } from "../services/account-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { buildCookie } from "../utils/cookies.js";
import { parseLicense, parseNewTenant } from "../validations/accounts.js";
import { tenantSummary } from "./summaries.js";

interface PlatformControllerOptions {
  /** The platform owner's token, compared with the one sent at sign-in. */
  platformToken: string | undefined;
  /** Key that signs platform sessions. Derived from the token, so changing the token ends them. */
  platformKey: string | undefined;
  accounts: AccountService;
  secureCookies: boolean;
  clock: Clock;
}

/** The platform owner's view: every barbershop and its license. */
export class PlatformController {
  private readonly options: PlatformControllerOptions;

  constructor(options: PlatformControllerOptions) {
    this.options = options;
  }

  login = (req: Request, res: Response): void => {
    const { platformToken, platformKey, secureCookies, clock } = this.options;
    if (platformToken === undefined || platformKey === undefined) {
      throw new AppError(503, "The platform area is not available.");
    }

    const given = typeof req.body?.token === "string" ? req.body.token : "";
    if (!stringsMatch(given, platformToken)) {
      throw new AppError(401, "Invalid platform token");
    }

    const expiresAt = Math.floor(clock.now().getTime() / 1000) + SESSION_SECONDS;
    const value = issueToken(platformKey, { kind: "platform", exp: expiresAt });
    res.setHeader(
      "Set-Cookie",
      buildCookie(PLATFORM_COOKIE, value, { path: PLATFORM_COOKIE_PATH, maxAgeSeconds: SESSION_SECONDS, secure: secureCookies }),
    );
    res.json({ ok: true });
  };

  logout = (_req: Request, res: Response): void => {
    res.setHeader(
      "Set-Cookie",
      buildCookie(PLATFORM_COOKIE, "", { path: PLATFORM_COOKIE_PATH, maxAgeSeconds: 0, secure: this.options.secureCookies }),
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
