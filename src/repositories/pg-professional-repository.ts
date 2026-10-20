import { AppError } from "../utils/app-error.js";
import type { DbPool } from "../db/pool.js";
import type { Professional, ProfessionalPatch } from "../domain/types.js";
import type { NewProfessional, ProfessionalRepository } from "./types.js";

interface ProfessionalRow {
  id: number;
  name: string;
  specialties: string[];
  bio: string;
  photo: string | null;
}

const COLUMNS = "id, name, specialties, bio, photo";
const UNIQUE_VIOLATION = "23505";

const toProfessional = (row: ProfessionalRow): Professional => ({
  id: row.id,
  name: row.name,
  specialties: row.specialties,
  bio: row.bio,
  photo: row.photo,
});

export class PgProfessionalRepository implements ProfessionalRepository {
  constructor(private readonly db: DbPool) {}

  async findAll(tenantId: number): Promise<Professional[]> {
    const { rows } = await this.db.query<ProfessionalRow>(
      `SELECT ${COLUMNS} FROM professionals WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY id`,
      [tenantId],
    );
    return rows.map(toProfessional);
  }

  async findById(tenantId: number, id: number): Promise<Professional | null> {
    const { rows } = await this.db.query<ProfessionalRow>(
      `SELECT ${COLUMNS} FROM professionals WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL`,
      [tenantId, id],
    );
    return rows[0] ? toProfessional(rows[0]) : null;
  }

  async create(tenantId: number, input: NewProfessional): Promise<Professional> {
    try {
      const { rows } = await this.db.query<ProfessionalRow>(
        `INSERT INTO professionals (tenant_id, name, specialties, bio)
         VALUES ($1, $2, $3, $4)
         RETURNING ${COLUMNS}`,
        [tenantId, input.name, input.specialties, input.bio],
      );
      return toProfessional(rows[0]!);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION) {
        throw new AppError(409, "A barber with this name already exists");
      }
      throw error;
    }
  }

  /** The photo is set separately because `null` means "remove it", while a missing key means "keep it". */
  async update(tenantId: number, id: number, patch: ProfessionalPatch): Promise<Professional | null> {
    const hasPhotoChange = patch.photo !== undefined;
    const { rows } = await this.db.query<ProfessionalRow>(
      `UPDATE professionals SET
         name = COALESCE($3, name),
         specialties = COALESCE($4, specialties),
         bio = COALESCE($5, bio),
         photo = CASE WHEN $6 THEN $7 ELSE photo END
       WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL
       RETURNING ${COLUMNS}`,
      [
        tenantId,
        id,
        patch.name ?? null,
        patch.specialties ?? null,
        patch.bio ?? null,
        hasPhotoChange,
        patch.photo ?? null,
      ],
    );
    return rows[0] ? toProfessional(rows[0]) : null;
  }

  async archive(tenantId: number, id: number): Promise<boolean> {
    const result = await this.db.query(
      "UPDATE professionals SET archived_at = now() WHERE tenant_id = $1 AND id = $2 AND archived_at IS NULL",
      [tenantId, id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
