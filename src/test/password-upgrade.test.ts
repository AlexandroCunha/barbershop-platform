import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { test } from "node:test";
import { hashPassword, needsRehash, verifyPassword } from "../auth/passwords.js";

const PASSWORD = "correct horse battery";

test("new hashes use the OWASP scrypt settings and do not need a rehash", async () => {
  const stored = await hashPassword(PASSWORD);

  assert.ok(stored.startsWith("scrypt$131072$8$1$"), `unexpected settings in ${stored.split("$").slice(0, 4).join("$")}`);
  assert.equal(needsRehash(stored), false);
  assert.equal(await verifyPassword(PASSWORD, stored), true);
});

test("a hash made with the old, weaker settings still verifies, and is flagged for rehash", async () => {
  const salt = randomBytes(16);
  const key = scryptSync(PASSWORD, salt, 64, { N: 16384, r: 8, p: 1 });
  const legacy = ["scrypt", 16384, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");

  assert.equal(await verifyPassword(PASSWORD, legacy), true);
  assert.equal(await verifyPassword("not the password", legacy), false);
  assert.equal(needsRehash(legacy), true);
});
