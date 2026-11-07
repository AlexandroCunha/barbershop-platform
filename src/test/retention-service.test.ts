import assert from "node:assert/strict";
import { test } from "node:test";
import type { RetentionRepository } from "../repositories/types.js";
import { RetentionService } from "../services/retention-service.js";
import type { Clock } from "../utils/clock.js";

const clockAt = (iso: string): Clock => ({
  now: () => new Date(iso),
  today: () => iso.slice(0, 10),
});

function fakeRepository(): RetentionRepository & { cutoffs: string[] } {
  const cutoffs: string[] = [];
  return {
    cutoffs,
    async anonymiseBookingsBefore(cutoff: string): Promise<number> {
      cutoffs.push(cutoff);
      return 3;
    },
  };
}

test("bookings older than the retention period are anonymised", async () => {
  const repository = fakeRepository();
  const service = new RetentionService(repository, clockAt("2026-11-07T10:00:00Z"), 24);

  assert.equal(await service.run(), 3);
  assert.deepEqual(repository.cutoffs, ["2024-11-07"]);
});

test("the cutoff stays inside shorter months", () => {
  const service = new RetentionService(fakeRepository(), clockAt("2026-03-31T10:00:00Z"), 1);
  assert.equal(service.cutoffDate(), "2026-02-28");

  const leapYear = new RetentionService(fakeRepository(), clockAt("2028-03-31T10:00:00Z"), 1);
  assert.equal(leapYear.cutoffDate(), "2028-02-29");
});

test("the cutoff crosses year boundaries", () => {
  const service = new RetentionService(fakeRepository(), clockAt("2026-01-15T10:00:00Z"), 13);
  assert.equal(service.cutoffDate(), "2024-12-15");
});

test("0 months keeps everything and never touches the data", async () => {
  const repository = fakeRepository();
  const service = new RetentionService(repository, clockAt("2026-11-07T10:00:00Z"), 0);

  assert.equal(await service.run(), 0);
  assert.deepEqual(repository.cutoffs, []);
});
