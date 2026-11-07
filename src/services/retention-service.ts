import type { RetentionRepository } from "../repositories/types.js";
import type { Clock } from "../utils/clock.js";

/**
 * Keeps customer details only as long as they are useful (GDPR art. 5(1)(e)): once an appointment is
 * older than the retention period, the name, e-mail and phone are removed from the booking.
 */
export class RetentionService {
  constructor(
    private readonly bookings: RetentionRepository,
    private readonly clock: Clock,
    private readonly months: number,
  ) {}

  /** The first date still kept, as YYYY-MM-DD. Bookings dated before it are anonymised. */
  cutoffDate(): string {
    const now = this.clock.now();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - this.months, 1));
    const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(now.getUTCDate(), lastDayOfTargetMonth));
    return target.toISOString().slice(0, 10);
  }

  /** Anonymises old bookings and returns how many were changed. Does nothing when retention is off (0 months). */
  async run(): Promise<number> {
    if (this.months <= 0) return 0;
    return this.bookings.anonymiseBookingsBefore(this.cutoffDate());
  }
}
