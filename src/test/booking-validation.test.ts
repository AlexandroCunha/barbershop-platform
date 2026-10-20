import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBookingRequest } from "../validations/booking.js";

const validBody = {
  serviceId: 1,
  date: "2030-01-07",
  time: "09:30",
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  customerPhone: "+353 85 123 4567",
};

test("accepts a booking with a mobile phone and converts the time", () => {
  const request = parseBookingRequest(validBody);
  assert.equal(request.customerPhone, "+353 85 123 4567");
  assert.equal(request.startMinute, 9 * 60 + 30);
});

test("rejects a missing or malformed mobile phone", () => {
  assert.throws(() => parseBookingRequest({ ...validBody, customerPhone: "" }), /customerPhone/);
  assert.throws(() => parseBookingRequest({ ...validBody, customerPhone: "call me" }), /customerPhone/);
  assert.throws(() => parseBookingRequest({ ...validBody, customerPhone: "123" }), /customerPhone/);
});
