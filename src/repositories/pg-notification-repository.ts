import type { DbPool } from "../db/pool.js";
import type { ClaimedNotification, NotificationRepository } from "./types.js";

interface ClaimedRow {
  id: string;
  to_address: string;
  subject: string;
  body: string;
  attempts: number;
}

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly db: DbPool) {}

  async claimDue(now: Date, leaseUntil: Date, limit: number): Promise<ClaimedNotification[]> {
    // SKIP LOCKED lets several servers share the outbox: each row is claimed by one of them only.
    // retry_at doubles as the lease, so a claimed message is not picked up again until the lease ends.
    const { rows } = await this.db.query<ClaimedRow>(
      `UPDATE notifications
       SET attempts = attempts + 1, retry_at = $2
       WHERE id IN (
         SELECT id FROM notifications
         WHERE sent_at IS NULL AND failed_at IS NULL
           AND send_at <= $1 AND (retry_at IS NULL OR retry_at <= $1)
         ORDER BY send_at
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, to_address, subject, body, attempts`,
      [now, leaseUntil, limit],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      toAddress: row.to_address,
      subject: row.subject,
      body: row.body,
      attempts: row.attempts,
    }));
  }

  async markSent(id: number): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET sent_at = now(), retry_at = NULL, to_address = '', body = '' WHERE id = $1`,
      [id],
    );
  }

  async markRetry(id: number, retryAt: Date): Promise<void> {
    await this.db.query(`UPDATE notifications SET retry_at = $2 WHERE id = $1`, [id, retryAt]);
  }

  async markFailed(id: number): Promise<void> {
    await this.db.query(
      `UPDATE notifications SET failed_at = now(), retry_at = NULL, to_address = '', body = '' WHERE id = $1`,
      [id],
    );
  }
}
