import { AppError } from "../utils/app-error.js";
import type { DbPool } from "../db/pool.js";
import type { Service, ServicePatch } from "../domain/types.js";
import type { NewService, ServiceRepository } from "./types.js";

interface ServiceRow {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
}

const COLUMNS = "id, name, description, price_cents, duration_minutes";
const UNIQUE_VIOLATION = "23505";

const toService = (row: ServiceRow): Service => ({
  id: row.id,
  name: row.name,
  description: row.description,
  priceCents: row.price_cents,
  durationMinutes: row.duration_minutes,
});

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION;

/** Every query filters by tenant_id, so one shop can never read or change another shop's services. */
export class PgServiceRepository implements ServiceRepository {
  constructor(private readonly db: DbPool) {}

  async findAll(tenantId: number): Promise<Service[]> {
    const { rows } = await this.db.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM services WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY id`,
      [tenantId],
    );
    return rows.map(toService);
  }

  async findById(tenantId: number, id: number): Promise<Service | null> {
    const { rows } = await this.db.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM services WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL`,
      [tenantId, id],
    );
    return rows[0] ? toService(rows[0]) : null;
  }

  async create(tenantId: number, input: NewService): Promise<Service> {
    try {
      const { rows } = await this.db.query<ServiceRow>(
        `INSERT INTO services (tenant_id, name, description, price_cents, duration_minutes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [tenantId, input.name, input.description, input.priceCents, input.durationMinutes],
      );
      return toService(rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError(409, "A service with this name already exists");
      }
      throw error;
    }
  }

  /** Only the fields present in the patch change. */
  async update(tenantId: number, id: number, patch: ServicePatch): Promise<Service | null> {
    const { rows } = await this.db.query<ServiceRow>(
      `UPDATE services SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         price_cents = COALESCE($5, price_cents),
         duration_minutes = COALESCE($6, duration_minutes)
       WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL
       RETURNING ${COLUMNS}`,
      [tenantId, id, patch.name ?? null, patch.description ?? null, patch.priceCents ?? null, patch.durationMinutes ?? null],
    );
    return rows[0] ? toService(rows[0]) : null;
  }

  async archive(tenantId: number, id: number): Promise<boolean> {
    const result = await this.db.query(
      "UPDATE services SET archived_at = now() WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL",
      [tenantId, id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
