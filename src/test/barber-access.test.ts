import assert from "node:assert/strict";
import { hashPassword } from "../auth/passwords.js";
import { BARBER_COOKIE, OWNER_COOKIE } from "../auth/session-config.js";
import { issueToken } from "../auth/tokens.js";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Tenant } from "../domain/tenant.js";
import type { Booking, Professional, Service } from "../domain/types.js";
import { isUpcoming } from "../domain/upcoming-bookings.js";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { requireBarber } from "../middlewares/require-barber.js";
import type {
  BarberAccount,
  BarberAccountRepository,
  BookingRepository,
  ProfessionalRepository,
  ServiceRepository,
  SessionRecord,
  SessionRepository,
} from "../repositories/types.js";
import { BarberService } from "../services/barber-service.js";
import { SessionService } from "../services/session-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";
import { minuteOfDayIn } from "../utils/clock.js";
import { test } from "node:test";

const SECRET = "a-test-secret-that-is-long-enough-to-use";
const TIME_ZONE = "Europe/Dublin";
/** Monday 7 January 2030, 10:30 in Dublin (UTC in winter). */
const NOW = new Date("2030-01-07T10:30:00Z");

const shop: Tenant = {
  id: 1,
  slug: "northgate",
  name: "Northgate",
  business: { ...DEFAULT_BUSINESS, timeZone: TIME_ZONE },
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};
const otherShop: Tenant = { ...shop, id: 2, slug: "eastside" };

const luca: Professional = { id: 2, name: "Luca", specialties: [], bio: "", photo: null };
const daniel: Professional = { id: 1, name: "Daniel", specialties: [], bio: "", photo: null };
const haircut: Service = { id: 1, name: "Haircut", description: "", priceCents: 2800, durationMinutes: 30 };

const clock: Clock = { now: () => NOW, today: () => "2030-01-07" };

const passwordHash = await hashPassword("correct horse battery");
const lucaAccount: BarberAccount = {
  id: 5,
  tenantId: 1,
  professionalId: luca.id,
  email: "luca@example.com",
  passwordHash,
};

function booking(id: string, professionalId: number, date: string, startMinute: number): Booking {
  return {
    id,
    serviceId: 1,
    professionalId,
    date,
    startMinute,
    endMinute: startMinute + 30,
    customerName: `Customer ${id}`,
    customerEmail: `${id}@example.com`,
    customerPhone: "+353 85 000 0000",
    createdAt: NOW,
  };
}

class Accounts implements BarberAccountRepository {
  constructor(private readonly rows: BarberAccount[]) {}

  async findByEmail(tenantId: number, email: string) {
    return this.rows.find((row) => row.tenantId === tenantId && row.email === email) ?? null;
  }

  async findById(id: number) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByProfessional(tenantId: number, professionalId: number) {
    return this.rows.find((row) => row.tenantId === tenantId && row.professionalId === professionalId) ?? null;
  }

  async upsert(): Promise<BarberAccount> {
    throw new Error("not used by these tests");
  }

  async remove(): Promise<boolean> {
    throw new Error("not used by these tests");
  }
}

class Sessions implements SessionRepository {
  readonly rows: (SessionRecord & { revoked: boolean })[] = [];

  async create(session: SessionRecord): Promise<void> {
    this.rows.push({ ...session, revoked: false });
  }

  async findActive(id: string, now: Date): Promise<SessionRecord | null> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row || row.revoked || row.expiresAt <= now) return null;
    return { id: row.id, kind: row.kind, tenantId: row.tenantId, ownerId: row.ownerId, barberAccountId: row.barberAccountId, expiresAt: row.expiresAt };
  }

  async revoke(id: string): Promise<void> {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row) row.revoked = true;
  }

  async revokeAllForOwner(): Promise<void> {}

  async revokeAllForBarberAccount(barberAccountId: number): Promise<void> {
    for (const row of this.rows) {
      if (row.barberAccountId === barberAccountId) row.revoked = true;
    }
  }
}

function setup(bookingRows: Booking[] = []) {
  const sessionRows = new Sessions();
  const sessions = new SessionService(sessionRows, clock);
  const accounts = new Accounts([lucaAccount]);
  // Only the methods these tests use are implemented.
  const professionals = {
    findById: async (tenantId: number, id: number) => (tenantId === 1 && id === luca.id ? luca : null),
  } as unknown as ProfessionalRepository;
  const services = { findAll: async () => [haircut] } as unknown as ServiceRepository;
  const bookings = {
    findFromDate: async (tenantId: number, professionalId: number, from: string) =>
      bookingRows.filter((row) => row.professionalId === professionalId && row.date >= from && tenantId === 1),
  } as unknown as BookingRepository;
  const barbers = new BarberService(accounts, professionals, services, bookings, sessions, clock);
  return { accounts, sessionRows, sessions, barbers };
}

async function run(handler: RequestHandler, req: Request): Promise<unknown> {
  let outcome: unknown = "passed";
  const next: NextFunction = (error?: unknown) => {
    outcome = error ?? "passed";
  };
  await handler(req, {} as Response, next);
  return outcome;
}

const barberRequest = (token: string | undefined, tenant: Tenant = shop): Request =>
  ({ headers: token ? { cookie: `${BARBER_COOKIE}=${token}` } : {}, tenant }) as unknown as Request;

function assertUnauthorised(outcome: unknown): void {
  assert.ok(outcome instanceof AppError, "expected an AppError");
  assert.equal(outcome.status, 401);
}

test("a barber sees only their own upcoming bookings, and no contact details", async () => {
  const rows = [
    booking("past-today", luca.id, "2030-01-07", 9 * 60),
    booking("later-today", luca.id, "2030-01-07", 11 * 60),
    booking("tomorrow", luca.id, "2030-01-08", 9 * 60),
    booking("yesterday", luca.id, "2030-01-06", 9 * 60),
    booking("other-barber", daniel.id, "2030-01-08", 9 * 60),
  ];
  const { barbers } = setup(rows);

  const view = await barbers.upcomingBookings(shop, lucaAccount);

  assert.deepEqual(
    view.map((item) => item.id),
    ["later-today", "tomorrow"],
  );
  assert.equal(view[0]?.startTime, "11:00");
  assert.equal(view[0]?.serviceName, "Haircut");
  for (const item of view) {
    assert.equal("customerEmail" in item, false);
    assert.equal("customerPhone" in item, false);
  }
});

test("a wrong password and an unknown email get the same refusal", async () => {
  const { barbers } = setup();

  for (const [email, password] of [
    ["luca@example.com", "not the password at all"],
    ["nobody@example.com", "correct horse battery"],
  ]) {
    await assert.rejects(barbers.signIn(shop, email, password), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Email or password is not correct");
      return true;
    });
  }
});

test("a barber session works until it is ended, and ends when the login is replaced", async () => {
  const { barbers, sessions, sessionRows } = setup();
  const opened = await barbers.openSession(shop, lucaAccount);
  const token = issueToken(SECRET, {
    kind: "barber",
    exp: opened.expiresAt,
    sid: opened.id,
    tenantId: 1,
    barberAccountId: lucaAccount.id,
  });
  const guard = requireBarber(SECRET, new Accounts([lucaAccount]), sessions);

  assert.equal(await run(guard, barberRequest(token)), "passed");

  await sessionRows.revokeAllForBarberAccount(lucaAccount.id);
  assertUnauthorised(await run(guard, barberRequest(token)));
});

test("an owner or developer token cannot open the barber area", async () => {
  const { sessions } = setup();
  const opened = await sessions.openOwnerSession({ tenantId: 1, ownerId: 7 });
  const ownerToken = issueToken(SECRET, {
    kind: "owner",
    exp: opened.expiresAt,
    sid: opened.id,
    tenantId: 1,
    ownerId: 7,
    version: 1,
  });
  const guard = requireBarber(SECRET, new Accounts([lucaAccount]), sessions);

  assertUnauthorised(await run(guard, barberRequest(ownerToken)));
  assertUnauthorised(await run(guard, { headers: { cookie: `${OWNER_COOKIE}=${ownerToken}` }, tenant: shop } as unknown as Request));
});

test("a barber token is refused for another barbershop", async () => {
  const { barbers, sessions } = setup();
  const opened = await barbers.openSession(shop, lucaAccount);
  const token = issueToken(SECRET, {
    kind: "barber",
    exp: opened.expiresAt,
    sid: opened.id,
    tenantId: 1,
    barberAccountId: lucaAccount.id,
  });

  assertUnauthorised(await run(requireBarber(SECRET, new Accounts([lucaAccount]), sessions), barberRequest(token, otherShop)));
});

test("a booking is upcoming until it starts, in the shop's time zone", () => {
  const minuteNow = minuteOfDayIn(NOW, TIME_ZONE);
  assert.equal(minuteNow, 10 * 60 + 30);
  assert.equal(minuteOfDayIn(NOW, "America/New_York"), 5 * 60 + 30);

  assert.equal(isUpcoming({ date: "2030-01-07", startMinute: 11 * 60 }, "2030-01-07", minuteNow), true);
  assert.equal(isUpcoming({ date: "2030-01-07", startMinute: 9 * 60 }, "2030-01-07", minuteNow), false);
  assert.equal(isUpcoming({ date: "2030-01-08", startMinute: 9 * 60 }, "2030-01-07", minuteNow), true);
  assert.equal(isUpcoming({ date: "2030-01-06", startMinute: 17 * 60 }, "2030-01-07", minuteNow), false);
});
