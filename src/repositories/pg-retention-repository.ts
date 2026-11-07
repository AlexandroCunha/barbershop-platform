import type { DbPool } from "../db/pool.js";
import type { RetentionRepository } from "./types.js";

/** What an anonymised booking shows instead of the customer's name. */
export const ANONYMISED_NAME = "Anonymised";

export class PgRetentionRepository implements RetentionRepository {
  constructor(private readonly db: DbPool) {}

  async anonymiseBookingsBefore(cutoff: string): Promise<number> {
    // Queued messages carry the customer's address and name, so they are removed first.
    await this.db.query(
      `DELETE FROM notifications
       WHERE booking_id IN (SELECT id FROM bookings WHERE booking_date < $1::date)`,
      [cutoff],
    );
    const result = await this.db.query(
      `UPDATE bookings
       SET customer_name = $2, customer_email = '', customer_phone = ''
       WHERE booking_date < $1::date
         AND (customer_name <> $2 OR customer_email <> '' OR customer_phone <> '')`,
      [cutoff, ANONYMISED_NAME],
    );
    return result.rowCount ?? 0;
  }
}
