import type { Request, Response } from "express";
import { readManageToken } from "../auth/manage-token.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import type { BookingManagementService } from "../services/booking-management-service.js";
import type { BookingService } from "../services/booking-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { parseDate, parseSlotChange } from "../validations/booking.js";

const NOT_VALID = "This link is not valid. Find your booking again from the shop's website.";

/**
 * A customer's own booking, reached through the link in their e-mail. The token travels in the request
 * body rather than the address, so it stays out of access logs.
 */
export class ManageController {
  constructor(
    private readonly management: BookingManagementService,
    private readonly bookings: BookingService,
    private readonly secret: string,
    private readonly clock: Clock,
  ) {}

  view = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const bookingId = this.bookingIdOf(req);
    res.json(await this.management.viewForCustomer(tenant, bookingId));
  };

  cancel = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    await this.management.cancel(tenant, this.bookingIdOf(req), { kind: "customer" });
    res.json(await this.management.viewForCustomer(tenant, this.bookingIdOf(req)));
  };

  move = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const bookingId = this.bookingIdOf(req);
    await this.management.move(tenant, bookingId, { kind: "customer" }, parseSlotChange(req.body));
    res.json(await this.management.viewForCustomer(tenant, bookingId));
  };

  /** The free start times for the same barber on a date, with this booking's own time counted as free. */
  availability = async (req: Request, res: Response): Promise<void> => {
    const tenant = tenantOf(req);
    const bookingId = this.bookingIdOf(req);
    const date = parseDate((req.body as { date?: unknown } | undefined)?.date);
    const booking = await this.management.viewForCustomer(tenant, bookingId);
    const [barber] = await this.bookings.availability(tenant, booking.serviceId, date, booking.professionalId, bookingId);
    res.json({ date, times: barber?.times ?? [] });
  };

  private bookingIdOf(req: Request): string {
    const token = (req.body as { token?: unknown } | undefined)?.token;
    const claims = readManageToken(this.secret, typeof token === "string" ? token : undefined, this.clock.now());
    if (!claims || claims.tenantId !== tenantOf(req).id) {
      throw new AppError(404, NOT_VALID);
    }
    return claims.bookingId;
  }
}
