import assert from "node:assert/strict";
import { test } from "node:test";
import { barberWeekToApi, barberWindow, parseBarberWeek, type BarberWeek } from "../domain/barber-hours.js";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Tenant } from "../domain/tenant.js";
import type { BarberHoursRepository, BookingRepository, ProfessionalRepository, ServiceRepository } from "../repositories/types.js";
import { BookingService } from "../services/booking-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

const MONDAY = "2030-01-07"; // shop open 09:00 to 19:00
const SUNDAY = "2030-01-06"; // shop closed

const shop: Tenant = {
  id: 1,
  slug: "northgate",
  name: "Northgate",
  business: DEFAULT_BUSINESS,
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};

function validWeek(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sunday: null,
    monday: { open: "13:00", close: "15:00" },
    tuesday: { open: "09:00", close: "19:00" },
    wednesday: null,
    thursday: { open: "09:00", close: "19:00" },
    friday: { open: "09:00", close: "19:00" },
    saturday: { open: "09:00", close: "18:00" },
    ...overrides,
  };
}

function expectBadRequest(fn: () => unknown, message?: RegExp): void {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof AppError, "throws an AppError");
    assert.equal(error.status, 400);
    if (message) assert.match(error.message, message);
    return true;
  });
}

test("a barber without hours of their own follows the shop's opening hours", () => {
  const window = barberWindow(DEFAULT_BUSINESS.hours, null, MONDAY);
  assert.deepEqual(window, { openMinute: 9 * 60, closeMinute: 19 * 60 });
  assert.equal(barberWindow(DEFAULT_BUSINESS.hours, null, SUNDAY), null);
});

test("a barber's own hours replace the shop's hours on that weekday", () => {
  const week = parseBarberWeek(validWeek(), DEFAULT_BUSINESS.hours);
  assert.deepEqual(barberWindow(DEFAULT_BUSINESS.hours, week, MONDAY), { openMinute: 13 * 60, closeMinute: 15 * 60 });
  assert.equal(barberWindow(DEFAULT_BUSINESS.hours, week, "2030-01-09"), null, "a Wednesday day off");
});

test("a barber's hours are checked against the shop's opening hours", () => {
  expectBadRequest(() => parseBarberWeek(validWeek({ monday: { open: "08:00", close: "15:00" } }), DEFAULT_BUSINESS.hours), /opening hours/);
  expectBadRequest(() => parseBarberWeek(validWeek({ saturday: { open: "09:00", close: "18:30" } }), DEFAULT_BUSINESS.hours), /opening hours/);
});

test("a barber cannot work on a day the shop is closed", () => {
  expectBadRequest(() => parseBarberWeek(validWeek({ sunday: { open: "10:00", close: "12:00" } }), DEFAULT_BUSINESS.hours), /shop is closed on Sunday/);
});

test("hours start and end on the half hour, and the end comes after the start", () => {
  expectBadRequest(() => parseBarberWeek(validWeek({ monday: { open: "13:15", close: "15:00" } }), DEFAULT_BUSINESS.hours), /half hour/);
  expectBadRequest(() => parseBarberWeek(validWeek({ monday: { open: "15:00", close: "14:30" } }), DEFAULT_BUSINESS.hours), /after the start/);
  expectBadRequest(() => parseBarberWeek(validWeek({ monday: { open: "13:00", close: "13" } }), DEFAULT_BUSINESS.hours), /times like 09:00/);
});

test("the week must be an object with a value for each day", () => {
  expectBadRequest(() => parseBarberWeek([], DEFAULT_BUSINESS.hours));
  expectBadRequest(() => parseBarberWeek({ monday: null }, DEFAULT_BUSINESS.hours), /Send the hours for Sunday/);
});

test("the API shows the shop's hours for a barber who has none, and the barber's own otherwise", () => {
  const own = barberWeekToApi(parseBarberWeek(validWeek(), DEFAULT_BUSINESS.hours), DEFAULT_BUSINESS.hours);
  assert.deepEqual(own.monday, { open: "13:00", close: "15:00" });
  assert.equal(own.wednesday, null);

  const shopsHours = barberWeekToApi(null, DEFAULT_BUSINESS.hours);
  assert.deepEqual(shopsHours.saturday, { open: "09:00", close: "18:00" });
  assert.equal(shopsHours.sunday, null);
});

/** The start times offered on a date, across the barbers asked for. */
async function offeredTimes(service: BookingService, date: string, professionalId?: number): Promise<string[]> {
  return (await service.availability(shop, 1, date, professionalId)).flatMap((barber) => barber.times);
}

/** Only the repositories a booking availability check reads. */
function availabilityService(hours: BarberWeek | null) {
  const professional = { id: 1, name: "Daniel", specialties: [], bio: "", photo: null };
  const services = {
    findById: async () => ({ id: 1, name: "Classic haircut", description: "", priceCents: 2800, durationMinutes: 30 }),
  } as unknown as ServiceRepository;
  const professionals = {
    findAll: async () => [professional],
    findById: async (_tenantId: number, id: number) => (id === professional.id ? professional : null),
  } as unknown as ProfessionalRepository;
  const bookings = { findByDate: async () => [] } as unknown as BookingRepository;
  const barberHours: BarberHoursRepository = {
    findByProfessional: async () => hours,
    replace: async () => undefined,
  };
  const clock: Clock = { now: () => new Date("2030-01-01T10:00:00Z"), today: () => "2030-01-01" };
  return new BookingService(services, professionals, bookings, clock, barberHours);
}

test("availability follows the barber's own hours", async () => {
  const week = parseBarberWeek(validWeek(), DEFAULT_BUSINESS.hours);
  const starts = await offeredTimes(availabilityService(week), MONDAY, 1);
  assert.deepEqual(starts, ["13:00", "13:30", "14:00", "14:30"]);
});

test("availability is empty on a day the barber does not work", async () => {
  const week = parseBarberWeek(validWeek(), DEFAULT_BUSINESS.hours);
  const starts = await offeredTimes(availabilityService(week), "2030-01-09", 1);
  assert.deepEqual(starts, []);
});

test("a barber without hours of their own is offered the shop's opening hours", async () => {
  const starts = await offeredTimes(availabilityService(null), MONDAY, 1);
  assert.equal(starts[0], "09:00");
  assert.equal(starts.at(-1), "18:30");
});
