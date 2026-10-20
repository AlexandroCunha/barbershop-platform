import type { DbPool } from "../db/pool.js";
import type { Service, ServicePatch } from "../domain/types.js";
import type { ServiceRepository } from "./types.js";

interface ServiceRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
}

const SELECT_COLUMNS = "id, name, description, price_cents, duration_minutes";

const toService = (row: ServiceRow): Service => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceCents: row.price_cents,
  durationMinutes: row.duration_minutes,
});

export class PgServiceRepository implements ServiceRepository {
  constructor(private readonly db: DbPool) {}

  async findAll(): Promise<Service[]> {
    const { rows } = await this.db.query<ServiceRow>(`SELECT ${SELECT_COLUMNS} FROM services ORDER BY id`);
    return rows.map(toService);
  }

  async findById(id: number): Promise<Service | null> {
    const { rows } = await this.db.query<ServiceRow>(`SELECT ${SELECT_COLUMNS} FROM services WHERE id = $1`, [id]);
    return rows[0] ? toService(rows[0]) : null;
  }

  /** Only the fields present in the patch change; the rest keep their values. */
  async update(id: number, patch: ServicePatch): Promise<Service | null> {
    const { rows } = await this.db.query<ServiceRow>(
      `UPDATE services SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         price_cents = COALESCE($4, price_cents),
         duration_minutes = COALESCE($5, duration_minutes)
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, patch.name ?? null, patch.description ?? null, patch.priceCents ?? null, patch.durationMinutes ?? null],
    );
    return rows[0] ? toService(rows[0]) : null;
  }
}
