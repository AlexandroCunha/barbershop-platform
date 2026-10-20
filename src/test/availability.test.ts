import assert from "node:assert/strict";
import { test } from "node:test";
import { availableStartMinutes } from "../domain/availability.js";

const nineToTen = { openMinute: 9 * 60, closeMinute: 10 * 60 };

test("offers every grid start that fits before closing", () => {
  const starts = availableStartMinutes({ window: nineToTen, durationMinutes: 30, busy: [] });
  assert.deepEqual(starts, [540, 570]);
});

test("skips starts that overlap an existing booking", () => {
  const busy = [{ startMinute: 540, endMinute: 570 }];
  const starts = availableStartMinutes({ window: nineToTen, durationMinutes: 30, busy });
  assert.deepEqual(starts, [570]);
});

test("a back-to-back booking does not block the next slot", () => {
  const busy = [{ startMinute: 570, endMinute: 600 }];
  const starts = availableStartMinutes({ window: nineToTen, durationMinutes: 30, busy });
  assert.deepEqual(starts, [540]);
});

test("returns nothing on closed days", () => {
  assert.deepEqual(availableStartMinutes({ window: null, durationMinutes: 30, busy: [] }), []);
});
