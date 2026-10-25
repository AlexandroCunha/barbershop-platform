import type { Request, Response } from "express";
import { BARBER_COOKIE, barberCookiePath, SESSION_SECONDS } from "../auth/session-config.js";
import { issueToken, readToken } from "../auth/tokens.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import type { BarberAccount } from "../repositories/types.js";
import type { BarberService } from "../services/barber-service.js";
import type { BookingManagementService } from "../services/booking-management-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { buildCookie, parseCookies } from "../utils/cookies.js";
import { parseProfessionalId } from "../validations/admin.js";
import { parseBookingId, parseSlotChange } from "../validations/booking.js";
import { parseBarberCredentials, parseBarberLogin, parseContactEmail } from "../validations/barber.js";

interface BarberControllerOptions {
  barbers: BarberService;
  management: BookingManagementService;
  secret: string;
  secureCookies: boolean;
  clock: Clock;
}

/** A barber's own area (sign-in, their bookings) and the owner's control of barber logins. */
export class BarberController {
  private readonly barbers: BarberService;
  private readonly management: BookingManagementService;
  private readonly secret: string;
  private readonly secureCookies: boolean;
  private readonly clock: Clock;

  constructor(options: BarberControllerOptions) {
    this.barbers = options.barbers;
    this.management = options.management;
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

  /** A barber can cancel only the bookings in their own chair. */
  cancelBooking = async (req: Request, res: Response): Promise<void> => {
    await this.management.cancel(tenantOf(req), parseBookingId(req.params.id), {
      kind: "barber",
      professionalId: barberOf(req).professionalId,
    });
    res.status(204).end();
  };

  /** A barber can move only the bookings in their own chair, and keeps them in that chair. */
  moveBooking = async (req: Request, res: Response): Promise<void> => {
    await this.management.move(
      tenantOf(req),
      parseBookingId(req.params.id),
      { kind: "barber", professionalId: barberOf(req).professionalId },
      parseSlotChange(req.body),
    );
    res.status(204).end();
  };

  /** A barber's own hours, read through their own area. */
  hours = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.barbers.getHours(tenantOf(req), barberOf(req).professionalId));
  };

  /** A barber saves their own hours. */
  saveHours = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.barbers.saveHours(tenantOf(req), barberOf(req).professionalId, req.body));
  };

  /** The owner reads a barber's hours. */
  ownerHours = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.barbers.getHours(tenantOf(req), parseProfessionalId(String(req.params.id))));
  };

  /** The owner saves a barber's hours. */
  saveOwnerHours = async (req: Request, res: Response): Promise<void> => {
    const id = parseProfessionalId(String(req.params.id));
    res.json(await this.barbers.saveHours(tenantOf(req), id, req.body));
  };

  /** The owner sees the address where a barber hears about new bookings. */
  ownerContact = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.barbers.getContactEmail(tenantOf(req), parseProfessionalId(String(req.params.id))));
  };

  /** The owner sets or clears that address. */
  saveOwnerContact = async (req: Request, res: Response): Promise<void> => {
    const id = parseProfessionalId(String(req.params.id));
    res.json(await this.barbers.saveContactEmail(tenantOf(req), id, parseContactEmail(req.body)));
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
