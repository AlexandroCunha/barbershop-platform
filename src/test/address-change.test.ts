import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import { ADDRESS_CHANGE_INTERVAL_DAYS, nextAddressChange } from "../domain/address.js";
import type { Tenant } from "../domain/tenant.js";
import type { MediaStorage } from "../media/media-storage.js";
import type { TenantRepository } from "../repositories/types.js";
import { AdminService } from "../services/admin-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2030-06-01T10:00:00Z");

const shop: Tenant = {
  id: 1,
  slug: "northgate",
  name: "Northgate",
  business: DEFAULT_BUSINESS,
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};

test("a shop that never changed its address may change it now", () => {
  assert.equal(nextAddressChange(null, NOW), null);
});

test("after a change, the next one waits for the whole interval", () => {
  const changedAt = new Date(NOW.getTime() - (ADDRESS_CHANGE_INTERVAL_DAYS - 1) * DAY_MS);
  const next = nextAddressChange(changedAt, NOW);
  assert.ok(next, "still waiting");
  assert.equal(next.getTime(), changedAt.getTime() + ADDRESS_CHANGE_INTERVAL_DAYS * DAY_MS);

  const longAgo = new Date(NOW.getTime() - (ADDRESS_CHANGE_INTERVAL_DAYS + 1) * DAY_MS);
  assert.equal(nextAddressChange(longAgo, NOW), null);
});

/** Records what the service asks of the database and the photo storage. */
function setup(options: { lastChange?: Date | null; taken?: boolean; failChange?: boolean } = {}) {
  const moves: [string, string][] = [];
  const changes: string[] = [];

  const tenants = {
    lastAddressChange: async () => options.lastChange ?? null,
    addressInUse: async () => options.taken ?? false,
    changeSlug: async (id: number, oldSlug: string, newSlug: string) => {
      if (options.failChange) throw new AppError(409, "That address is already taken. Choose another.");
      changes.push(`${oldSlug}->${newSlug}`);
      return { ...shop, id, slug: newSlug };
    },
  } as unknown as TenantRepository;

  const media = {
    rename: async (from: string, to: string) => {
      moves.push([from, to]);
    },
  } as unknown as MediaStorage;

  const clock: Clock = { now: () => NOW, today: () => "2030-06-01" };
  const service = new AdminService(tenants, media, {} as never, {} as never, clock);
  return { service, moves, changes };
}

test("the address must be valid, and different from the current one", async () => {
  const { service } = setup();
  await assert.rejects(service.changeAddress(shop, "Not Valid!"), (error: unknown) => error instanceof AppError && error.status === 400);
  await assert.rejects(service.changeAddress(shop, "api"), (error: unknown) => error instanceof AppError && error.status === 400);
  await assert.rejects(service.changeAddress(shop, "NorthGate"), (error: unknown) => error instanceof AppError && error.status === 400);
});

test("a second change within the interval is refused with the date it is allowed", async () => {
  const changedAt = new Date(NOW.getTime() - DAY_MS);
  const { service, moves } = setup({ lastChange: changedAt });

  await assert.rejects(service.changeAddress(shop, "wedge"), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 429);
    assert.match(error.message, /again after \d+ \w+ \d{4}\./);
    return true;
  });
  assert.deepEqual(moves, [], "no photo moves when the change is refused");
});

test("an address that is taken, or was used by another shop, is refused", async () => {
  const { service, moves } = setup({ taken: true });
  await assert.rejects(service.changeAddress(shop, "wedge"), (error: unknown) => error instanceof AppError && error.status === 409);
  assert.deepEqual(moves, []);
});

test("a change moves the photos and records the new address", async () => {
  const { service, moves, changes } = setup();
  const updated = await service.changeAddress(shop, "Wedge");

  assert.equal(updated.slug, "wedge");
  assert.deepEqual(moves, [["northgate", "wedge"]]);
  assert.deepEqual(changes, ["northgate->wedge"]);
});

test("when the database refuses the change, the photos go back to their folder", async () => {
  const { service, moves } = setup({ failChange: true });
  await assert.rejects(service.changeAddress(shop, "wedge"), (error: unknown) => error instanceof AppError && error.status === 409);
  assert.deepEqual(moves, [
    ["northgate", "wedge"],
    ["wedge", "northgate"],
  ]);
});
