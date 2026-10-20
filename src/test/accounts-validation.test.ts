import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLicense, parseLogin, parseNewTenant, parseNewPassword } from "../validations/accounts.js";
import { AppError } from "../utils/app-error.js";

const validTenant = {
  name: "Northgate Barber",
  slug: "northgate",
  ownerEmail: "Owner@Example.com",
  ownerPassword: "a long enough password",
};

test("a new shop needs a name, a valid address, an email and a long password", () => {
  const input = parseNewTenant(validTenant);
  assert.equal(input.ownerEmail, "owner@example.com");
  assert.throws(() => parseNewTenant({ ...validTenant, slug: "admin" }), AppError);
  assert.throws(() => parseNewTenant({ ...validTenant, ownerPassword: "short" }), AppError);
  assert.throws(() => parseNewTenant({ ...validTenant, ownerEmail: "not-an-email" }), AppError);
});

test("passwords must be at least 12 characters", () => {
  assert.equal(parseNewPassword("twelve chars"), "twelve chars");
  assert.throws(() => parseNewPassword("eleven char"), AppError);
});

test("licence updates accept only the three statuses and real dates", () => {
  const input = parseLicense({ status: "active", paidUntil: "2031-01-01T00:00:00Z" });
  assert.equal(input.status, "active");
  assert.equal(input.paidUntil?.toISOString(), "2031-01-01T00:00:00.000Z");
  assert.throws(() => parseLicense({ status: "free" }), AppError);
  assert.throws(() => parseLicense({ status: "trial", trialEndsAt: "soon" }), AppError);
});

test("sign-in needs an email and a password", () => {
  assert.deepEqual(parseLogin({ email: " Owner@Example.com ", password: "x" }), {
    email: "owner@example.com",
    password: "x",
  });
  assert.throws(() => parseLogin({ email: "a@b.c", password: "" }), AppError);
});
