import { issueManageToken } from "../auth/manage-token.js";
import {
  barberBookingMail,
  cancellationMail,
  confirmationMail,
  movedMail,
  reminderMail,
  type BookingMailDetails,
  type MailContent,
} from "../domain/booking-mail.js";
import type { Tenant } from "../domain/tenant.js";
import type { NotificationDraft, NotificationKind } from "../repositories/types.js";
import type { Clock } from "../utils/clock.js";
import { minutesToTime } from "../utils/time.js";
import { instantOf } from "../utils/zoned-time.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long a customer's link to their booking keeps working. */
const MANAGE_LINK_DAYS = 120;

/** What the e-mails say about one booking. */
export interface BookingFacts {
  tenant: Tenant;
  serviceName: string;
  barberName: string;
  date: string;
  startMinute: number;
  endMinute: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface BookingMessageConfig {
  secret: string;
  publicUrl: string;
  /** False when no mail is sent on this server. Then nothing is queued either. */
  enabled: boolean;
}

/**
 * Writes the e-mails for a booking's life: the confirmation, the reminder, a cancellation and a move.
 * Each method returns the messages to store with the change; the repository writes them in the same
 * transaction, so a message exists exactly when its change does.
 */
export class BookingMessages {
  constructor(
    private readonly config: BookingMessageConfig,
    private readonly clock: Clock,
  ) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * A confirmation to the customer now, a reminder the day before the start when that is still ahead, and,
   * when the barber has a login with an e-mail address, a note to the barber about the new booking.
   */
  created(facts: BookingFacts, bookingId: string, barberEmail: string | null): NotificationDraft[] {
    if (!this.config.enabled) return [];
    const now = this.clock.now();
    const drafts = [
      this.draft("confirmation", facts, confirmationMail(this.details(facts, bookingId)), now),
      ...this.reminderIfAhead(facts, bookingId),
    ];
    if (barberEmail) {
      const note = barberBookingMail(this.barberDetails(facts));
      drafts.push({ kind: "barber-booking", toAddress: barberEmail, subject: note.subject, body: note.text, sendAt: now });
    }
    return drafts;
  }

  private barberDetails(facts: BookingFacts) {
    return {
      shopName: facts.tenant.business.name,
      barberName: facts.barberName,
      serviceName: facts.serviceName,
      date: facts.date,
      startTime: minutesToTime(facts.startMinute),
      endTime: minutesToTime(facts.endMinute),
      customerName: facts.customerName,
      customerEmail: facts.customerEmail,
      customerPhone: facts.customerPhone,
      agendaUrl: `${this.config.publicUrl}/${facts.tenant.slug}/barber`,
    };
  }

  cancelled(facts: BookingFacts, bookingId: string): NotificationDraft[] {
    if (!this.config.enabled) return [];
    return [this.draft("cancellation", facts, cancellationMail(this.details(facts, bookingId)), this.clock.now())];
  }

  /** A move tells the customer, and brings the reminder to the new time. */
  moved(facts: BookingFacts, bookingId: string): NotificationDraft[] {
    if (!this.config.enabled) return [];
    return [
      this.draft("moved", facts, movedMail(this.details(facts, bookingId)), this.clock.now()),
      ...this.reminderIfAhead(facts, bookingId),
    ];
  }

  private reminderIfAhead(facts: BookingFacts, bookingId: string): NotificationDraft[] {
    const now = this.clock.now();
    const start = instantOf(facts.date, facts.startMinute, facts.tenant.business.timeZone);
    const sendAt = new Date(start.getTime() - DAY_MS);
    return sendAt > now ? [this.draft("reminder", facts, reminderMail(this.details(facts, bookingId)), sendAt)] : [];
  }

  private draft(kind: NotificationKind, facts: BookingFacts, content: MailContent, sendAt: Date): NotificationDraft {
    return { kind, toAddress: facts.customerEmail, subject: content.subject, body: content.text, sendAt };
  }

  private details(facts: BookingFacts, bookingId: string): BookingMailDetails {
    const { tenant } = facts;
    const shopUrl = `${this.config.publicUrl}/${tenant.slug}`;
    const expiresAt = new Date(this.clock.now().getTime() + MANAGE_LINK_DAYS * DAY_MS);
    const token = issueManageToken(this.config.secret, { tenantId: tenant.id, bookingId }, expiresAt);

    return {
      shopName: tenant.business.name,
      serviceName: facts.serviceName,
      barberName: facts.barberName,
      date: facts.date,
      startTime: minutesToTime(facts.startMinute),
      endTime: minutesToTime(facts.endMinute),
      customerName: facts.customerName,
      manageUrl: `${shopUrl}/reserva?token=${token}`,
      shopUrl,
    };
  }
}
