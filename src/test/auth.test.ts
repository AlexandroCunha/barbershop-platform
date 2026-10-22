import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import { issueToken, readToken, stringsMatch } from "../auth/tokens.js";
import { parseCookies } from "../utils/cookies.js";

const SECRET = "a-test-secret-that-is-long-enough-to-use";
const NOW_MS = 1_800_000_000_000;
const NOW_SECONDS = NOW_MS / 1000;

test("a token verifies with its own key until it expires", () => {
  const token = issueToken(SECRET, { kind: "owner", exp: NOW_SECONDS + 60, tenantId: 1, ownerId: 2, version: 3 });

  assert.deepEqual(readToken(SECRET, token, NOW_MS), {
    kind: "owner",
    exp: NOW_SECONDS + 60,
    tenantId: 1,
    ownerId: 2,
    version: 3,
  });
  assert.equal(readToken(SECRET, token, (NOW_SECONDS + 61) * 1000), null);
});

test("a token signed with another key, or changed in transit, is rejected", () => {
  const token = issueToken(SECRET, { kind: "owner", exp: NOW_SECONDS + 60 });
  const [body, signature] = token.split(".") as [string, string];
  const forgedBody = Buffer.from(JSON.stringify({ kind: "owner", exp: NOW_SECONDS + 9999 })).toString("base64url");

  assert.equal(readToken("another-secret-that-is-also-long-enough", token, NOW_MS), null);
  assert.equal(readToken(SECRET, `${forgedBody}.${signature}`, NOW_MS), null);
  assert.equal(readToken(SECRET, `${body}.x`, NOW_MS), null);
  assert.equal(readToken(SECRET, "not-a-token", NOW_MS), null);
  assert.equal(readToken(SECRET, undefined, NOW_MS), null);
});

test("secrets are compared in full", () => {
  assert.equal(stringsMatch("abc", "abc"), true);
  assert.equal(stringsMatch("abc", "abcd"), false);
});

test("passwords verify against their hash only", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", stored), true);
  assert.equal(await verifyPassword("correct horse battery!", stored), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.notEqual(stored.includes("correct horse"), true);
});

test("cookie headers are read by name without prototype surprises", () => {
  const cookies = parseCookies("theme=dark; owner_session=abc.def; broken");
  assert.equal(cookies.owner_session, "abc.def");
  assert.equal(cookies.broken, undefined);
  assert.equal(cookies.constructor, undefined);
});
