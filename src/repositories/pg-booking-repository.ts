import type { PoolClient } from "pg";
import type { DbPool } from "../db/pool.js";
import type { Booking, NewBooking } from "../domain/types.js";
import { AppError } from "../utils/app-error.js";
import type { BookingRecord, BookingRepository, BookingSlot, NotificationDraft } from "./types.js";

interface BookingRow {
  id: string;
  service_id: number;
  professional_id: number;
  booking_date: string;
  start_minute: number;
  end_minute: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  created_at: Date;
  cancelled_at: Date | null;
}

const COLUMNS = `
  id, service_id, professional_id, booking_date::text AS booking_date, start_minute, end_minute,
  customer_name, customer_email, customer_phone, created_at, cancelled_at`;

const UNIQUE_VIOLATION = "23505";
/** Raised by the no-overlap constraint, which only counts bookings that have not been cancelled. */
const EXCLUSION_VIOLATION = "23P01";
const TIME_TAKEN = "That time is no longer available";

const toRecord = (row: BookingRow): BookingRecord => ({
  id: row.id,
  serviceId: row.service_id,
  professionalId: row.professional_id,
  date: row.booking_date,
  startMinute: row.start_minute,
  endMinute: row.end_minute,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  createdAt: row.created_at,
  cancelledAt: row.cancelled_at,
});

const toBooking = (row: BookingRow): Booking => {
  const { cancelledAt: _cancelledAt, ...booking } = toRecord(row);
  return booking;
};

export class PgBookingRepository implements BookingRepository {
  constructor(private readonly db: DbPool) {}

  async findByDate(tenantId: number, isoDate: string): Promise<Booking[]> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
       WHERE tenant_id = $1 AND booking_date = $2 AND cancelled_at IS NULL
       ORDER BY professional_id, start_minute`,
      [tenantId, isoDate],
    );
    return rows.map(toBooking);
  }

  async findUpcoming(tenantId: number, fromIsoDate: string, limit: number): Promise<Booking[]> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
       WHERE tenant_id = $1 AND booking_date >= $2 AND cancelled_at IS NULL
       ORDER BY booking_date, start_minute
       LIMIT $3`,
      [tenantId, fromIsoDate, limit],
    );
    return rows.map(toBooking);
  }

  async findFromDate(tenantId: number, professionalId: number, fromIsoDate: string): Promise<Booking[]> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
       WHERE tenant_id = $1 AND professional_id = $2 AND booking_date >= $3 AND cancelled_at IS NULL
       ORDER BY booking_date, start_minute`,
      [tenantId, professionalId, fromIsoDate],
    );
    return rows.map(toBooking);
  }

  async findById(tenantId: number, id: string): Promise<BookingRecord | null> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async create(tenantId: number, booking: NewBooking, messagesFor: (id: string) => NotificationDraft[]): Promise<Booking> {
    return this.inTransaction(async (client) => {
      const saved = await insertBooking(client, tenantId, booking);
      await enqueue(client, tenantId, saved.id, messagesFor(saved.id));
      return saved;
    });
  }

  async cancel(tenantId: number, id: string, at: Date, messages: NotificationDraft[]): Promise<boolean> {
    return this.inTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE bookings SET cancelled_at = $3
         WHERE tenant_id = $1 AND id = $2 AND cancelled_at IS NULL`,
        [tenantId, id, at],
      );
      if (!rowCount) return false;

      await dropUnsentReminder(client, id);
      await enqueue(client, tenantId, id, messages);
      return true;
    });
  }

  async move(tenantId: number, id: string, slot: BookingSlot, messages: NotificationDraft[]): Promise<boolean> {
    return this.inTransaction(async (client) => {
      try {
        const { rowCount } = await client.query(
          `UPDATE bookings SET booking_date = $3, start_minute = $4, end_minute = $5
           WHERE tenant_id = $1 AND id = $2 AND cancelled_at IS NULL`,
          [tenantId, id, slot.date, slot.startMinute, slot.endMinute],
        );
        if (!rowCount) return false;
      } catch (error) {
        if (isTimeTaken(error)) throw new AppError(409, TIME_TAKEN);
        throw error;
      }

      await dropUnsentReminder(client, id);
      await enqueue(client, tenantId, id, messages);
      return true;
    });
  }

  /** Runs the work in one transaction: either every change and its messages are stored, or none is. */
  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function insertBooking(client: PoolClient, tenantId: number, booking: NewBooking): Promise<Booking> {
  try {
    const { rows } = await client.query<BookingRow>(
      `INSERT INTO bookings
         (tenant_id, service_id, professional_id, booking_date, start_minute, end_minute,
          customer_name, customer_email, customer_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${COLUMNS}`,
      [
        tenantId,
        booking.serviceId,
        booking.professionalId,
        booking.date,
        booking.startMinute,
        booking.endMinute,
        booking.customerName,
        booking.customerEmail,
        booking.customerPhone,
      ],
    );
    return toBooking(rows[0]!);
  } catch (error) {
    if (isTimeTaken(error)) throw new AppError(409, TIME_TAKEN);
    throw error;
  }
}

function isTimeTaken(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  return code === UNIQUE_VIOLATION || code === EXCLUSION_VIOLATION;
}

/** A reminder that has not gone out yet is for the old time, so it is withdrawn when the booking changes. */
async function dropUnsentReminder(client: PoolClient, bookingId: string): Promise<void> {
  await client.query(
    `DELETE FROM notifications
     WHERE booking_id = $1 AND kind = 'reminder' AND sent_at IS NULL AND failed_at IS NULL`,
    [bookingId],
  );
}

async function enqueue(client: PoolClient, tenantId: number, bookingId: string, messages: NotificationDraft[]): Promise<void> {
  for (const message of messages) {
    // A confirmation or reminder is queued once per booking; a repeat is ignored, not an error.
    await client.query(
      `INSERT INTO notifications (tenant_id, booking_id, kind, to_address, subject, body, html, send_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [tenantId, bookingId, message.kind, message.toAddress, message.subject, message.body, message.html, message.sendAt],
    );
  }
}
