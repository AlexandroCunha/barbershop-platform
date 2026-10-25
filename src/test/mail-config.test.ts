import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config/env.js";
import { parseMail } from "../config/mail-config.js";
import { ResendMailer, singleLine } from "../mail/mailer.js";

const BASE = { DATABASE_URL: "postgres://example/db", SESSION_SECRET: "x".repeat(40) };

test("development sends e-mail to the terminal by default, and production sends nothing until mail is set up", () => {
  assert.deepEqual(parseMail({}, false), { kind: "console" });
  assert.deepEqual(parseMail({}, true), { kind: "off" });
});

test("the terminal transport is refused on the live site, because its messages contain sign-in links", () => {
  assert.throws(() => parseMail({ MAIL_TRANSPORT: "console" }, true), /development/);
});

test("SMTP needs a host and a sender, and a user only together with a password", () => {
  assert.throws(() => parseMail({ MAIL_TRANSPORT: "smtp" }, true), /SMTP_HOST, MAIL_FROM/);
  assert.throws(() => parseMail({ MAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.example", MAIL_FROM: "no-at-sign" }, true), /MAIL_FROM/);
  assert.throws(
    () => parseMail({ MAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.example", MAIL_FROM: "a@example.com", SMTP_USER: "u" }, true),
    /set together/,
  );
});

test("SMTP uses implicit TLS on port 465 and STARTTLS otherwise, unless SMTP_SECURE says otherwise", () => {
  const base = { MAIL_TRANSPORT: "smtp", SMTP_HOST: "smtp.example", MAIL_FROM: "Shop <a@example.com>" };
  const on587 = parseMail({ ...base, SMTP_PORT: "587" }, true);
  const on465 = parseMail({ ...base, SMTP_PORT: "465" }, true);
  const forced = parseMail({ ...base, SMTP_PORT: "587", SMTP_SECURE: "true" }, true);
  assert.equal(on587.kind === "smtp" && on587.settings.secure, false);
  assert.equal(on465.kind === "smtp" && on465.settings.secure, true);
  assert.equal(forced.kind === "smtp" && forced.settings.secure, true);
});

test("on the live site the public address must be https, and it is kept without a trailing slash", () => {
  assert.throws(() => loadConfig({ ...BASE, NODE_ENV: "production" }), /PUBLIC_URL is required/);
  assert.throws(() => loadConfig({ ...BASE, NODE_ENV: "production", PUBLIC_URL: "http://shop.example" }), /https/);
  assert.equal(loadConfig({ ...BASE, NODE_ENV: "production", PUBLIC_URL: "https://shop.example/" }).publicUrl, "https://shop.example");
  assert.equal(loadConfig(BASE).publicUrl, "http://localhost:3100");
});

test("a subject stays on one line, so a shop name cannot add a mail header", () => {
  assert.equal(singleLine("Booking\r\nBcc: someone@example.com"), "Booking Bcc: someone@example.com");
});

test("Resend's HTTP API needs an API key and a sender with an address", () => {
  assert.throws(() => parseMail({ MAIL_TRANSPORT: "resend", MAIL_FROM: "a@example.com" }, true), /RESEND_API_KEY/);
  assert.throws(() => parseMail({ MAIL_TRANSPORT: "resend", RESEND_API_KEY: "re_x", MAIL_FROM: "no-at" }, true), /MAIL_FROM/);
  const config = parseMail({ MAIL_TRANSPORT: "resend", RESEND_API_KEY: "re_x", MAIL_FROM: "Trimly <a@example.com>" }, true);
  assert.equal(config.kind, "resend");
});

test("the Resend mailer posts to the API with the key, and reports only the status when refused", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = new ResendMailer({ apiKey: "re_secret", from: "Trimly <a@example.com>" }, (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch);
  await ok.send({ to: "ada@example.com", subject: "Hi\r\nBcc: x@example.com", text: "Body", html: "<p>Body</p>" });
  assert.equal(calls[0]!.url, "https://api.resend.com/emails");
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer re_secret");
  const sent = JSON.parse(String(calls[0]!.init.body)) as { to: string[]; subject: string; html: string };
  assert.deepEqual(sent.to, ["ada@example.com"]);
  assert.equal(sent.subject, "Hi Bcc: x@example.com");
  assert.equal(sent.html, "<p>Body</p>");

  const refused = new ResendMailer({ apiKey: "re_secret", from: "a@example.com" }, (async () => new Response("{\"message\":\"ada@example.com\"}", { status: 422 })) as typeof fetch);
  await assert.rejects(refused.send({ to: "ada@example.com", subject: "s", text: "t" }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Resend refused the message with status 422");
    return true;
  });
});
