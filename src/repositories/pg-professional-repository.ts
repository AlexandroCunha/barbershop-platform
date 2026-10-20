import type { DbPool } from "../db/pool.js";
import type { Professional, ProfessionalPatch } from "../domain/types.js";
import type { ProfessionalRepository } from "./types.js";

interface ProfessionalRow {
  id: number;
  name: string;
  specialties: string[];
  bio: string;
  photo: string | null;
}

const SELECT_COLUMNS = "id, name, specialties, bio, photo";

const toProfessional = (row: ProfessionalRow): Professional => ({
  id: row.id,
  name: row.name,
  specialties: row.specialties,
  bio: row.bio,
  photo: row.photo,
});

export class PgProfessionalRepository implements ProfessionalRepository {
  constructor(private readonly db: DbPool) {}

  async findAll(): Promise<Professional[]> {
    const { rows } = await this.db.query<ProfessionalRow>(`SELECT ${SELECT_COLUMNS} FROM professionals ORDER BY id`);
    return rows.map(toProfessional);
  }

  async findById(id: number): Promise<Professional | null> {
    const { rows } = await this.db.query<ProfessionalRow>(
      `SELECT ${SELECT_COLUMNS} FROM professionals WHERE id = $1`,
      [id],
    );
    return rows[0] ? toProfessional(rows[0]) : null;
  }

  /**
   * The photo is handled separately because `null` is a meaningful value
   * (remove the photo), while an absent key means "leave it unchanged".
   */
  async update(id: number, patch: ProfessionalPatch): Promise<Professional | null> {
    const hasPhotoChange = patch.photo !== undefined;
    const { rows } = await this.db.query<ProfessionalRow>(
      `UPDATE professionals SET
         name = COALESCE($2, name),
         specialties = COALESCE($3, specialties),
         bio = COALESCE($4, bio),
         photo = CASE WHEN $5 THEN $6 ELSE photo END
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, patch.name ?? null, patch.specialties ?? null, patch.bio ?? null, hasPhotoChange, patch.photo ?? null],
    );
    return rows[0] ? toProfessional(rows[0]) : null;
  }
}
