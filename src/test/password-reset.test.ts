import assert from "node:assert/strict";
import { test } from "node:test";
import { hashLinkToken } from "../auth/link-token.js";
import { verifyPassword } from "../auth/passwords.js";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Tenant } from "../domain/tenant.js";
import type { Mailer, OutgoingMail } from "../mail/mailer.js";
import type {
  BarberAccount,
  BarberAccountRepository,
  OwnerAccount,
  OwnerRepository,
  PasswordResetRepository,
  PasswordResetTarget,
} from "../repositories/types.js";
import { PasswordResetService } from "../services/password-reset-service.js";
import type { SessionService } from "../services/session-service.js";
import type { Clock } from "../utils/clock.js";

const NOW = new Date("2030-01-01T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const NEW_PASSWORD = "A-new-long-password-2030";

const shop: Tenant = {
  id: 1,
  slug: "northgate",
  name: "Northgate",
  business: { ...DEFAULT_BUSINESS, name: "Northgate Barbers" },
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};
const otherShop: Tenant = { ...shop, id: 2, slug: "eastside" };

interface ResetRow extends PasswordResetTarget {
  expiresAt: Date;
  usedAt: Date | null;
}

class MemoryResets implements PasswordResetRepository {
  readonly rows = new Map<string, ResetRow>();

  async create(reset: PasswordResetTarget & { tokenHash: string; expiresAt: Date }): Promise<void> {
    this.rows.set(reset.tokenHash, { ...reset, usedAt: null });
  }

  /** The same rule as the database: right shop, not used, not expired. Marks it used in the same step. */
  async consume(tokenHash: string, tenantId: number, now: Date): Promise<PasswordResetTarget | null> {
    const row = this.rows.get(tokenHash);
    if (!row || row.tenantId !== tenantId || row.usedAt || row.expiresAt <= now) return null;
    row.usedAt = now;
    return { tenantId: row.tenantId, ownerId: row.ownerId, barberAccountId: row.barberAccountId };
  }
}

class MemoryOwners implements OwnerRepository {
  owner: OwnerAccount = { id: 10, tenantId: shop.id, email: "owner@example.com", passwordHash: "old", sessionVersion: 1 };

  async findByEmail(tenantId: number, email: string): Promise<OwnerAccount | null> {
    return tenantId === this.owner.tenantId && email === this.owner.email ? this.owner : null;
  }
  async findById(id: number): Promise<OwnerAccount | null> {
    return id === this.owner.id ? this.owner : null;
  }
  async updatePassword(id: number, passwordHash: string): Promise<number> {
    this.owner = { ...this.owner, id, passwordHash, sessionVersion: this.owner.sessionVersion + 1 };
    return this.owner.sessionVersion;
  }
  async replacePasswordHash(): Promise<void> {}
}

class MemoryBarbers implements BarberAccountRepository {
  account: BarberAccount = { id: 20, tenantId: shop.id, professionalId: 5, email: "daniel@example.com", passwordHash: "old" };

  async findByEmail(tenantId: number, email: string): Promise<BarberAccount | null> {
    return tenantId === this.account.tenantId && email === this.account.email ? this.account : null;
  }
  async findById(id: number): Promise<BarberAccount | null> {
    return id === this.account.id ? this.account : null;
  }
  async findByProfessional(): Promise<BarberAccount | null> {
    return this.account;
  }
  async upsert(): Promise<BarberAccount> {
    return this.account;
  }
  async remove(): Promise<boolean> {
    return true;
  }
  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    this.account = { ...this.account, id, passwordHash };
  }
}

class RecordingMailer implements Mailer {
  readonly sent: OutgoingMail[] = [];
  async send(mail: OutgoingMail): Promise<void> {
    this.sent.push(mail);
  }
}

function setup(clock: Clock = { now: () => NOW, today: () => "2030-01-01" }) {
  const resets = new MemoryResets();
  const owners = new MemoryOwners();
  const barbers = new MemoryBarbers();
  const mailer = new RecordingMailer();
  const revoked: number[] = [];
  const sessions = { revokeAllForBarberAccount: async (id: number) => void revoked.push(id) } as unknown as SessionService;
  const service = new PasswordResetService(owners, barbers, resets, sessions, mailer, clock, {
    publicUrl: "https://shop.test",
    enabled: true,
  });
  return { service, resets, owners, barbers, mailer, revoked };
}

/** The token from the link in the last e-mail sent. */
function tokenIn(mailer: RecordingMailer): string {
  const link = mailer.sent.at(-1)!.text.match(/token=([A-Za-z0-9_-]+)/);
  assert.ok(link, "the e-mail carries a link");
  return link[1]!;
}

test("a request for an existing owner e-mails a link, and the database keeps only its hash", async () => {
  const { service, resets, mailer } = setup();
  await service.request(shop, "owner", "owner@example.com");

  assert.equal(mailer.sent.length, 1);
  const token = tokenIn(mailer);
  assert.ok(resets.rows.has(hashLinkToken(token)), "the hash of the token is stored");
  assert.ok(!resets.rows.has(token), "the token itself is not stored");
  assert.match(mailer.sent[0]!.text, /https:\/\/shop\.test\/northgate\/redefinir\?area=owner&token=/);
});

test("a request for an e-mail with no account sends nothing and stores nothing", async () => {
  const { service, resets, mailer } = setup();
  await service.request(shop, "owner", "nobody@example.com");
  await service.request(otherShop, "owner", "owner@example.com");
  assert.equal(mailer.sent.length, 0);
  assert.equal(resets.rows.size, 0);
});

test("a new password is set, and the link cannot be used a second time", async () => {
  const { service, owners, mailer } = setup();
  await service.request(shop, "owner", "owner@example.com");
  const token = tokenIn(mailer);

  await service.confirm(shop, token, NEW_PASSWORD);
  assert.equal(await verifyPassword(NEW_PASSWORD, owners.owner.passwordHash), true);
  assert.equal(owners.owner.sessionVersion, 2, "the owner's other sessions end");

  await assert.rejects(service.confirm(shop, token, "Another-long-password-2030"), (error: unknown) => {
    return error instanceof Error && /no longer valid/.test(error.message);
  });
});

test("a link from one shop does not work in another", async () => {
  const { service, mailer } = setup();
  await service.request(shop, "owner", "owner@example.com");
  await assert.rejects(service.confirm(otherShop, tokenIn(mailer), NEW_PASSWORD), /no longer valid/);
});

test("a link stops working after an hour", async () => {
  let now = NOW;
  const { service, mailer } = setup({ now: () => now, today: () => "2030-01-01" });
  await service.request(shop, "owner", "owner@example.com");
  const token = tokenIn(mailer);

  now = new Date(NOW.getTime() + HOUR);
  await assert.rejects(service.confirm(shop, token, NEW_PASSWORD), /no longer valid/);
});

test("a barber's new password ends that barber's sign-ins", async () => {
  const { service, barbers, mailer, revoked } = setup();
  await service.request(shop, "barber", "daniel@example.com");
  await service.confirm(shop, tokenIn(mailer), NEW_PASSWORD);

  assert.equal(await verifyPassword(NEW_PASSWORD, barbers.account.passwordHash), true);
  assert.deepEqual(revoked, [20]);
});

test("an unknown token is refused and nothing is stored", async () => {
  const { service, resets } = setup();
  await assert.rejects(service.confirm(shop, "short", NEW_PASSWORD), /no longer valid/);
  assert.equal(resets.rows.size, 0);
});
