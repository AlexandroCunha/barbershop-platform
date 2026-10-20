import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidSlug, slugFromName } from "../domain/slug.js";

test("accepts ordinary shop addresses", () => {
  assert.equal(isValidSlug("northgate"), true);
  assert.equal(isValidSlug("north-gate-2"), true);
});

test("rejects reserved words, dashes at the edges and uppercase", () => {
  assert.equal(isValidSlug("admin"), false);
  assert.equal(isValidSlug("platform"), false);
  assert.equal(isValidSlug("-north"), false);
  assert.equal(isValidSlug("north-"), false);
  assert.equal(isValidSlug("North"), false);
  assert.equal(isValidSlug("a"), false);
  assert.equal(isValidSlug("a--b"), false);
});

test("suggests an address from a shop name", () => {
  assert.equal(slugFromName("Northgate Barber Co."), "northgate-barber-co");
  assert.equal(slugFromName("Rene's Barbershop"), "rene-s-barbershop");
});
