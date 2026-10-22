import assert from "node:assert/strict";
import { test } from "node:test";
import { createLinkToken, hashLinkToken } from "../auth/link-token.js";
import { issueManageToken, readManageToken } from "../auth/manage-token.js";

const SECRET = "test-secret-test-secret-test-secret-32";
const BOOKING = "423fc28f-e102-4dd5-bc0d-4ede4cfaa91a";
const NOW = new Date("2030-06-01T10:00:00Z");
const LATER = new Date("2030-09-01T10:00:00Z");

test("link tokens are long, unique and stored only as a hash", () => {
  const first = createLinkToken();
  const second = createLinkToken();
  assert.equal(first.length, 43, "32 random bytes in base64url");
  assert.notEqual(first, second);
  assert.notEqual(hashLinkToken(first), first, "the stored value is not the token");
  assert.equal(hashLinkToken(first), hashLinkToken(first), "the same token always hashes the same way");
});

test("a manage token reads back the booking it was issued for", () => {
  const token = issueManageToken(SECRET, { tenantId: 7, bookingId: BOOKING }, LATER);
  assert.deepEqual(readManageToken(SECRET, token, NOW), { tenantId: 7, bookingId: BOOKING });
});

test("a manage token is refused when it is changed, signed with another secret, or expired", () => {
  const token = issueManageToken(SECRET, { tenantId: 7, bookingId: BOOKING }, LATER);
  const [body, signature] = token.split(".") as [string, string];

  const forgedBody = Buffer.from(JSON.stringify({ tenantId: 8, bookingId: BOOKING, expiresAt: LATER.getTime() })).toString("base64url");
  assert.equal(readManageToken(SECRET, `${forgedBody}.${signature}`, NOW), null, "a changed payload");
  assert.equal(readManageToken(SECRET, `${body}.${signature}x`, NOW), null, "a changed signature");
  assert.equal(readManageToken("another-secret-another-secret-another-32", token, NOW), null, "another secret");
  assert.equal(readManageToken(SECRET, token, LATER), null, "at the expiry instant");
  assert.equal(readManageToken(SECRET, undefined, NOW), null, "no token");
  assert.equal(readManageToken(SECRET, "not.a.token", NOW), null, "too many parts");
});

test("a manage token cannot be a session token, even though both are signed", () => {
  const token = issueManageToken(SECRET, { tenantId: 7, bookingId: BOOKING }, LATER);
  const withOtherPayload = Buffer.from(JSON.stringify({ kind: "owner", tenantId: 7, ownerId: 1 })).toString("base64url");
  const [, signature] = token.split(".") as [string, string];
  assert.equal(readManageToken(SECRET, `${withOtherPayload}.${signature}`, NOW), null);
});
