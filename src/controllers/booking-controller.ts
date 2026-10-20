import type { Request, Response } from "express";
import type { Booking } from "../domain/types.js";
import type { BookingService } from "../services/booking-service.js";
import { parseAvailabilityQuery, parseBookingRequest } from "../validations/booking.js";
import { minutesToTime } from "../utils/time.js";

/** Public shape of a booking. The customer's email is never returned. */
const toBookingResponse = (booking: Booking) => ({
  id: booking.id,
  serviceId: booking.serviceId,
  professionalId: booking.professionalId,
  date: booking.date,
  startTime: minutesToTime(booking.startMinute),
  endTime: minutesToTime(booking.endMinute),
  customerName: booking.customerName,
});

export class BookingController {
  constructor(private readonly service: BookingService) {}

  listServices = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listServices());
  };

  listProfessionals = async (_req: Request, res: Response): Promise<void> => {
    res.json(await this.service.listProfessionals());
  };

  availability = async (req: Request, res: Response): Promise<void> => {
    const { serviceId, professionalId, date } = parseAvailabilityQuery(req.query);
    const times = await this.service.availability(serviceId, date, professionalId);
    res.json({ date, times });
  };

  book = async (req: Request, res: Response): Promise<void> => {
    const booking = await this.service.book(parseBookingRequest(req.body));
    res.status(201).json(toBookingResponse(booking));
  };
}
