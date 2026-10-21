import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { OWNER_COOKIE, PLATFORM_COOKIE } from "../auth/session-config.js";
import { issueToken } from "../auth/tokens.js";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Tenant } from "../domain/tenant.js";
import { requireOwner } from "../middlewares/require-owner.js";
import { requirePlatform } from "../middlewares/require-platform.js";
import type { OwnerAccount, OwnerRepository, SessionRecord, SessionRepository } from "../repositories/types.js";
import { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

const SECRET = "a-test-secret-that-is-long-enough-to-use";
const PLATFORM_KEY = "a-platform-key-derived-only-for-tests";
const START = new Date("2030-01-01T10:00:00Z");

const shop: Tenant = {
  id: 1,
  slug: "northgate",
  name: "Northgate",
  business: DEFAULT_BUSINESS,
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};
const otherShop: Tenant = { ...shop, id: 2, slug: "eastside" };

const owner: OwnerAccount = { id: 7, tenantId: 1, email: "owner@example.com", passwordHash: "unused", sessionVersion: 1 };

class InMemorySessions implements SessionRepository {
  readonly rows = new Map<string, SessionRecord & { revoked: boolean }>();

  async create(session: SessionRecord): Promise<void> {
    this.rows.set(session.id, { ...session, revoked: false });
  }

  async findActive(id: string, now: Date): Promise<SessionRecord | null> {
    const row = this.rows.get(id);
    if (!row || row.revoked || row.expiresAt <= now) return null;
    return { id: row.id, kind: row.kind, tenantId: row.tenantId, ownerId: row.ownerId, expiresAt: row.expiresAt };
  }

  async revoke(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (row) row.revoked = true;
  }

  async revokeAllForOwner(ownerId: number): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.ownerId === ownerId) row.revoked = true;
    }
  }
}

class InMemoryOwners implements OwnerRepository {
  async findByEmail(): Promise<OwnerAccount | null> {
    return null;
  }

  async findById(id: number): Promise<OwnerAccount | null> {
    return id === owner.id ? owner : null;
  }

  async updatePassword(): Promise<number> {
    throw new Error("not used by these tests");
  }

  async replacePasswordHash(): Promise<void> {
    throw new Error("not used by these tests");
  }
}

function setup() {
  let now = START;
  const clock: Clock = { now: () => now, today: () => "2030-01-01" };
  const records = new InMemorySessions();
  const sessions = new SessionService(records, clock);
  return {
    sessions,
    records,
    advanceTo(time: Date) {
      now = time;
    },
  };
}

/** Runs a middleware and returns what it passed to next(): nothing on success, or the error. */
async function run(handler: RequestHandler, req: Request): Promise<unknown> {
  let outcome: unknown = "passed";
  const next: NextFunction = (error?: unknown) => {
    outcome = error ?? "passed";
  };
  await handler(req, {} as Response, next);
  return outcome;
}

const requestWith = (cookieName: string, token: string | undefined, tenant: Tenant = shop): Request =>
  ({ headers: token ? { cookie: `${cookieName}=${token}` } : {}, tenant }) as unknown as Request;

function assertUnauthorised(outcome: unknown): void {
  assert.ok(outcome instanceof AppError, "expected an AppError");
  assert.equal(outcome.status, 401);
}

test("an owner session works until it is revoked, and a copy of its cookie then fails", async () => {
  const { sessions } = setup();
  const opened = await sessions.openOwnerSession({ tenantId: 1, ownerId: 7 });
  const token = issueToken(SECRET, { kind: "owner", exp: opened.expiresAt, sid: opened.id, tenantId: 1, ownerId: 7, version: 1 });
  const guard = requireOwner(SECRET, new InMemoryOwners(), sessions);

  assert.equal(await run(guard, requestWith(OWNER_COOKIE, token)), "passed");

  await sessions.revoke(opened.id);
  assertUnauthorised(await run(guard, requestWith(OWNER_COOKIE, token)));
});

test("changing the password ends every session of that owner", async () => {
  const { sessions } = setup();
  const first = await sessions.openOwnerSession({ tenantId: 1, ownerId: 7 });
  const second = await sessions.openOwnerSession({ tenantId: 1, ownerId: 7 });
  const token = issueToken(SECRET, { kind: "owner", exp: first.expiresAt, sid: first.id, tenantId: 1, ownerId: 7, version: 1 });

  await sessions.revokeAllForOwner(7);

  assertUnauthorised(await run(requireOwner(SECRET, new InMemoryOwners(), sessions), requestWith(OWNER_COOKIE, token)));
  assert.equal(await sessions.findActive(second.id), null);
});

test("an owner session expires with its time limit", async () => {
  const { sessions, advanceTo } = setup();
  const opened = await sessions.openOwnerSession({ tenantId: 1, ownerId: 7 });
  const token = issueToken(SECRET, { kind: "owner", exp: opened.expiresAt, sid: opened.id, tenantId: 1, ownerId: 7, version: 1 });
  const guard = requireOwner(SECRET, new InMemoryOwners(), sessions);

  advanceTo(new Date(opened.expiresAt * 1000 + 1000));
  assertUnauthorised(await run(guard, requestWith(OWNER_COOKIE, token)));
});

test("an owner token is refused for another barbershop", async () => {
  const { sessions } = setup();
  const opened = await sessions.openOwnerSession({ tenantId: 1, ownerId: 7 });
  const token = issueToken(SECRET, { kind: "owner", exp: opened.expiresAt, sid: opened.id, tenantId: 1, ownerId: 7, version: 1 });

  assertUnauthorised(await run(requireOwner(SECRET, new InMemoryOwners(), sessions), requestWith(OWNER_COOKIE, token, otherShop)));
});

test("an owner token without a session record, or with an unknown one, is refused", async () => {
  const { sessions } = setup();
  const guard = requireOwner(SECRET, new InMemoryOwners(), sessions);

  const withoutSid = issueToken(SECRET, { kind: "owner", exp: START.getTime() / 1000 + 600, tenantId: 1, ownerId: 7, version: 1 });
  assertUnauthorised(await run(guard, requestWith(OWNER_COOKIE, withoutSid)));

  const unknown = issueToken(SECRET, {
    kind: "owner",
    exp: START.getTime() / 1000 + 600,
    sid: "99999999-9999-4999-8999-999999999999",
    tenantId: 1,
    ownerId: 7,
    version: 1,
  });
  assertUnauthorised(await run(guard, requestWith(OWNER_COOKIE, unknown)));
});

test("a platform session works until it is revoked, and a platform token cannot open owner areas", async () => {
  const { sessions } = setup();
  const opened = await sessions.openPlatformSession();
  const token = issueToken(PLATFORM_KEY, { kind: "platform", exp: opened.expiresAt, sid: opened.id });
  const guard = requirePlatform(PLATFORM_KEY, sessions);

  assert.equal(await run(guard, requestWith(PLATFORM_COOKIE, token)), "passed");

  await sessions.revoke(opened.id);
  assertUnauthorised(await run(guard, requestWith(PLATFORM_COOKIE, token)));

  const ownerToken = issueToken(SECRET, { kind: "owner", exp: opened.expiresAt, sid: opened.id, tenantId: 1, ownerId: 7, version: 1 });
  assertUnauthorised(await run(requireOwner(SECRET, new InMemoryOwners(), sessions), requestWith(OWNER_COOKIE, ownerToken)));
});
