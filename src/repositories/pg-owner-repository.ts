import type { DbPool } from "../db/pool.js";
import type { OwnerAccount, OwnerRepository } from "./types.js";

interface OwnerRow {
  id: number;
  tenant_id: number;
  email: string;
  password_hash: string;
  session_version: number;
}

const COLUMNS = "id, tenant_id, email, password_hash, session_version";

const toOwner = (row: OwnerRow): OwnerAccount => ({
  id: row.id,
  tenantId: row.tenant_id,
  email: row.email,
  passwordHash: row.password_hash,
  sessionVersion: row.session_version,
});

export class PgOwnerRepository implements OwnerRepository {
  constructor(private readonly db: DbPool) {}

  async findByEmail(tenantId: number, email: string): Promise<OwnerAccount | null> {
    const { rows } = await this.db.query<OwnerRow>(
      `SELECT ${COLUMNS} FROM tenant_owners WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    return rows[0] ? toOwner(rows[0]) : null;
  }

  async findById(id: number): Promise<OwnerAccount | null> {
    const { rows } = await this.db.query<OwnerRow>(`SELECT ${COLUMNS} FROM tenant_owners WHERE id = $1`, [id]);
    return rows[0] ? toOwner(rows[0]) : null;
  }

  async updatePassword(id: number, passwordHash: string): Promise<number> {
    const { rows } = await this.db.query<{ session_version: number }>(
      `UPDATE tenant_owners
       SET password_hash = $2, session_version = session_version + 1
       WHERE id = $1
       RETURNING session_version`,
      [id, passwordHash],
    );
    return rows[0]!.session_version;
  }

  async replacePasswordHash(id: number, passwordHash: string): Promise<void> {
    await this.db.query(`UPDATE tenant_owners SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
  }
}
