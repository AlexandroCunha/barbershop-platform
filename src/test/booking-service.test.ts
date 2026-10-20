import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Booking, NewBooking, Professional, Service } from "../domain/types.js";
import type { Tenant } from "../domain/tenant.js";
import type { BookingRepository, ProfessionalRepository, ServiceRepository } from "../repositories/types.js";
import { BookingService, type Clock } from "../services/booking-service.js";
import { AppError } from "../utils/app-error.js";

const MONDAY = "2030-01-07"; // a Monday, open 09:00 to 19:00 in the default hours
const SUNDAY = "2030-01-06"; // closed
const TODAY = "2030-01-01";
const NOW = new Date("2030-01-01T10:00:00Z");

const shop: Tenant = {
  id: 1,
  slug: "northgate",
  name: "Northgate",
  business: DEFAULT_BUSINESS,
  licenseStatus: "active",
  trialEndsAt: null,
  paidUntil: null,
};

const otherShop: Tenant = { ...shop, id: 2, slug: "eastside" };

const classicHaircut: Service = {
  id: 1,
  name: "Classic haircut",
  description: "Scissor or clipper cut.",
  priceCents: 2800,
  durationMinutes: 30,
};

const daniel: Professional = { id: 1, name: "Daniel", specialties: [], bio: "", photo: null };
const luca: Professional = { id: 2, name: "Luca", specialties: [], bio: "", photo: null };

/** In-memory repositories that keep each shop's rows apart, like the real queries do. */
class InMemoryServices implements ServiceRepository {
  constructor(private readonly rows: { tenantId: number; service: Service }[]) {}

  async findAll(tenantId: number): Promise<Service[]> {
    return this.rows.filter((row) => row.tenantId === tenantId).map((row) => row.service);
  }

  async findById(tenantId: number, id: number): Promise<Service | null> {
    return this.rows.find((row) => row.tenantId === tenantId && row.service.id === id)?.service ?? null;
  }

  async create(): Promise<Service> {
    throw new Error("not used by these tests");
  }

  async update(): Promise<Service | null> {
    throw new Error("not used by these tests");
  }
}

class InMemoryProfessionals implements ProfessionalRepository {
  constructor(private readonly rows: { tenantId: number; professional: Professional }[]) {}

  async findAll(tenantId: number): Promise<Professional[]> {
    return this.rows.filter((row) => row.tenantId === tenantId).map((row) => row.professional);
  }

  async findById(tenantId: number, id: number): Promise<Professional | null> {
    return this.rows.find((row) => row.tenantId === tenantId && row.professional.id === id)?.professional ?? null;
  }

  async create(): Promise<Professional> {
    throw new Error("not used by these tests");
  }

  async update(): Promise<Professional | null> {
    throw new Error("not used by these tests");
  }
}

class InMemoryBookings implements BookingRepository {
  readonly items: (Booking & { tenantId: number })[] = [];

  async findByProfessionalAndDate(tenantId: number, professionalId: number, isoDate: string): Promise<Booking[]> {
    return this.items.filter(
      (booking) => booking.tenantId === tenantId && booking.professionalId === professionalId && booking.date === isoDate,
    );
  }

  async create(tenantId: number, booking: NewBooking): Promise<Booking> {
    const clash = this.items.some(
      (existing) =>
        existing.tenantId === tenantId &&
        existing.professionalId === booking.professionalId &&
        existing.date === booking.date &&
        existing.startMinute === booking.startMinute,
    );
    if (clash) {
      throw new AppError(409, "That time is no longer available");
    }
    const saved = { ...booking, id: `booking-${this.items.length + 1}`, createdAt: new Date(), tenantId };
    this.items.push(saved);
    return saved;
  }
}

const clock: Clock = { now: () => NOW, today: () => TODAY };

function setup() {
  const bookings = new InMemoryBookings();
  const service = new BookingService(
    new InMemoryServices([
      { tenantId: shop.id, service: classicHaircut },
      { tenantId: otherShop.id, service: { ...classicHaircut, id: 1, name: "Other shop cut" } },
    ]),
    new InMemoryProfessionals([
      { tenantId: shop.id, professional: daniel },
      { tenantId: shop.id, professional: luca },
      { tenantId: otherShop.id, professional: daniel },
    ]),
    bookings,
    clock,
  );
  return { service, bookings };
}

const customer = { customerName: "Ada", customerEmail: "ada@example.com", customerPhone: "+353 85 123 4567" };

function assertAppError(status: number) {
  return (error: unknown): true => {
    assert.ok(error instanceof AppError, "expected an AppError");
    assert.equal(error.status, status);
    return true;
  };
}

test("lists availability on an open day, within opening hours", async () => {
  const { service } = setup();

  const times = await service.availability(shop, classicHaircut.id, MONDAY);

  assert.equal(times[0], "09:00");
  assert.equal(times.at(-1), "18:30"); // 18:30 + 30 min closes at 19:00
});

test("returns no times on a closed day", async () => {
  const { service } = setup();
  assert.deepEqual(await service.availability(shop, classicHaircut.id, SUNDAY), []);
});

test("books a free slot, assigns a barber and stores the end time", async () => {
  const { service, bookings } = setup();

  const booking = await service.book(shop, {
    serviceId: classicHaircut.id,
    date: MONDAY,
    startMinute: 9 * 60,
    ...customer,
  });

  assert.equal(booking.professionalId, daniel.id);
  assert.equal(booking.endMinute, 9 * 60 + 30);
  assert.equal(bookings.items.length, 1);
});

test("a second customer at the same time is assigned to another barber", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  const first = await service.book(shop, request);
  const second = await service.book(shop, request);

  assert.equal(first.professionalId, daniel.id);
  assert.equal(second.professionalId, luca.id);
});

test("a time stays offered until every barber is busy at that time", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book(shop, request);
  assert.ok((await service.availability(shop, classicHaircut.id, MONDAY)).includes("09:00"));

  await service.book(shop, request);
  assert.equal((await service.availability(shop, classicHaircut.id, MONDAY)).includes("09:00"), false);
});

test("a chosen barber is booked even when another barber is free", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book(shop, { ...request, professionalId: luca.id });
  await assert.rejects(service.book(shop, { ...request, professionalId: luca.id }), assertAppError(409));

  const other = await service.book(shop, { ...request, professionalId: daniel.id });
  assert.equal(other.professionalId, daniel.id);
});

test("a barbershop's bookings do not block another barbershop", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book(shop, { ...request, professionalId: daniel.id });
  const elsewhere = await service.book(otherShop, { ...request, professionalId: daniel.id });

  assert.equal(elsewhere.professionalId, daniel.id);
});

test("rejects dates in the past", async () => {
  const { service } = setup();
  await assert.rejects(service.availability(shop, classicHaircut.id, "2029-12-31"), assertAppError(400));
});

test("returns 404 for an unknown service or professional", async () => {
  const { service } = setup();
  await assert.rejects(service.availability(shop, 999, MONDAY), assertAppError(404));
  await assert.rejects(service.availability(shop, classicHaircut.id, MONDAY, 999), assertAppError(404));
});

test("a suspended barbershop cannot take bookings", async () => {
  const { service } = setup();
  const suspended: Tenant = { ...shop, licenseStatus: "suspended" };
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await assert.rejects(service.availability(suspended, classicHaircut.id, MONDAY), assertAppError(403));
  await assert.rejects(service.book(suspended, request), assertAppError(403));
});

test("a shop whose trial has ended cannot take bookings", async () => {
  const { service } = setup();
  const expired: Tenant = { ...shop, licenseStatus: "trial", trialEndsAt: new Date("2029-12-01T00:00:00Z") };

  await assert.rejects(service.availability(expired, classicHaircut.id, MONDAY), assertAppError(403));
});
