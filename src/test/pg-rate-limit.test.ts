import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createPool } from "../db/pool.js";
import { PgRateLimitStore } from "../repositories/pg-rate-limit-store.js";

/**
 * Needs a real database, so it runs only when TEST_DATABASE_URL is set. The migrations must
 * already be applied to that database.
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

test(
  "PostgreSQL counters are shared by every instance and restart when the window ends",
  { skip: databaseUrl ? false : "set TEST_DATABASE_URL to run this test" },
  async () => {
    // Two pools stand in for two server instances.
    const poolA = createPool(databaseUrl!);
    const poolB = createPool(databaseUrl!);
    const bucket = `test-${randomUUID()}`;
    const client = "203.0.113.7";
    const windowMs = 1_000;

    try {
      const instanceA = new PgRateLimitStore(poolA);
      const instanceB = new PgRateLimitStore(poolB);

      assert.equal((await instanceA.hit(bucket, client, windowMs)).count, 1);
      assert.equal((await instanceB.hit(bucket, client, windowMs)).count, 2);
      assert.equal((await instanceA.hit(bucket, client, windowMs)).count, 3);

      const hit = await instanceB.hit(bucket, client, windowMs);
      assert.equal(hit.count, 4);
      assert.equal(hit.retryAfterSeconds, 1, "a one-second window always asks for one second");

      await new Promise((resolve) => setTimeout(resolve, 1_100));
      assert.equal((await instanceA.hit(bucket, client, windowMs)).count, 1, "a new window starts from one");
    } finally {
      await poolA.query("DELETE FROM rate_limits WHERE bucket = $1", [bucket]);
      await poolA.end();
      await poolB.end();
    }
  },
);
