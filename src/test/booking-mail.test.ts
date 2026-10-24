import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmationMail, type BookingMailDetails } from "../domain/booking-mail.js";
import { escapeHtml } from "../domain/email-template.js";

const details: BookingMailDetails = {
  shopName: "Wedge",
  shopAddress: "24 St Patrick's Road, Dublin 9",
  shopPhone: "+353 83 448 2554",
  mapsUrl: "https://maps.example/wedge",
  serviceName: "Haircut",
  barberName: "Daniel",
  date: "2030-01-07",
  startTime: "10:00",
  endTime: "10:30",
  durationText: "30 min",
  priceText: "€25.00",
  customerName: "Ada Lovelace",
  manageUrl: "https://shop.test/wedge/reserva?token=abc",
  shopUrl: "https://shop.test/wedge",
};

test("escaping turns markup into text", () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert('x')">&`), "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;");
});

test("a confirmation has a plain-text and an HTML version with the same details", () => {
  const mail = confirmationMail(details);
  for (const part of [mail.text, mail.html]) {
    assert.match(part, /Haircut/);
    assert.match(part, /Daniel/);
    assert.match(part, /€25\.00/);
    assert.match(part, /30 min/);
    assert.match(part, /24 St Patrick&#39;s Road|24 St Patrick's Road/);
  }
  assert.match(mail.html, /href="https:\/\/shop\.test\/wedge\/reserva\?token=abc"/);
});

test("a customer name with markup is shown as text in the HTML version", () => {
  const mail = confirmationMail({ ...details, customerName: "<script>alert(1)</script>" });
  assert.ok(!mail.html.includes("<script>"), "no live script tag");
  assert.match(mail.html, /&lt;script&gt;/);
});

test("a shop without an address or phone leaves those lines out", () => {
  const mail = confirmationMail({ ...details, shopAddress: "", shopPhone: "", mapsUrl: "" });
  assert.ok(!mail.text.includes("Where:"));
  assert.ok(!mail.text.includes("Phone:"));
  assert.ok(!mail.html.includes("Directions:"));
});
