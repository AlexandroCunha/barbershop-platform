import assert from "node:assert/strict";
import { test } from "node:test";
import { readManageToken } from "../auth/manage-token.js";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Tenant } from "../domain/tenant.js";
import { BookingMessages, type BookingFacts } from "../services/booking-messages.js";
import type { Clock } from "../utils/clock.js";

const SECRET = "test-secret-test-secret-test-secret-32";
const NOW = new Date("2030-01-01T10:00:00Z");
const BOOKING = "423fc28f-e102-4dd5-bc0d-4ede4cfaa91a";
const clock: Clock = { now: () => NOW, today: () => "2030-01-01" };

const tenant: Tenant = {
  id: 3,
  slug: "northgate",
  name: "Northgate",
  business: { ...DEFAULT_BUSINESS, name: "Northgate Barbers" },
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};

/** A booking on 7 January 2030 at 10:00 (GMT in Dublin), which is more than a day after NOW. */
const facts: BookingFacts = {
  tenant,
  serviceName: "Haircut",
  barberName: "Daniel",
  date: "2030-01-07",
  startMinute: 10 * 60,
  endMinute: 10 * 60 + 30,
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  customerPhone: "+353 85 123 4567",
  priceCents: 2500,
};

const messages = (enabled = true) => new BookingMessages({ secret: SECRET, publicUrl: "https://shop.test", enabled }, clock);

test("a new booking queues a confirmation now and a reminder the day before", () => {
  const drafts = messages().created(facts, BOOKING, null);

  assert.deepEqual(
    drafts.map((draft) => draft.kind),
    ["confirmation", "reminder"],
  );
  assert.equal(drafts[0]!.sendAt.getTime(), NOW.getTime());
  assert.equal(drafts[1]!.sendAt.toISOString(), "2030-01-06T10:00:00.000Z");
  assert.equal(drafts[0]!.toAddress, "ada@example.com");
});

test("the link in a confirmation opens exactly this booking, in this shop", () => {
  const [confirmation] = messages().created(facts, BOOKING, null);
  const link = confirmation!.body.match(/https:\/\/shop\.test\/northgate\/reserva\?token=(\S+)/);
  assert.ok(link, "the body names the manage link");

  const claims = readManageToken(SECRET, link[1], NOW);
  assert.deepEqual(claims, { tenantId: 3, bookingId: BOOKING });
  assert.match(confirmation!.body, /Monday 7 January at 10:00 to 10:30/);
});

test("no reminder is queued when the booking is less than a day away", () => {
  const soon = { ...facts, date: "2030-01-01", startMinute: 11 * 60, endMinute: 11 * 60 + 30 };
  assert.deepEqual(
    messages().created(soon, BOOKING, null).map((draft) => draft.kind),
    ["confirmation"],
  );
});

test("a cancellation and a move each queue one message, and a move brings the reminder along", () => {
  assert.deepEqual(messages().cancelled(facts, BOOKING, null).map((draft) => draft.kind), ["cancellation"]);
  assert.deepEqual(messages().moved(facts, BOOKING, null).map((draft) => draft.kind), ["moved", "reminder"]);
});

test("nothing is queued when mail is off", () => {
  const off = messages(false);
  assert.deepEqual(off.created(facts, BOOKING, null), []);
  assert.deepEqual(off.cancelled(facts, BOOKING, "daniel@example.com"), []);
  assert.deepEqual(off.moved(facts, BOOKING, "daniel@example.com"), []);
});

test("a barber with a login hears about each new booking, with the customer's contact details", () => {
  const drafts = messages().created(facts, BOOKING, "daniel@example.com");
  const note = drafts.find((draft) => draft.kind === "barber-booking");

  assert.ok(note, "the barber is told");
  assert.equal(note.toAddress, "daniel@example.com");
  assert.match(note.subject, /New booking: Ada Lovelace/);
  assert.match(note.body, /Phone: \+353 85 123 4567/);
  assert.match(note.body, /Email: ada@example.com/);
  assert.match(note.body, /https:\/\/shop\.test\/northgate\/barber/);
  assert.ok(!note.body.includes("token="), "the barber's note carries no customer link");
});

test("a barber without a login is not e-mailed about the booking", () => {
  assert.ok(!messages().created(facts, BOOKING, null).some((draft) => draft.kind === "barber-booking"));
});

test("a barber is told when a booking in their chair is cancelled or moved, with the same summary", () => {
  const cancelled = messages().cancelled(facts, BOOKING, "daniel@example.com").find((draft) => draft.kind === "barber-cancellation");
  const moved = messages().moved(facts, BOOKING, "daniel@example.com").find((draft) => draft.kind === "barber-moved");

  assert.equal(cancelled?.toAddress, "daniel@example.com");
  assert.match(cancelled?.subject ?? "", /^Cancelled: Ada Lovelace/);
  assert.match(cancelled?.body ?? "", /Email: ada@example\.com/);
  assert.match(cancelled?.body ?? "", /Total: /);
  assert.equal(moved?.toAddress, "daniel@example.com");
  assert.match(moved?.subject ?? "", /^Moved: Ada Lovelace/);
  assert.match(moved?.body ?? "", /Duration: /);
});

test("a barber without a contact address or login is not told about a cancellation or move", () => {
  assert.ok(!messages().cancelled(facts, BOOKING, null).some((draft) => draft.kind === "barber-cancellation"));
  assert.ok(!messages().moved(facts, BOOKING, null).some((draft) => draft.kind === "barber-moved"));
});
