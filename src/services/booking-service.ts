import { availableStartMinutes } from "../domain/availability.js";
import { allowsBookings, licenseInfo, type Tenant } from "../domain/tenant.js";
import { openingHoursFor } from "../domain/opening-hours.js";
import type { Booking, Professional, Service } from "../domain/types.js";
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
  now(): Date;
  /** Today's date in the given time zone, as YYYY-MM-DD. */
  today(timeZone: string): string;
}

/**
 * The booking rules for one barbershop at a time. Each call receives the shop
 * (tenant), so its hours, time zone and license are always the right ones.
 */
export class BookingService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
  ) {}

  listServices(tenant: Tenant): Promise<Service[]> {
    return this.services.findAll(tenant.id);
  }

  listProfessionals(tenant: Tenant): Promise<Professional[]> {
    return this.professionals.findAll(tenant.id);
  }

  async availability(tenant: Tenant, serviceId: number, date: string, professionalId?: number): Promise<string[]> {
    this.requireBookingsOpen(tenant);
    const service = await this.requireService(tenant, serviceId);
    this.assertNotPast(tenant, date);

    const starts = new Set<number>();
    for (const professional of await this.candidates(tenant, professionalId)) {
      for (const start of await this.freeStarts(tenant, service, professional.id, date)) {
        starts.add(start);
      }
    }

    return [...starts].sort((a, b) => a - b).map(minutesToTime);
  }

  async book(tenant: Tenant, request: BookingRequest): Promise<Booking> {
    this.requireBookingsOpen(tenant);
    const service = await this.requireService(tenant, request.serviceId);
    this.assertNotPast(tenant, request.date);

    for (const professional of await this.candidates(tenant, request.professionalId)) {
      const starts = await this.freeStarts(tenant, service, professional.id, request.date);
      if (!starts.includes(request.startMinute)) {
        continue;
      }

      try {
        return await this.bookings.create(tenant.id, {
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

  private requireBookingsOpen(tenant: Tenant): void {
    const { state } = licenseInfo(tenant, this.clock.now());
    if (!allowsBookings(state)) {
      throw new AppError(403, "Online booking is not available for this barbershop right now. Please call the shop.");
    }
  }

  /** The chosen barber only, or every barber when no preference was given. */
  private async candidates(tenant: Tenant, professionalId?: number): Promise<Professional[]> {
    if (professionalId === undefined) {
      return this.professionals.findAll(tenant.id);
    }
    const professional = await this.professionals.findById(tenant.id, professionalId);
    if (!professional) {
      throw new AppError(404, "Professional not found");
    }
    return [professional];
  }

  private async freeStarts(tenant: Tenant, service: Service, professionalId: number, date: string): Promise<number[]> {
    const existing = await this.bookings.findByProfessionalAndDate(tenant.id, professionalId, date);

    return availableStartMinutes({
      window: openingHoursFor(tenant.business.hours, date),
      durationMinutes: service.durationMinutes,
      busy: existing.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })),
    });
  }

  private async requireService(tenant: Tenant, id: number): Promise<Service> {
    const service = await this.services.findById(tenant.id, id);
    if (!service) {
      throw new AppError(404, "Service not found");
    }
    return service;
  }

  private assertNotPast(tenant: Tenant, date: string): void {
    // ISO dates compare correctly as strings.
    if (date < this.clock.today(tenant.business.timeZone)) {
      throw new AppError(400, "Date is in the past");
    }
  }
}
