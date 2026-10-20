import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { rateLimit } from "../middlewares/rate-limit.js";
import { AppError } from "../utils/app-error.js";

function fakeRequest(ip: string): Request {
  return { ip } as Request;
}

function fakeResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
}

function run(limiter: ReturnType<typeof rateLimit>, ip: string) {
  const res = fakeResponse();
  let outcome: unknown = "passed";
  limiter(fakeRequest(ip), res as unknown as Response, (error?: unknown) => {
    outcome = error ?? "passed";
  });
  return { outcome, headers: res.headers };
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

test("counts each client address separately", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1, message: "slow down", now: () => 0 });

  assert.equal(run(limiter, "1.1.1.1").outcome, "passed");
  assert.equal(run(limiter, "2.2.2.2").outcome, "passed");
});

test("opens a fresh window once the old one has passed", () => {
  let current = 0;
  const limiter = rateLimit({ windowMs: 1_000, max: 1, message: "slow down", now: () => current });

  assert.equal(run(limiter, "1.1.1.1").outcome, "passed");
  assert.ok(run(limiter, "1.1.1.1").outcome instanceof AppError);

  current = 1_000;
  assert.equal(run(limiter, "1.1.1.1").outcome, "passed");
});
