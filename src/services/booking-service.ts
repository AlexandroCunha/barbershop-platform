import { availableStartMinutes, type BusyPeriod } from "../domain/availability.js";
import { allowsBookings, licenseInfo, type Tenant } from "../domain/tenant.js";
import { openingHoursFor, type TimeWindow } from "../domain/opening-hours.js";
import type { Booking, Professional, Service } from "../domain/types.js";
import type { BookingRepository, ProfessionalRepository, ServiceRepository } from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
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

    const window = openingHoursFor(tenant.business.hours, date);
    const busy = await this.busyByProfessional(tenant, date);

    const starts = new Set<number>();
    for (const professional of await this.candidates(tenant, professionalId)) {
      for (const start of freeStarts(window, service, busy.get(professional.id))) {
        starts.add(start);
      }
    }

    return [...starts].sort((a, b) => a - b).map(minutesToTime);
  }

  async book(tenant: Tenant, request: BookingRequest): Promise<Booking> {
    this.requireBookingsOpen(tenant);
    const service = await this.requireService(tenant, request.serviceId);
    this.assertNotPast(tenant, request.date);

    const window = openingHoursFor(tenant.business.hours, request.date);
    const busy = await this.busyByProfessional(tenant, request.date);

    for (const professional of await this.candidates(tenant, request.professionalId)) {
      const starts = freeStarts(window, service, busy.get(professional.id));
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

  /** Every booking on the date, grouped by barber. One query, however many barbers there are. */
  private async busyByProfessional(tenant: Tenant, isoDate: string): Promise<Map<number, BusyPeriod[]>> {
    const busy = new Map<number, BusyPeriod[]>();
    for (const booking of await this.bookings.findByDate(tenant.id, isoDate)) {
      const periods = busy.get(booking.professionalId) ?? [];
      periods.push({ startMinute: booking.startMinute, endMinute: booking.endMinute });
      busy.set(booking.professionalId, periods);
    }
    return busy;
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

function freeStarts(window: TimeWindow | null, service: Service, busy: BusyPeriod[] = []): number[] {
  return availableStartMinutes({ window, durationMinutes: service.durationMinutes, busy });
}
