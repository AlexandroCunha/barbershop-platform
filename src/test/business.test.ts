import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBusiness } from "../domain/business.js";
import { parseProfessionalPatch, parseServicePatch } from "../validations/admin.js";

const validBusiness = {
  name: "Northgate",
  tagline: "More than a cut.",
  about: "",
  phone: "",
  whatsapp: "",
  email: "owner@example.com",
  address: { street: "1 Main Street", city: "Dublin", postcode: "D08", country: "Ireland" },
  mapsUrl: "https://maps.example.com/?q=northgate",
  instagram: "@northgate",
  hours: {
    sunday: null,
    monday: { open: "09:00", close: "19:00" },
    tuesday: { open: "09:00", close: "19:00" },
    wednesday: { open: "09:00", close: "19:00" },
    thursday: { open: "09:00", close: "19:00" },
    friday: { open: "09:00", close: "19:00" },
    saturday: { open: "09:00", close: "18:00" },
  },
  heroImage: "1700000000-hero.jpg",
  timeZone: "Europe/Dublin",
  currency: "eur",
};

test("accepts a complete business profile and normalises it", () => {
  const business = parseBusiness(validBusiness);
  assert.equal(business.currency, "EUR");
  assert.equal(business.instagram, "northgate");
});

test("requires a name and a valid time zone", () => {
  assert.throws(() => parseBusiness({ ...validBusiness, name: "" }));
  assert.throws(() => parseBusiness({ ...validBusiness, timeZone: "Mars/Olympus" }));
});

test("rejects hours that close before they open", () => {
  const hours = { ...validBusiness.hours, monday: { open: "19:00", close: "09:00" } };
  assert.throws(() => parseBusiness({ ...validBusiness, hours }));
});

test("rejects a hero image that is a path rather than a media file name", () => {
  assert.throws(() => parseBusiness({ ...validBusiness, heroImage: "../secrets.txt" }));
});

test("service patches validate only the fields they contain", () => {
  assert.deepEqual(parseServicePatch({ priceCents: 3000 }), { priceCents: 3000 });
  assert.throws(() => parseServicePatch({ durationMinutes: 2 }));
});

test("professional patches clear the photo with null and drop empty specialties", () => {
  assert.deepEqual(parseProfessionalPatch({ photo: null, specialties: ["Fades", "  "] }), {
    photo: null,
    specialties: ["Fades"],
  });
});
