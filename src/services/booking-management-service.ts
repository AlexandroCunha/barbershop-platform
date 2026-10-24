import type { Tenant } from "../domain/tenant.js";
import type { BookingRecord, BookingRepository, ProfessionalRepository, ServiceRepository } from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { minutesToTime } from "../utils/time.js";
import { instantOf } from "../utils/zoned-time.js";
import { BookingMessages, type BookingFacts } from "./booking-messages.js";
import type { BookingService } from "./booking-service.js";

/** Who is changing a booking. A barber can act only on the chair they work in. */
export type BookingActor = { kind: "customer" } | { kind: "barber"; professionalId: number } | { kind: "owner" };

export type BookingStatus = "upcoming" | "started" | "cancelled";

/** A booking as the customer's own page shows it. */
export interface BookingView {
  id: string;
  serviceId: number;
  professionalId: number;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  barberName: string;
  status: BookingStatus;
}

export interface SlotChange {
  date: string;
  startMinute: number;
}

/**
 * Cancelling and moving a booking, for the customer, the barber and the owner alike. Only a booking that
 * has not started can change. A move keeps the same barber; to change barber the customer books again.
 */
export class BookingManagementService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly services: ServiceRepository,
    private readonly professionals: ProfessionalRepository,
    private readonly slots: BookingService,
    private readonly messages: BookingMessages,
    private readonly clock: Clock,
  ) {}

  /** The booking as the customer sees it. The link is the only proof needed, so nothing else is shown. */
  async viewForCustomer(tenant: Tenant, bookingId: string): Promise<BookingView> {
    const booking = await this.findOrFail(tenant, bookingId);
    const [service, professional] = await Promise.all([
      this.services.findById(tenant.id, booking.serviceId),
      this.professionals.findById(tenant.id, booking.professionalId),
    ]);
    return {
      id: booking.id,
      serviceId: booking.serviceId,
      professionalId: booking.professionalId,
      date: booking.date,
      startTime: minutesToTime(booking.startMinute),
      endTime: minutesToTime(booking.endMinute),
      serviceName: service?.name ?? "Service",
      barberName: professional?.name ?? "Barber",
      status: this.statusOf(tenant, booking),
    };
  }

  async cancel(tenant: Tenant, bookingId: string, actor: BookingActor): Promise<void> {
    const booking = await this.changeable(tenant, bookingId, actor);
    const facts = await this.factsFor(tenant, booking, {
      date: booking.date,
      startMinute: booking.startMinute,
      endMinute: booking.endMinute,
    });

    const cancelled = await this.bookings.cancel(
      tenant.id,
      booking.id,
      this.clock.now(),
      this.messages.cancelled(facts, booking.id),
    );
    if (!cancelled) {
      throw new AppError(409, "This booking was already cancelled");
    }
  }

  async move(tenant: Tenant, bookingId: string, actor: BookingActor, change: SlotChange): Promise<void> {
    const booking = await this.changeable(tenant, bookingId, actor);
    this.slots.assertCanBook(tenant, change.date);

    const service = await this.slots.requireService(tenant, booking.serviceId);
    // The booking's own time does not count as taken, so a customer can nudge it by a few minutes.
    await this.slots.assertSlotFree(tenant, service, booking.professionalId, change.date, change.startMinute, booking.id);

    const endMinute = change.startMinute + service.durationMinutes;
    const facts = await this.factsFor(tenant, booking, {
      date: change.date,
      startMinute: change.startMinute,
      endMinute,
    });
    const moved = await this.bookings.move(
      tenant.id,
      booking.id,
      { date: change.date, startMinute: change.startMinute, endMinute },
      this.messages.moved(facts, booking.id),
    );
    if (!moved) {
      throw new AppError(409, "This booking can no longer be moved");
    }
  }

  /** The booking if this actor may change it and it can still change. Otherwise a clear reason. */
  private async changeable(tenant: Tenant, bookingId: string, actor: BookingActor): Promise<BookingRecord> {
    const booking = await this.findOrFail(tenant, bookingId);
    // A barber asking about another barber's booking gets "not found", so the id reveals nothing.
    if (actor.kind === "barber" && booking.professionalId !== actor.professionalId) {
      throw new AppError(404, "Booking not found");
    }
    const status = this.statusOf(tenant, booking);
    if (status === "cancelled") throw new AppError(409, "This booking was cancelled");
    if (status === "started") throw new AppError(409, "This appointment has already started");
    return booking;
  }

  private async findOrFail(tenant: Tenant, bookingId: string): Promise<BookingRecord> {
    const booking = await this.bookings.findById(tenant.id, bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found");
    }
    return booking;
  }

  private statusOf(tenant: Tenant, booking: BookingRecord): BookingStatus {
    if (booking.cancelledAt) return "cancelled";
    const start = instantOf(booking.date, booking.startMinute, tenant.business.timeZone);
    return start <= this.clock.now() ? "started" : "upcoming";
  }

  private async factsFor(
    tenant: Tenant,
    booking: BookingRecord,
    when: { date: string; startMinute: number; endMinute: number },
  ): Promise<BookingFacts> {
    const [service, professional] = await Promise.all([
      this.services.findById(tenant.id, booking.serviceId),
      this.professionals.findById(tenant.id, booking.professionalId),
    ]);
    return {
      tenant,
      serviceName: service?.name ?? "Service",
      barberName: professional?.name ?? "Barber",
      date: when.date,
      startMinute: when.startMinute,
      endMinute: when.endMinute,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
    };
  }
}
