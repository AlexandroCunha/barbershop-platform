import type { Request, Response } from "express";
import type { Booking } from "../domain/types.js";
import { tenantOf } from "../middlewares/load-tenant.js";
import type { BookingManagementService } from "../services/booking-management-service.js";
import type { BookingService } from "../services/booking-service.js";
import { minutesToTime } from "../utils/time.js";
import { parseAvailabilityQuery, parseBookingId, parseBookingRequest, parseSlotChange } from "../validations/booking.js";

/** Public shape of a booking. The customer's contact details are never returned. */
const toBookingResponse = (booking: Booking, confirmationEmail: string | null) => ({
  id: booking.id,
  serviceId: booking.serviceId,
  professionalId: booking.professionalId,
  date: booking.date,
  startTime: minutesToTime(booking.startMinute),
  endTime: minutesToTime(booking.endMinute),
  customerName: booking.customerName,
  /** The address the confirmation e-mail went to, or null when no e-mail is sent on this server. */
  confirmationEmail,
});

export class BookingController {
  constructor(
    private readonly service: BookingService,
    private readonly management: BookingManagementService,
  ) {}

  listServices = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listServices(tenantOf(req)));
  };

  listProfessionals = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listProfessionals(tenantOf(req)));
  };

  /** The times offered on the date, and each barber's own free times, so the customer can choose a barber. */
  availability = async (req: Request, res: Response): Promise<void> => {
    const { serviceId, professionalId, date } = parseAvailabilityQuery(req.query);
    const barbers = await this.service.availability(tenantOf(req), serviceId, date, professionalId);
    const times = [...new Set(barbers.flatMap((barber) => barber.times))].sort();
    res.json({ date, times, barbers });
  };

  /** Reached only through the owner's session. Includes the customers' contact details. */
  ownerBookings = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.service.upcomingForOwner(tenantOf(req)));
  };

  /** Reached only through the owner's session. */
  ownerCancel = async (req: Request, res: Response): Promise<void> => {
    await this.management.cancel(tenantOf(req), parseBookingId(req.params.id), { kind: "owner" });
    res.status(204).end();
  };

  /** Reached only through the owner's session. */
  ownerMove = async (req: Request, res: Response): Promise<void> => {
    await this.management.move(tenantOf(req), parseBookingId(req.params.id), { kind: "owner" }, parseSlotChange(req.body));
    res.status(204).end();
  };

  book = async (req: Request, res: Response): Promise<void> => {
    const request = parseBookingRequest(req.body);
    const booking = await this.service.book(tenantOf(req), request);
    const confirmationEmail = this.service.sendsConfirmations ? request.customerEmail : null;
    res.status(201).json(toBookingResponse(booking, confirmationEmail));
  };
}
