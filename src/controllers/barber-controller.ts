import type { Request, Response } from "express";
import { BARBER_COOKIE, barberCookiePath, SESSION_SECONDS } from "../auth/session-config.js";
import { issueToken, readToken } from "../auth/tokens.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import type { BarberAccount } from "../repositories/types.js";
import type { BarberService } from "../services/barber-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { buildCookie, parseCookies } from "../utils/cookies.js";
import { parseProfessionalId } from "../validations/admin.js";
import { parseBarberCredentials, parseBarberLogin } from "../validations/barber.js";

interface BarberControllerOptions {
  barbers: BarberService;
  secret: string;
  secureCookies: boolean;
  clock: Clock;
}

/** A barber's own area (sign-in, their bookings) and the owner's control of barber logins. */
export class BarberController {
  private readonly barbers: BarberService;
  private readonly secret: string;
  private readonly secureCookies: boolean;
  private readonly clock: Clock;

  constructor(options: BarberControllerOptions) {
    this.barbers = options.barbers;
    this.secret = options.secret;
    this.secureCookies = options.secureCookies;
    this.clock = options.clock;
  }

  login = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const { email, password } = parseBarberLogin(req.body);
    const account = await this.barbers.signIn(tenant, email, password);

    const session = await this.barbers.openSession(tenant, account);
    const token = issueToken(this.secret, {
      kind: "barber",
      exp: session.expiresAt,
      sid: session.id,
      tenantId: tenant.id,
      barberAccountId: account.id,
    });
    res.setHeader(
      "Set-Cookie",
      buildCookie(BARBER_COOKIE, token, {
        path: barberCookiePath(tenant.slug),
        maxAgeSeconds: SESSION_SECONDS,
        secure: this.secureCookies,
      }),
    );
    res.json({ ok: true });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const payload = readToken(this.secret, parseCookies(req.headers.cookie)[BARBER_COOKIE], this.clock.now().getTime());
    if (payload?.kind === "barber" && payload.sid) {
      await this.barbers.endSession(payload.sid);
    }

    res.setHeader(
      "Set-Cookie",
      buildCookie(BARBER_COOKIE, "", {
        path: barberCookiePath(tenant.slug),
        maxAgeSeconds: 0,
        secure: this.secureCookies,
      }),
    );
    res.status(204).end();
  };

  /** Reached only through requireBarber. */
  session = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.barbers.profile(tenantOf(req), barberOf(req));
    res.json({ ok: true, professional: profile });
  };

  /** Reached only through requireBarber. Lists this barber's bookings that have not started yet. */
  bookings = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.barbers.upcomingBookings(tenantOf(req), barberOf(req)));
  };

  /** The owner creates or replaces a barber's login. */
  setLogin = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = parseBarberCredentials(req.body);
    const id = parseProfessionalId(String(req.params.id));
    res.json(await this.barbers.setLogin(tenantOf(req), id, email, password));
  };

  /** The owner removes a barber's login. */
  removeLogin = async (req: Request, res: Response): Promise<void> => {
    await this.barbers.removeLogin(tenantOf(req), parseProfessionalId(String(req.params.id)));
    res.status(204).end();
  };
}

function barberOf(req: Request): BarberAccount {
  if (!req.barber) {
    throw new AppError(401, "Please sign in to your barber area");
  }
  return req.barber;
}
