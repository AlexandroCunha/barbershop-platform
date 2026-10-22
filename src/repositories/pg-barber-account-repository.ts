import type { DbPool } from "../db/pool.js";
import { AppError } from "../utils/app-error.js";
import type { BarberAccount, BarberAccountRepository } from "./types.js";

interface BarberAccountRow {
  id: number;
  tenant_id: number;
  professional_id: number;
  email: string;
  password_hash: string;
}

const COLUMNS = "id, tenant_id, professional_id, email, password_hash";
const UNIQUE_VIOLATION = "23505";

const toAccount = (row: BarberAccountRow): BarberAccount => ({
  id: row.id,
  tenantId: row.tenant_id,
  professionalId: row.professional_id,
  email: row.email,
  passwordHash: row.password_hash,
});

export class PgBarberAccountRepository implements BarberAccountRepository {
  constructor(private readonly db: DbPool) {}

  async findByEmail(tenantId: number, email: string): Promise<BarberAccount | null> {
    const { rows } = await this.db.query<BarberAccountRow>(
      `SELECT ${COLUMNS} FROM barber_accounts WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async findById(id: number): Promise<BarberAccount | null> {
    const { rows } = await this.db.query<BarberAccountRow>(`SELECT ${COLUMNS} FROM barber_accounts WHERE id = $1`, [id]);
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async findByProfessional(tenantId: number, professionalId: number): Promise<BarberAccount | null> {
    const { rows } = await this.db.query<BarberAccountRow>(
      `SELECT ${COLUMNS} FROM barber_accounts WHERE tenant_id = $1 AND professional_id = $2`,
      [tenantId, professionalId],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async upsert(tenantId: number, professionalId: number, email: string, passwordHash: string): Promise<BarberAccount> {
    try {
      const { rows } = await this.db.query<BarberAccountRow>(
        `INSERT INTO barber_accounts (tenant_id, professional_id, email, password_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (professional_id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash
         WHERE barber_accounts.tenant_id = EXCLUDED.tenant_id
         RETURNING ${COLUMNS}`,
        [tenantId, professionalId, email, passwordHash],
      );
      if (!rows[0]) {
        throw new AppError(404, "Professional not found");
      }
      return toAccount(rows[0]);
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
      if (code === UNIQUE_VIOLATION) {
        throw new AppError(409, "Another barber of this shop already uses this email");
      }
      throw error;
    }
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await this.db.query(`UPDATE barber_accounts SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
  }

  async remove(tenantId: number, professionalId: number): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM barber_accounts WHERE tenant_id = $1 AND professional_id = $2`,
      [tenantId, professionalId],
    );
    return (rowCount ?? 0) > 0;
  }
}
