import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";
import { CONTENT_SECURITY_POLICY, securityHeaders } from "../middlewares/security-headers.js";

function headersSentBy(hsts: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  const response = { setHeader: (name: string, value: string) => void (headers[name] = value) } as unknown as Response;
  let continued = false;
  securityHeaders({ hsts })({} as Request, response, () => {
    continued = true;
  });
  assert.ok(continued, "the middleware passes the request on");
  return headers;
}

test("the page loads nothing from other websites, so no visitor data goes to third parties", () => {
  assert.doesNotMatch(CONTENT_SECURITY_POLICY, /https?:\/\//);
  assert.match(CONTENT_SECURITY_POLICY, /frame-ancestors 'none'/);
  assert.match(CONTENT_SECURITY_POLICY, /object-src 'none'/);
});

test("every response carries the protective headers", () => {
  const headers = headersSentBy(false);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
  assert.ok(headers["Referrer-Policy"]);
  assert.ok(headers["Permissions-Policy"]);
});

test("HSTS is sent only when the site is served over HTTPS", () => {
  assert.equal(headersSentBy(false)["Strict-Transport-Security"], undefined);
  assert.match(headersSentBy(true)["Strict-Transport-Security"] ?? "", /max-age=63072000/);
});
