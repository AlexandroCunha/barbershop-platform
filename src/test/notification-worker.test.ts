import assert from "node:assert/strict";
import { test } from "node:test";
import type { Mailer, OutgoingMail } from "../mail/mailer.js";
import type { ClaimedNotification, NotificationRepository } from "../repositories/types.js";
import { NotificationWorker } from "../services/notification-worker.js";
import type { Clock } from "../utils/clock.js";

const NOW = new Date("2030-01-01T10:00:00Z");
const clock: Clock = { now: () => NOW, today: () => "2030-01-01" };
const MINUTE = 60_000;

interface Row {
  id: number;
  toAddress: string;
  subject: string;
  body: string;
  html: string;
  sendAt: Date;
  attempts: number;
  retryAt: Date | null;
  sent: boolean;
  failed: boolean;
}

/** An outbox with the same claim rule as the database: due, not sent or given up, and not leased. */
class MemoryOutbox implements NotificationRepository {
  readonly rows: Row[] = [];

  async claimDue(now: Date, leaseUntil: Date, limit: number): Promise<ClaimedNotification[]> {
    const due = this.rows
      .filter((row) => !row.sent && !row.failed && row.sendAt <= now && (!row.retryAt || row.retryAt <= now))
      .slice(0, limit);
    for (const row of due) {
      row.attempts += 1;
      row.retryAt = leaseUntil;
    }
    return due.map((row) => ({ id: row.id, toAddress: row.toAddress, subject: row.subject, body: row.body, html: row.html, attempts: row.attempts }));
  }

  async markSent(id: number): Promise<void> {
    const row = this.find(id);
    Object.assign(row, { sent: true, retryAt: null, toAddress: "", body: "" });
  }

  async markRetry(id: number, retryAt: Date): Promise<void> {
    this.find(id).retryAt = retryAt;
  }

  async markFailed(id: number): Promise<void> {
    Object.assign(this.find(id), { failed: true, retryAt: null, toAddress: "", body: "" });
  }

  private find(id: number): Row {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`no message ${id}`);
    return row;
  }
}

/** A mailer that refuses the messages to the given addresses, and records what it sent. */
class TestMailer implements Mailer {
  readonly sent: OutgoingMail[] = [];
  refuse = false;

  async send(mail: OutgoingMail): Promise<void> {
    if (this.refuse) throw new Error("the mail server refused the message");
    this.sent.push(mail);
  }
}

function outboxWith(...rows: Partial<Row>[]): MemoryOutbox {
  const outbox = new MemoryOutbox();
  rows.forEach((row, index) =>
    outbox.rows.push({
      id: index + 1,
      toAddress: "ada@example.com",
      subject: "Booking confirmed",
      body: "Your booking is confirmed.",
      html: "<p>Your booking is confirmed.</p>",
      sendAt: NOW,
      attempts: 0,
      retryAt: null,
      sent: false,
      failed: false,
      ...row,
    }),
  );
  return outbox;
}

test("due messages are sent, and their address and text are cleared once sent", async () => {
  const outbox = outboxWith({}, { sendAt: new Date(NOW.getTime() + MINUTE) });
  const mailer = new TestMailer();

  const handled = await new NotificationWorker(outbox, mailer, clock).runOnce();

  assert.equal(handled, 1, "the message that is not due yet waits");
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0]!.to, "ada@example.com");
  assert.equal(outbox.rows[0]!.sent, true);
  assert.equal(outbox.rows[0]!.body, "", "the text is no longer kept");
  assert.equal(outbox.rows[0]!.toAddress, "", "the address is no longer kept");
});

test("a message that fails is retried later, and the log names no address or text", async () => {
  const outbox = outboxWith({});
  const mailer = new TestMailer();
  mailer.refuse = true;
  const reports: string[] = [];

  await new NotificationWorker(outbox, mailer, clock, (message) => reports.push(message)).runOnce();

  const row = outbox.rows[0]!;
  assert.equal(row.sent, false);
  assert.equal(row.body, "Your booking is confirmed.", "the text is kept for the retry");
  assert.ok(row.retryAt && row.retryAt > NOW, "retried later");
  assert.equal(reports.length, 1);
  assert.match(reports[0]!, /was not sent \(attempt 1\)/);
  assert.ok(!reports[0]!.includes("ada@example.com") && !reports[0]!.includes("Your booking"), "no address or text in the log");
});

test("a message is given up on after five attempts, and its contents are cleared", async () => {
  const outbox = outboxWith({ attempts: 4 });
  const mailer = new TestMailer();
  mailer.refuse = true;

  await new NotificationWorker(outbox, mailer, clock, () => undefined).runOnce();

  assert.equal(outbox.rows[0]!.failed, true);
  assert.equal(outbox.rows[0]!.body, "");
  assert.equal(outbox.rows[0]!.toAddress, "");
});

test("a message claimed by one run is not sent again by the next, while its lease lasts", async () => {
  const outbox = outboxWith({});
  const mailer = new TestMailer();
  mailer.refuse = true;
  const worker = new NotificationWorker(outbox, mailer, clock, () => undefined);

  await worker.runOnce();
  mailer.refuse = false;
  assert.equal(await worker.runOnce(), 0, "still leased for the retry delay");
  assert.equal(mailer.sent.length, 0);
});
