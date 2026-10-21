import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import { parseBusiness } from "../domain/business.js";

const valid = {
  ...DEFAULT_BUSINESS,
  name: "Northgate",
  email: "owner@example.com",
  instagram: "@northgate",
  currency: "eur",
  heroImage: "hero-shot.jpg",
};

test("accepts a complete profile and normalises it", () => {
  const business = parseBusiness(valid);
  assert.equal(business.currency, "EUR");
  assert.equal(business.instagram, "northgate");
});

test("requires a name and a real time zone", () => {
  assert.throws(() => parseBusiness({ ...valid, name: "" }));
  assert.throws(() => parseBusiness({ ...valid, timeZone: "Mars/Olympus" }));
});

test("rejects hours that close before they open", () => {
  const hours = { ...valid.hours, monday: { open: "19:00", close: "09:00" } };
  assert.throws(() => parseBusiness({ ...valid, hours }));
});

test("rejects a hero image that is a path rather than a media file name", () => {
  assert.throws(() => parseBusiness({ ...valid, heroImage: "../secrets.txt" }));
});

test("accepts an empty Instagram handle but rejects one that would change the link's path", () => {
  assert.equal(parseBusiness({ ...valid, instagram: "" }).instagram, "");
  assert.throws(() => parseBusiness({ ...valid, instagram: "north/gate" }));
  assert.throws(() => parseBusiness({ ...valid, instagram: "north?x=1" }));
  assert.throws(() => parseBusiness({ ...valid, instagram: "north gate" }));
});
