import assert from "node:assert/strict";
import { test } from "node:test";
import { OwnerAuth, SESSION_TTL_SECONDS, secretsMatch } from "../auth/owner-auth.js";
import { parseCookies } from "../utils/cookies.js";

const TOKEN = "a-long-random-owner-token-value";
const START_MS = 1_800_000_000_000;

function clock(startMs = START_MS) {
  let current = startMs;
  return {
    now: () => current,
    advanceSeconds: (seconds: number) => {
      current += seconds * 1000;
    },
  };
}

test("accepts only the exact access token", () => {
  const auth = new OwnerAuth(TOKEN);
  assert.equal(auth.checkToken(TOKEN), true);
  assert.equal(auth.checkToken("wrong"), false);
  assert.equal(auth.checkToken(`${TOKEN}x`), false);
  assert.equal(auth.checkToken(""), false);
});

test("never accepts a token when none is configured", () => {
  const auth = new OwnerAuth(undefined);
  assert.equal(auth.isConfigured, false);
  assert.equal(auth.checkToken(""), false);
  assert.equal(auth.verifySession("123.abc"), false);
});

test("a session issued by the server verifies until it expires", () => {
  const time = clock();
  const auth = new OwnerAuth(TOKEN, time.now);
  const session = auth.issueSession();

  assert.equal(auth.verifySession(session), true);

  time.advanceSeconds(SESSION_TTL_SECONDS - 1);
  assert.equal(auth.verifySession(session), true);

  time.advanceSeconds(2);
  assert.equal(auth.verifySession(session), false);
});

test("a tampered or malformed session is rejected", () => {
  const auth = new OwnerAuth(TOKEN, clock().now);
  const [expires, signature] = auth.issueSession().split(".") as [string, string];

  const later = String(Number(expires) + 100_000);
  assert.equal(auth.verifySession(`${later}.${signature}`), false);
  assert.equal(auth.verifySession(`${expires}.${"0".repeat(signature.length)}`), false);
  assert.equal(auth.verifySession(`${expires}`), false);
  assert.equal(auth.verifySession(`${expires}.${signature}.extra`), false);
  assert.equal(auth.verifySession(undefined), false);
});

test("sessions stop working when the access token changes", () => {
  const time = clock();
  const session = new OwnerAuth(TOKEN, time.now).issueSession();
  const rotated = new OwnerAuth("another-long-random-owner-token", time.now);

  assert.equal(rotated.verifySession(session), false);
});

test("secretsMatch compares full values", () => {
  assert.equal(secretsMatch("abc", "abc"), true);
  assert.equal(secretsMatch("abc", "abcd"), false);
});

test("parseCookies reads named cookies and ignores malformed pairs", () => {
  const cookies = parseCookies("theme=dark; owner_session=123.abc; broken; =nothing");
  assert.equal(cookies.owner_session, "123.abc");
  assert.equal(cookies.theme, "dark");
  assert.equal(cookies.broken, undefined);
  assert.equal(parseCookies(undefined).owner_session, undefined);
});

test("parseCookies does not expose prototype properties", () => {
  const cookies = parseCookies("x=1");
  assert.equal(cookies.constructor, undefined);
  assert.equal(cookies.toString, undefined);
});
