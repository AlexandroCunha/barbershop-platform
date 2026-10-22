import { decoyPasswordHash, hashPassword, verifyPassword } from "../auth/passwords.js";
import type { Tenant } from "../domain/tenant.js";
import { barberWeekToApi, parseBarberWeek } from "../domain/barber-hours.js";
import type { DayHours, Day } from "../domain/business.js";
import { isUpcoming } from "../domain/upcoming-bookings.js";
import type { Professional } from "../domain/types.js";
import type {
  BarberAccount,
  BarberAccountRepository,
  BarberHoursRepository,
  BookingRepository,
  ProfessionalRepository,
  ServiceRepository,
} from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import { minuteOfDayIn, type Clock } from "../utils/clock.js";
import { minutesToTime } from "../utils/time.js";
import type { SessionService } from "./session-service.js";

/** A barber's working hours, in the shop's terms. custom is false while they follow the shop's hours. */
export interface BarberHoursView {
  custom: boolean;
  days: Record<Day, DayHours | null>;
}

/** What a barber sees of one booking: when, what and for whom. No contact details. */
export interface BarberBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  durationMinutes: number;
  customerName: string;
}

/**
 * A barber's own area. A barber signs in with a login the owner created, and sees only the
 * upcoming bookings of their own chair.
 */
export class BarberService {
  constructor(
    private readonly accounts: BarberAccountRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly services: ServiceRepository,
    private readonly bookings: BookingRepository,
    private readonly sessions: SessionService,
    private readonly clock: Clock,
    private readonly hours: BarberHoursRepository,
  ) {}

  /** A barber's hours. Without hours of their own, the shop's opening hours are shown. */
  async getHours(tenant: Tenant, professionalId: number): Promise<BarberHoursView> {
    await this.requireProfessional(tenant, professionalId);
    const week = await this.hours.findByProfessional(tenant.id, professionalId);
    return { custom: week !== null, days: barberWeekToApi(week, tenant.business.hours) };
  }

  /** Saves a barber's hours for every day. The barber and the owner both use this. */
  async saveHours(tenant: Tenant, professionalId: number, input: unknown): Promise<BarberHoursView> {
    await this.requireProfessional(tenant, professionalId);
    const week = parseBarberWeek(input, tenant.business.hours);
    await this.hours.replace(tenant.id, professionalId, week);
    return { custom: true, days: barberWeekToApi(week, tenant.business.hours) };
  }

  private async requireProfessional(tenant: Tenant, professionalId: number): Promise<Professional> {
    const professional = await this.professionals.findById(tenant.id, professionalId);
    if (!professional) {
      throw new AppError(404, "Professional not found");
    }
    return professional;
  }

  async signIn(tenant: Tenant, email: string, password: string): Promise<BarberAccount> {
    const account = await this.accounts.findByEmail(tenant.id, email);
    // The hash is checked even for an unknown email, so response time does not reveal who has a login.
    const passwordMatches = await verifyPassword(password, account?.passwordHash ?? (await decoyPasswordHash));
    if (!account || !passwordMatches) {
      throw new AppError(401, "Email or password is not correct");
    }
    return account;
  }

  openSession(tenant: Tenant, account: BarberAccount) {
    return this.sessions.openBarberSession({ tenantId: tenant.id, barberAccountId: account.id });
  }

  endSession(sessionId: string): Promise<void> {
    return this.sessions.revoke(sessionId);
  }

  async profile(tenant: Tenant, account: BarberAccount): Promise<{ id: number; name: string }> {
    const professional = await this.professionals.findById(tenant.id, account.professionalId);
    if (!professional) {
      throw new AppError(401, "Please sign in to your barber area");
    }
    return { id: professional.id, name: professional.name };
  }

  /** The barber's bookings that have not started yet, in the shop's own time zone. */
  async upcomingBookings(tenant: Tenant, account: BarberAccount): Promise<BarberBooking[]> {
    const zone = tenant.business.timeZone;
    const today = this.clock.today(zone);
    const minuteNow = minuteOfDayIn(this.clock.now(), zone);

    const [bookings, services] = await Promise.all([
      this.bookings.findFromDate(tenant.id, account.professionalId, today),
      this.services.findAll(tenant.id),
    ]);
    const serviceNames = new Map(services.map((service) => [service.id, service.name]));

    return bookings
      .filter((booking) => isUpcoming(booking, today, minuteNow))
      .map((booking) => ({
        id: booking.id,
        date: booking.date,
        startTime: minutesToTime(booking.startMinute),
        endTime: minutesToTime(booking.endMinute),
        serviceName: serviceNames.get(booking.serviceId) ?? "Service",
        durationMinutes: booking.endMinute - booking.startMinute,
        customerName: booking.customerName,
      }));
  }

  /**
   * The owner creates a barber's login, or replaces it. Any session the barber had ends at once,
   * so a replaced password takes effect immediately.
   */
  async setLogin(tenant: Tenant, professionalId: number, email: string, password: string): Promise<{ email: string }> {
    const professional = await this.requireProfessional(tenant, professionalId);
    const account = await this.accounts.upsert(tenant.id, professional.id, email, await hashPassword(password));
    await this.sessions.revokeAllForBarberAccount(account.id);
    return { email: account.email };
  }

  /** The owner removes a barber's login. The barber's sessions end with it. */
  async removeLogin(tenant: Tenant, professionalId: number): Promise<void> {
    const professional = await this.requireProfessional(tenant, professionalId);
    const existing = await this.accounts.findByProfessional(tenant.id, professional.id);
    if (!existing) {
      throw new AppError(404, "This barber has no login");
    }
    await this.accounts.remove(tenant.id, professional.id);
    await this.sessions.revokeAllForBarberAccount(existing.id);
  }
}
