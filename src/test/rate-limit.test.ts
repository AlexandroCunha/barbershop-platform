import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { rateLimit } from "../middlewares/rate-limit.js";
import { AppError } from "../utils/app-error.js";

function run(limiter: ReturnType<typeof rateLimit>, ip: string) {
  const headers: Record<string, string> = {};
  const res = { setHeader: (name: string, value: string) => (headers[name] = value) };
  let outcome: unknown = "passed";
  limiter({ ip } as Request, res as unknown as Response, (error?: unknown) => {
    outcome = error ?? "passed";
  });
  return { outcome, headers };
}

test("allows up to the limit, then answers 429 with Retry-After", () => {
  let current = 0;
  const limiter = rateLimit({ windowMs: 60_000, max: 2, message: "slow down", now: () => current });

  assert.equal(run(limiter, "1.2.3.4").outcome, "passed");
  assert.equal(run(limiter, "1.2.3.4").outcome, "passed");

  const blocked = run(limiter, "1.2.3.4");
  assert.ok(blocked.outcome instanceof AppError);
  assert.equal(blocked.outcome.status, 429);
  assert.equal(blocked.headers["Retry-After"], "60");
});

test("counts each address separately and opens a new window later", () => {
  let current = 0;
  const limiter = rateLimit({ windowMs: 1_000, max: 1, message: "slow down", now: () => current });

  assert.equal(run(limiter, "1.1.1.1").outcome, "passed");
  assert.equal(run(limiter, "2.2.2.2").outcome, "passed");
  assert.ok(run(limiter, "1.1.1.1").outcome instanceof AppError);

  current = 1_000;
  assert.equal(run(limiter, "1.1.1.1").outcome, "passed");
});
