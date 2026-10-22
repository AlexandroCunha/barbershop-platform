import type { DbPool } from "../db/pool.js";
import { DAYS } from "../domain/business.js";
import type { BarberWeek } from "../domain/barber-hours.js";
import type { BarberHoursRepository } from "./types.js";

interface HoursRow {
  weekday: number;
  open_minute: number | null;
  close_minute: number | null;
}

export class PgBarberHoursRepository implements BarberHoursRepository {
  constructor(private readonly db: DbPool) {}

  async findByProfessional(tenantId: number, professionalId: number): Promise<BarberWeek | null> {
    const { rows } = await this.db.query<HoursRow>(
      `SELECT h.weekday, h.open_minute, h.close_minute
       FROM barber_hours h
       JOIN professionals p ON p.id = h.professional_id
       WHERE p.tenant_id = $1 AND h.professional_id = $2`,
      [tenantId, professionalId],
    );
    if (rows.length === 0) return null;

    const week = {} as BarberWeek;
    for (const [index, day] of DAYS.entries()) {
      const row = rows.find((candidate) => candidate.weekday === index);
      week[day] =
        row && row.open_minute !== null && row.close_minute !== null
          ? { openMinute: row.open_minute, closeMinute: row.close_minute }
          : null;
    }
    return week;
  }

  async replace(tenantId: number, professionalId: number, week: BarberWeek): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM barber_hours
         WHERE professional_id = $1
           AND professional_id IN (SELECT id FROM professionals WHERE tenant_id = $2)`,
        [professionalId, tenantId],
      );
      for (const [index, day] of DAYS.entries()) {
        const window = week[day];
        await client.query(
          `INSERT INTO barber_hours (professional_id, weekday, open_minute, close_minute) VALUES ($1, $2, $3, $4)`,
          [professionalId, index, window?.openMinute ?? null, window?.closeMinute ?? null],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
