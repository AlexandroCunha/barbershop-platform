import assert from "node:assert/strict";
import { test } from "node:test";
import type { Booking, NewBooking, Professional, Service } from "../domain/types.js";
import type {
  BookingRepository,
  ProfessionalRepository,
  ServiceRepository,
} from "../repositories/types.js";
import type { BusinessProvider } from "../content/business-store.js";
import type { Business } from "../domain/business.js";
import { BookingService } from "../services/booking-service.js";
import { AppError } from "../utils/app-error.js";

const MONDAY = "2030-01-07"; // 2030-01-07 is a Monday
const SUNDAY = "2030-01-06";
const TODAY = "2030-01-01";

const classicHaircut: Service = {
  id: 1,
  name: "Classic haircut",
  description: "Scissor or clipper cut.",
  priceCents: 2800,
  durationMinutes: 30,
};

const daniel: Professional = { id: 1, name: "Daniel", specialties: [], bio: "", photo: null };
const luca: Professional = { id: 2, name: "Luca", specialties: [], bio: "", photo: null };

class InMemoryServices implements ServiceRepository {
  constructor(private readonly items: Service[]) {}

  async findAll(): Promise<Service[]> {
    return this.items;
  }

  async findById(id: number): Promise<Service | null> {
    return this.items.find((service) => service.id === id) ?? null;
  }

  async update(): Promise<Service | null> {
    throw new Error("not used by these tests");
  }
}

class InMemoryProfessionals implements ProfessionalRepository {
  constructor(private readonly items: Professional[]) {}

  async findAll(): Promise<Professional[]> {
    return this.items;
  }

  async findById(id: number): Promise<Professional | null> {
    return this.items.find((professional) => professional.id === id) ?? null;
  }

  async update(): Promise<Professional | null> {
    throw new Error("not used by these tests");
  }
}

class InMemoryBookings implements BookingRepository {
  readonly items: Booking[] = [];

  async findByProfessionalAndDate(professionalId: number, isoDate: string): Promise<Booking[]> {
    return this.items.filter((booking) => booking.professionalId === professionalId && booking.date === isoDate);
  }

  async create(booking: NewBooking): Promise<Booking> {
    const clash = this.items.some(
      (existing) =>
        existing.professionalId === booking.professionalId &&
        existing.date === booking.date &&
        existing.startMinute === booking.startMinute,
    );
    if (clash) {
      throw new AppError(409, "That time is no longer available");
    }
    const saved: Booking = { ...booking, id: `booking-${this.items.length + 1}`, createdAt: new Date() };
    this.items.push(saved);
    return saved;
  }
}

const businessFixture: Business = {
  name: "Test Barbers",
  tagline: "",
  about: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: { street: "", city: "", postcode: "", country: "" },
  mapsUrl: "",
  instagram: "",
  hours: {
    sunday: null,
    monday: { open: "09:00", close: "19:00" },
    tuesday: { open: "09:00", close: "19:00" },
    wednesday: { open: "09:00", close: "19:00" },
    thursday: { open: "09:00", close: "19:00" },
    friday: { open: "09:00", close: "19:00" },
    saturday: { open: "09:00", close: "18:00" },
  },
  heroImage: "",
  timeZone: "Europe/Dublin",
  currency: "EUR",
};
const businessProvider: BusinessProvider = { read: async () => businessFixture };

function setup() {
  const bookings = new InMemoryBookings();
  const service = new BookingService(
    new InMemoryServices([classicHaircut]),
    new InMemoryProfessionals([daniel, luca]),
    bookings,
    businessProvider,
    { today: () => TODAY },
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

  const times = await service.availability(classicHaircut.id, MONDAY);

  assert.equal(times[0], "09:00");
  assert.equal(times.at(-1), "18:30"); // 18:30 + 30 min closes at 19:00
});

test("returns no times on a closed day", async () => {
  const { service } = setup();
  assert.deepEqual(await service.availability(classicHaircut.id, SUNDAY), []);
});

test("books a free slot, assigns a barber and stores the end time", async () => {
  const { service, bookings } = setup();

  const booking = await service.book({ serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  assert.equal(booking.professionalId, daniel.id);
  assert.equal(booking.endMinute, 9 * 60 + 30);
  assert.equal(bookings.items.length, 1);
});

test("a second customer at the same time is assigned to another barber", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  const first = await service.book(request);
  const second = await service.book(request);

  assert.equal(first.professionalId, daniel.id);
  assert.equal(second.professionalId, luca.id);
});

test("a time stays offered until every barber is busy at that time", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book(request);
  assert.ok((await service.availability(classicHaircut.id, MONDAY)).includes("09:00"));

  await service.book(request);
  assert.equal((await service.availability(classicHaircut.id, MONDAY)).includes("09:00"), false);
});

test("rejects a booking when no barber is free", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book(request);
  await service.book(request);

  await assert.rejects(service.book(request), assertAppError(409));
});

test("rejects dates in the past", async () => {
  const { service } = setup();

  await assert.rejects(service.availability(classicHaircut.id, "2029-12-31"), assertAppError(400));
});

test("returns 404 for an unknown service", async () => {
  const { service } = setup();

  await assert.rejects(service.availability(999, MONDAY), assertAppError(404));
});

test("a chosen barber is booked even when another barber is free", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book({ ...request, professionalId: luca.id });

  await assert.rejects(service.book({ ...request, professionalId: luca.id }), assertAppError(409));

  const other = await service.book({ ...request, professionalId: daniel.id });
  assert.equal(other.professionalId, daniel.id);
});

test("availability for one barber ignores the others' bookings", async () => {
  const { service } = setup();

  await service.book({
    serviceId: classicHaircut.id,
    date: MONDAY,
    startMinute: 9 * 60,
    professionalId: daniel.id,
    ...customer,
  });

  const danielTimes = await service.availability(classicHaircut.id, MONDAY, daniel.id);
  const lucaTimes = await service.availability(classicHaircut.id, MONDAY, luca.id);

  assert.equal(danielTimes.includes("09:00"), false);
  assert.equal(lucaTimes.includes("09:00"), true);
});

test("returns 404 for an unknown chosen barber", async () => {
  const { service } = setup();

  await assert.rejects(service.availability(classicHaircut.id, MONDAY, 999), assertAppError(404));
});
