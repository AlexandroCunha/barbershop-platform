import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config/env.js";

const base = { DATABASE_URL: "postgres://example.test/barbearia", SESSION_SECRET: "a".repeat(32) };

test("TRUST_PROXY is a count of reverse proxies, and unset means none", () => {
  assert.equal(loadConfig({ ...base }).trustProxyHops, 0);
  assert.equal(loadConfig({ ...base, TRUST_PROXY: "0" }).trustProxyHops, 0);
  assert.equal(loadConfig({ ...base, TRUST_PROXY: "1" }).trustProxyHops, 1);
  assert.equal(loadConfig({ ...base, TRUST_PROXY: "2" }).trustProxyHops, 2);
});

test("TRUST_PROXY=true and out-of-range values are refused with guidance", () => {
  assert.throws(() => loadConfig({ ...base, TRUST_PROXY: "true" }), /number of reverse proxies/);
  assert.throws(() => loadConfig({ ...base, TRUST_PROXY: "9" }), /number of reverse proxies/);
  assert.throws(() => loadConfig({ ...base, TRUST_PROXY: "-1" }), /number of reverse proxies/);
});
