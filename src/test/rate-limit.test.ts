import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { MemoryRateLimitStore, rateLimit } from "../middlewares/rate-limit.js";
import { AppError } from "../utils/app-error.js";

async function send(limiter: ReturnType<typeof rateLimit>, ip: string) {
  const headers: Record<string, string> = {};
  const res = { setHeader: (name: string, value: string) => (headers[name] = value) };
  let outcome: unknown = "passed";
  await limiter({ ip } as Request, res as unknown as Response, (error?: unknown) => {
    outcome = error ?? "passed";
  });
  return { outcome, headers };
}

test("allows up to the limit, then answers 429 with Retry-After", async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now);
  const limiter = rateLimit({ bucket: "test", windowMs: 60_000, max: 2, message: "slow down", store });

  assert.equal((await send(limiter, "1.2.3.4")).outcome, "passed");
  assert.equal((await send(limiter, "1.2.3.4")).outcome, "passed");

  const blocked = await send(limiter, "1.2.3.4");
  assert.ok(blocked.outcome instanceof AppError);
  assert.equal(blocked.outcome.status, 429);
  assert.equal(blocked.headers["Retry-After"], "60");
});

test("counts each address and each bucket separately, and opens a new window later", async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now);
  const signIn = rateLimit({ bucket: "sign-in", windowMs: 1_000, max: 1, message: "slow down", store });
  const booking = rateLimit({ bucket: "booking", windowMs: 1_000, max: 1, message: "slow down", store });

  assert.equal((await send(signIn, "1.1.1.1")).outcome, "passed");
  assert.equal((await send(signIn, "2.2.2.2")).outcome, "passed");
  assert.equal((await send(booking, "1.1.1.1")).outcome, "passed", "a different bucket has its own count");
  assert.ok((await send(signIn, "1.1.1.1")).outcome instanceof AppError);

  now = 1_000;
  assert.equal((await send(signIn, "1.1.1.1")).outcome, "passed");
});

test("the store drops clients whose window has closed once it tracks many addresses", async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now);
  for (let index = 0; index < 10_001; index++) {
    await store.hit("bulk", `client-${index}`, 1_000);
  }

  now = 5_000;
  const hit = await store.hit("bulk", "fresh-client", 1_000);
  assert.equal(hit.count, 1);
  assert.equal(hit.retryAfterSeconds, 1);
});
