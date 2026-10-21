import type { DbPool } from "../db/pool.js";
import type { RateLimitHit, RateLimitStore } from "../middlewares/rate-limit.js";

/** Roughly one request in this many also clears windows that closed long ago. */
const CLEANUP_ONE_IN = 100;

/**
 * Counters in PostgreSQL, so every instance of the app shares the same limits. The window is
 * opened and counted in one atomic statement, and it uses the database's clock, so instances
 * whose own clocks disagree still agree on when a window ends.
 */
export class PgRateLimitStore implements RateLimitStore {
  constructor(private readonly db: DbPool) {}

  async hit(bucket: string, client: string, windowMs: number): Promise<RateLimitHit> {
    const windowSeconds = windowMs / 1000;
    const { rows } = await this.db.query<{ count: number; retry_after: number }>(
      `INSERT INTO rate_limits AS r (bucket, client, count, reset_at)
       VALUES ($1, $2, 1, now() + make_interval(secs => $3::float8))
       ON CONFLICT (bucket, client) DO UPDATE SET
         count    = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
         reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => $3::float8) ELSE r.reset_at END
       RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int AS retry_after`,
      [bucket, client, windowSeconds],
    );

    if (Math.random() * CLEANUP_ONE_IN < 1) {
      await this.db.query(`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`);
    }

    const row = rows[0];
    if (!row) {
      throw new Error("rate limit upsert returned no row");
    }
    return { count: row.count, retryAfterSeconds: row.retry_after };
  }
}
