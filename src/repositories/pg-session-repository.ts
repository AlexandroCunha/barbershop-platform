import type { DbPool } from "../db/pool.js";
import type { SessionKind, SessionRecord, SessionRepository } from "./types.js";

interface SessionRow {
  id: string;
  kind: SessionKind;
  tenant_id: number | null;
  owner_id: number | null;
  barber_account_id: number | null;
  expires_at: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toSession = (row: SessionRow): SessionRecord => ({
  id: row.id,
  kind: row.kind,
  tenantId: row.tenant_id,
  ownerId: row.owner_id,
  barberAccountId: row.barber_account_id,
  expiresAt: row.expires_at,
});

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly db: DbPool) {}

  async create(session: SessionRecord): Promise<void> {
    // Sessions that expired long ago are no longer needed; clearing them here keeps the table small.
    await this.db.query(`DELETE FROM sessions WHERE expires_at < now()`);
    await this.db.query(
      `INSERT INTO sessions (id, kind, tenant_id, owner_id, barber_account_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [session.id, session.kind, session.tenantId, session.ownerId, session.barberAccountId, session.expiresAt],
    );
  }

  async findActive(id: string, now: Date): Promise<SessionRecord | null> {
    // The id comes from a signed token, but it is still checked before it reaches the database.
    if (!UUID_PATTERN.test(id)) return null;

    const { rows } = await this.db.query<SessionRow>(
      `SELECT id, kind, tenant_id, owner_id, barber_account_id, expires_at FROM sessions
       WHERE id = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [id, now],
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  async revoke(id: string): Promise<void> {
    if (!UUID_PATTERN.test(id)) return;
    await this.db.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
  }

  async revokeAllForOwner(ownerId: number): Promise<void> {
    await this.db.query(`UPDATE sessions SET revoked_at = now() WHERE owner_id = $1 AND revoked_at IS NULL`, [ownerId]);
  }

  async revokeAllForBarberAccount(barberAccountId: number): Promise<void> {
    await this.db.query(
      `UPDATE sessions SET revoked_at = now() WHERE barber_account_id = $1 AND revoked_at IS NULL`,
      [barberAccountId],
    );
  }
}
