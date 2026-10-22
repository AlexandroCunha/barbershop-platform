import type { DbPool } from "../db/pool.js";
import type { Booking, NewBooking } from "../domain/types.js";
import { AppError } from "../utils/app-error.js";
import type { BookingRepository } from "./types.js";

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
}

const COLUMNS = `
  id, service_id, professional_id, booking_date::text AS booking_date, start_minute, end_minute,
  customer_name, customer_email, customer_phone, created_at`;

const UNIQUE_VIOLATION = "23505";
/** Raised by the no-overlap constraint in migration 003. */
const EXCLUSION_VIOLATION = "23P01";

const toBooking = (row: BookingRow): Booking => ({
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
});

export class PgBookingRepository implements BookingRepository {
  constructor(private readonly db: DbPool) {}

  async findByDate(tenantId: number, isoDate: string): Promise<Booking[]> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
       WHERE tenant_id = $1 AND booking_date = $2
       ORDER BY professional_id, start_minute`,
      [tenantId, isoDate],
    );
    return rows.map(toBooking);
  }

  async findUpcoming(tenantId: number, fromIsoDate: string, limit: number): Promise<Booking[]> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
       WHERE tenant_id = $1 AND booking_date >= $2
       ORDER BY booking_date, start_minute
       LIMIT $3`,
      [tenantId, fromIsoDate, limit],
    );
    return rows.map(toBooking);
  }

  async findFromDate(tenantId: number, professionalId: number, fromIsoDate: string): Promise<Booking[]> {
    const { rows } = await this.db.query<BookingRow>(
      `SELECT ${COLUMNS} FROM bookings
       WHERE tenant_id = $1 AND professional_id = $2 AND booking_date >= $3
       ORDER BY booking_date, start_minute`,
      [tenantId, professionalId, fromIsoDate],
    );
    return rows.map(toBooking);
  }

  async create(tenantId: number, booking: NewBooking): Promise<Booking> {
    try {
      const { rows } = await this.db.query<BookingRow>(
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
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === UNIQUE_VIOLATION || code === EXCLUSION_VIOLATION) {
        throw new AppError(409, "That time is no longer available");
      }
      throw error;
    }
  }
}
