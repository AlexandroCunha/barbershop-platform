import { availableStartMinutes, type BusyPeriod } from "../domain/availability.js";
import { barberWindow } from "../domain/barber-hours.js";
import { allowsBookings, licenseInfo, type Tenant } from "../domain/tenant.js";
import type { TimeWindow } from "../domain/opening-hours.js";
import type { Booking, Professional, Service } from "../domain/types.js";
import type {
  BarberHoursRepository,
  BookingRepository,
  ProfessionalRepository,
  ServiceRepository,
} from "../repositories/types.js";
import { isUpcoming } from "../domain/upcoming-bookings.js";
import { AppError } from "../utils/app-error.js";
import { minuteOfDayIn, type Clock } from "../utils/clock.js";
import { minutesToTime } from "../utils/time.js";

/** One booking as the owner's list shows it, with the barber's name and the customer's contact details. */
export interface OwnerBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  professionalId: number;
  professionalName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/** The owner's list shows this many upcoming bookings at most. */
const OWNER_LIST_LIMIT = 200;

/** The start times one barber has free for a service on a date. */
export interface BarberTimes {
  professionalId: number;
  times: string[];
}

export interface BookingRequest {
  serviceId: number;
  /** The customer chooses the barber, either before the time or after it. */
  professionalId: number;
  date: string;
  startMinute: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/**
 * The booking rules for one barbershop at a time. Each call receives the shop
 * (tenant), so its hours, time zone and license are always the right ones.
 * Each barber's own working hours apply to their chair; a barber without hours of
 * their own follows the shop's opening hours.
 */
export class BookingService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
    private readonly hours: BarberHoursRepository,
  ) {}

  listServices(tenant: Tenant): Promise<Service[]> {
    return this.services.findAll(tenant.id);
  }

  listProfessionals(tenant: Tenant): Promise<Professional[]> {
    return this.professionals.findAll(tenant.id);
  }

  /** Each candidate barber's free start times on the date. One barber when the customer has chosen. */
  async availability(tenant: Tenant, serviceId: number, date: string, professionalId?: number): Promise<BarberTimes[]> {
    this.requireBookingsOpen(tenant);
    const service = await this.requireService(tenant, serviceId);
    this.assertNotPast(tenant, date);

    const busy = await this.busyByProfessional(tenant, date);

    const barbers: BarberTimes[] = [];
    for (const professional of await this.candidates(tenant, professionalId)) {
      const window = await this.windowFor(tenant, professional.id, date);
      const starts = freeStarts(window, service, busy.get(professional.id));
      barbers.push({ professionalId: professional.id, times: starts.map(minutesToTime) });
    }
    return barbers;
  }

  /** The shop's upcoming bookings across every barber, for the owner's list. */
  async upcomingForOwner(tenant: Tenant): Promise<OwnerBooking[]> {
    const zone = tenant.business.timeZone;
    const today = this.clock.today(zone);
    const minuteNow = minuteOfDayIn(this.clock.now(), zone);

    const [bookings, services, professionals] = await Promise.all([
      this.bookings.findUpcoming(tenant.id, today, OWNER_LIST_LIMIT),
      this.services.findAll(tenant.id),
      this.professionals.findAll(tenant.id),
    ]);
    const serviceNames = new Map(services.map((service) => [service.id, service.name]));
    const barberNames = new Map(professionals.map((professional) => [professional.id, professional.name]));

    return bookings
      .filter((booking) => isUpcoming(booking, today, minuteNow))
      .map((booking) => ({
        id: booking.id,
        date: booking.date,
        startTime: minutesToTime(booking.startMinute),
        endTime: minutesToTime(booking.endMinute),
        serviceName: serviceNames.get(booking.serviceId) ?? "Service",
        professionalId: booking.professionalId,
        professionalName: barberNames.get(booking.professionalId) ?? "Barber",
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
      }));
  }

  async book(tenant: Tenant, request: BookingRequest): Promise<Booking> {
    this.requireBookingsOpen(tenant);
    const service = await this.requireService(tenant, request.serviceId);
    this.assertNotPast(tenant, request.date);

    const professional = await this.requireProfessional(tenant, request.professionalId);
    const window = await this.windowFor(tenant, professional.id, request.date);
    const busy = await this.busyByProfessional(tenant, request.date);
    if (!freeStarts(window, service, busy.get(professional.id)).includes(request.startMinute)) {
      throw new AppError(409, "That time is no longer available");
    }

    // Two customers can still race for the same chair; the database's no-overlap rule refuses the second.
    return this.bookings.create(tenant.id, {
      serviceId: service.id,
      professionalId: professional.id,
      date: request.date,
      startMinute: request.startMinute,
      endMinute: request.startMinute + service.durationMinutes,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone,
    });
  }

  private requireBookingsOpen(tenant: Tenant): void {
    const { state } = licenseInfo(tenant, this.clock.now());
    if (!allowsBookings(state)) {
      throw new AppError(403, "Online booking is not available for this barbershop right now. Please call the shop.");
    }
  }

  /** The chosen barber only, or every barber when none has been chosen yet. */
  private async candidates(tenant: Tenant, professionalId?: number): Promise<Professional[]> {
    if (professionalId === undefined) {
      return this.professionals.findAll(tenant.id);
    }
    return [await this.requireProfessional(tenant, professionalId)];
  }

  private async requireProfessional(tenant: Tenant, id: number): Promise<Professional> {
    const professional = await this.professionals.findById(tenant.id, id);
    if (!professional) {
      throw new AppError(404, "Professional not found");
    }
    return professional;
  }

  /** The hours one barber takes bookings in on a date, or null on a day off. */
  private async windowFor(tenant: Tenant, professionalId: number, isoDate: string): Promise<TimeWindow | null> {
    return barberWindow(tenant.business.hours, await this.hours.findByProfessional(tenant.id, professionalId), isoDate);
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
