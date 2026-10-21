import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config/env.js";

const base = { DATABASE_URL: "postgres://example.test/barbearia", SESSION_SECRET: "a".repeat(32) };
const s3 = {
  MEDIA_STORAGE: "s3",
  S3_BUCKET: "photos",
  S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  S3_ACCESS_KEY_ID: "key-id",
  S3_SECRET_ACCESS_KEY: "key-secret",
};

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

test("photos are kept on local disk unless MEDIA_STORAGE asks for S3", () => {
  assert.deepEqual(loadConfig({ ...base }).media, { kind: "local" });
  assert.deepEqual(loadConfig({ ...base, MEDIA_STORAGE: "local" }).media, { kind: "local" });
  assert.throws(() => loadConfig({ ...base, MEDIA_STORAGE: "ftp" }), /MEDIA_STORAGE must be "local" or "s3"/);
});

test("S3 storage reads its settings, with the region defaulting to auto", () => {
  const media = loadConfig({ ...base, ...s3 }).media;
  assert.deepEqual(media, {
    kind: "s3",
    settings: {
      bucket: "photos",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      accessKeyId: "key-id",
      secretAccessKey: "key-secret",
    },
  });
});

test("S3 storage names every missing variable, and never prints a value", () => {
  const { S3_SECRET_ACCESS_KEY: _omitted, ...incomplete } = s3;
  assert.throws(
    () => loadConfig({ ...base, ...incomplete, S3_BUCKET: "" }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "MEDIA_STORAGE=s3 needs these variables: S3_BUCKET, S3_SECRET_ACCESS_KEY",
  );
});
