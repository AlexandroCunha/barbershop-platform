import assert from "node:assert/strict";
import { test } from "node:test";
import { instantOf } from "../utils/zoned-time.js";

test("a wall-clock time in winter is read as GMT in Dublin", () => {
  assert.equal(instantOf("2030-01-15", 10 * 60, "Europe/Dublin").toISOString(), "2030-01-15T10:00:00.000Z");
});

test("a wall-clock time in summer is read as Irish summer time", () => {
  assert.equal(instantOf("2030-06-15", 10 * 60, "Europe/Dublin").toISOString(), "2030-06-15T09:00:00.000Z");
});

test("the offset is read on the day the clocks change, not once for the whole year", () => {
  // Clocks go forward in Dublin at 01:00 UTC on the last Sunday of March 2030 (31 March).
  assert.equal(instantOf("2030-03-31", 3 * 60, "Europe/Dublin").toISOString(), "2030-03-31T02:00:00.000Z");
  assert.equal(instantOf("2030-03-30", 3 * 60, "Europe/Dublin").toISOString(), "2030-03-30T03:00:00.000Z");
});
