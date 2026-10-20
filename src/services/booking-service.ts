import { availableStartMinutes } from "../domain/availability.js";
import type { Booking, Professional, Service } from "../domain/types.js";
import { openingHoursFor } from "../domain/opening-hours.js";
import type { BusinessProvider } from "../content/business-store.js";
import type {
  BookingRepository,
  ProfessionalRepository,
  ServiceRepository,
} from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import { minutesToTime } from "../utils/time.js";

export interface BookingRequest {
  serviceId: number;
  /** Optional: when omitted, any free barber may take the booking. */
  professionalId?: number;
  date: string;
  startMinute: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface Clock {
  /** Today's date in the given time zone, as YYYY-MM-DD. */
  today(timeZone: string): string;
}

/**
 * Orchestrates the booking rules. Opening hours and the shop's time zone come
 * from the business settings. It knows nothing about HTTP or SQL.
 */
export class BookingService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly bookings: BookingRepository,
    private readonly business: BusinessProvider,
    private readonly clock: Clock,
  ) {}

  listServices(): Promise<Service[]> {
    return this.services.findAll();
  }

  listProfessionals(): Promise<Professional[]> {
    return this.professionals.findAll();
  }

  async availability(serviceId: number, date: string, professionalId?: number): Promise<string[]> {
    const service = await this.requireService(serviceId);
    await this.assertNotPast(date);

    const starts = new Set<number>();
    for (const professional of await this.candidates(professionalId)) {
      for (const start of await this.freeStarts(service, professional.id, date)) {
        starts.add(start);
      }
    }

    return [...starts].sort((a, b) => a - b).map(minutesToTime);
  }

  async book(request: BookingRequest): Promise<Booking> {
    const service = await this.requireService(request.serviceId);
    await this.assertNotPast(request.date);

    for (const professional of await this.candidates(request.professionalId)) {
      const starts = await this.freeStarts(service, professional.id, request.date);
      if (!starts.includes(request.startMinute)) {
        continue;
      }

      try {
        return await this.bookings.create({
          serviceId: service.id,
          professionalId: professional.id,
          date: request.date,
          startMinute: request.startMinute,
          endMinute: request.startMinute + service.durationMinutes,
          customerName: request.customerName,
          customerEmail: request.customerEmail,
          customerPhone: request.customerPhone,
        });
      } catch (error) {
        // Lost a race for this chair. Try the next candidate, if any.
        if (error instanceof AppError && error.status === 409) {
          continue;
        }
        throw error;
      }
    }

    throw new AppError(409, "That time is no longer available");
  }

  /** The chosen barber only, or every barber when no preference was given. */
  private async candidates(professionalId?: number): Promise<Professional[]> {
    if (professionalId === undefined) {
      return this.professionals.findAll();
    }
    return [await this.requireProfessional(professionalId)];
  }

  private async freeStarts(service: Service, professionalId: number, date: string): Promise<number[]> {
    const business = await this.business.read();
    const existing = await this.bookings.findByProfessionalAndDate(professionalId, date);

    return availableStartMinutes({
      window: openingHoursFor(business.hours, date),
      durationMinutes: service.durationMinutes,
      busy: existing.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })),
    });
  }

  private async requireService(id: number): Promise<Service> {
    const service = await this.services.findById(id);
    if (!service) {
      throw new AppError(404, "Service not found");
    }
    return service;
  }

  private async requireProfessional(id: number): Promise<Professional> {
    const professional = await this.professionals.findById(id);
    if (!professional) {
      throw new AppError(404, "Professional not found");
    }
    return professional;
  }

  private async assertNotPast(date: string): Promise<void> {
    const business = await this.business.read();
    // ISO dates compare correctly as strings.
    if (date < this.clock.today(business.timeZone)) {
      throw new AppError(400, "Date is in the past");
    }
  }
}
