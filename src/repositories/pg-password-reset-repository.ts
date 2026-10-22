import type { DbPool } from "../db/pool.js";
import type { PasswordResetRepository, PasswordResetTarget } from "./types.js";

export class PgPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: DbPool) {}

  async create(reset: PasswordResetTarget & { tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.db.query(
      `INSERT INTO password_resets (token_hash, tenant_id, owner_id, barber_account_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [reset.tokenHash, reset.tenantId, reset.ownerId, reset.barberAccountId, reset.expiresAt],
    );
  }

  async consume(tokenHash: string, tenantId: number, now: Date): Promise<PasswordResetTarget | null> {
    // The WHERE clause and the update are one statement, so a link cannot be used twice, even at the same moment.
    const { rows } = await this.db.query<{ tenant_id: number; owner_id: number | null; barber_account_id: number | null }>(
      `UPDATE password_resets SET used_at = $2
       WHERE token_hash = $1 AND tenant_id = $3 AND used_at IS NULL AND expires_at > $2
       RETURNING tenant_id, owner_id, barber_account_id`,
      [tokenHash, now, tenantId],
    );
    const row = rows[0];
    return row ? { tenantId: row.tenant_id, ownerId: row.owner_id, barberAccountId: row.barber_account_id } : null;
  }
}
