import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import { allowsBookings, licenseInfo, type Tenant } from "../domain/tenant.js";

const NOW = new Date("2030-06-01T12:00:00Z");
const hour = 60 * 60 * 1000;

function tenant(overrides: Partial<Tenant>): Tenant {
  return {
    id: 1,
    slug: "northgate",
    name: "Northgate",
    business: DEFAULT_BUSINESS,
    licenseStatus: "trial",
    trialEndsAt: new Date(NOW.getTime() + hour),
    paidUntil: null,
    ...overrides,
  };
}

test("a trial is open until its end date", () => {
  const info = licenseInfo(tenant({}), NOW);
  assert.equal(info.state, "trial");
  assert.equal(allowsBookings(info.state), true);
});

test("an expired trial closes bookings", () => {
  const info = licenseInfo(tenant({ trialEndsAt: new Date(NOW.getTime() - hour) }), NOW);
  assert.equal(info.state, "expired");
  assert.equal(allowsBookings(info.state), false);
});

test("an active licence without an end date stays open", () => {
  const info = licenseInfo(tenant({ licenseStatus: "active", paidUntil: null }), NOW);
  assert.equal(info.state, "active");
  assert.equal(allowsBookings(info.state), true);
});

test("an active licence whose paid period has ended is expired", () => {
  const info = licenseInfo(tenant({ licenseStatus: "active", paidUntil: new Date(NOW.getTime() - hour) }), NOW);
  assert.equal(info.state, "expired");
});

test("a suspended shop is closed even during its trial", () => {
  const info = licenseInfo(tenant({ licenseStatus: "suspended" }), NOW);
  assert.equal(info.state, "suspended");
  assert.equal(allowsBookings(info.state), false);
});
