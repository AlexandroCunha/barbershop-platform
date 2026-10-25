import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_BUSINESS } from "../domain/defaults.js";
import type { Booking, NewBooking, Professional, Service } from "../domain/types.js";
import type { Tenant } from "../domain/tenant.js";
import type {
  BookingRecord,
  BookingRepository,
  BookingSlot,
  NotificationDraft,
  ProfessionalRepository,
  ServiceRepository,
} from "../repositories/types.js";
import { BookingManagementService } from "../services/booking-management-service.js";
import { BookingMessages } from "../services/booking-messages.js";
import { BookingService } from "../services/booking-service.js";
import { AppError } from "../utils/app-error.js";
import type { Clock } from "../utils/clock.js";

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

  async archive(): Promise<boolean> {
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

  async archive(): Promise<boolean> {
    throw new Error("not used by these tests");
  }

  async update(): Promise<Professional | null> {
    throw new Error("not used by these tests");
  }

  private readonly contacts = new Map<string, string>();

  /** Test setup: the barber's booking e-mail, as the owner would set it. */
  setContact(tenantId: number, id: number, email: string): void {
    this.contacts.set(`${tenantId}:${id}`, email);
  }

  async findContactEmail(tenantId: number, id: number): Promise<string> {
    return this.contacts.get(`${tenantId}:${id}`) ?? "";
  }

  async setContactEmail(tenantId: number, id: number, email: string): Promise<boolean> {
    this.setContact(tenantId, id, email);
    return true;
  }
}

/** Records the messages each change asked to queue, so tests can check them. */
class InMemoryBookings implements BookingRepository {
  readonly items: (Booking & { tenantId: number; cancelledAt: Date | null })[] = [];
  readonly queued: NotificationDraft[] = [];

  private active(tenantId: number) {
    return this.items.filter((booking) => booking.tenantId === tenantId && booking.cancelledAt === null);
  }

  async findByDate(tenantId: number, isoDate: string): Promise<Booking[]> {
    return this.active(tenantId).filter((booking) => booking.date === isoDate);
  }

  async findFromDate(tenantId: number, professionalId: number, fromIsoDate: string): Promise<Booking[]> {
    return this.active(tenantId).filter((booking) => booking.professionalId === professionalId && booking.date >= fromIsoDate);
  }

  async findUpcoming(tenantId: number, fromIsoDate: string, limit: number): Promise<Booking[]> {
    return this.active(tenantId)
      .filter((item) => item.date >= fromIsoDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute)
      .slice(0, limit);
  }

  async findById(tenantId: number, id: string): Promise<BookingRecord | null> {
    return this.items.find((booking) => booking.tenantId === tenantId && booking.id === id) ?? null;
  }

  async create(tenantId: number, booking: NewBooking, messagesFor: (id: string) => NotificationDraft[]): Promise<Booking> {
    this.assertFree(tenantId, booking.professionalId, booking.date, booking.startMinute, booking.endMinute, undefined);
    const saved = { ...booking, id: `booking-${this.items.length + 1}`, createdAt: new Date(), tenantId, cancelledAt: null };
    this.items.push(saved);
    this.queued.push(...messagesFor(saved.id));
    return saved;
  }

  async cancel(tenantId: number, id: string, at: Date, messages: NotificationDraft[]): Promise<boolean> {
    const booking = this.active(tenantId).find((item) => item.id === id);
    if (!booking) return false;
    booking.cancelledAt = at;
    this.queued.push(...messages);
    return true;
  }

  async move(tenantId: number, id: string, slot: BookingSlot, messages: NotificationDraft[]): Promise<boolean> {
    const booking = this.active(tenantId).find((item) => item.id === id);
    if (!booking) return false;
    this.assertFree(tenantId, booking.professionalId, slot.date, slot.startMinute, slot.endMinute, id);
    Object.assign(booking, { date: slot.date, startMinute: slot.startMinute, endMinute: slot.endMinute });
    this.queued.push(...messages);
    return true;
  }

  /** The same rule as the database: two active bookings of one barber may not overlap. */
  private assertFree(tenantId: number, professionalId: number, date: string, start: number, end: number, exceptId?: string) {
    const clash = this.active(tenantId).some(
      (existing) =>
        existing.id !== exceptId &&
        existing.professionalId === professionalId &&
        existing.date === date &&
        existing.startMinute < end &&
        start < existing.endMinute,
    );
    if (clash) {
      throw new AppError(409, "That time is no longer available");
    }
  }
}

const clock: Clock = { now: () => NOW, today: () => TODAY };
const TEST_SECRET = "test-secret-test-secret-test-secret-32";

/** The start times offered on a date, across the barbers who can take the booking. */
async function offered(service: BookingService, date: string, professionalId?: number): Promise<string[]> {
  const barbers = await service.availability(shop, classicHaircut.id, date, professionalId);
  return barbers.flatMap((barber) => barber.times);
}

function setup(loginEmail: string | null = null) {
  const bookings = new InMemoryBookings();
  const messages = new BookingMessages({ secret: TEST_SECRET, publicUrl: "https://shop.test", enabled: true }, clock);
  const services = new InMemoryServices([
    { tenantId: shop.id, service: classicHaircut },
    { tenantId: otherShop.id, service: { ...classicHaircut, id: 1, name: "Other shop cut" } },
  ]);
  const professionals = new InMemoryProfessionals([
    { tenantId: shop.id, professional: daniel },
    { tenantId: shop.id, professional: luca },
    { tenantId: otherShop.id, professional: daniel },
  ]);
  const service = new BookingService(
    services,
    professionals,
    bookings,
    clock,
    { findByProfessional: async () => null, replace: async () => undefined },
    messages,
    { findByProfessional: async () => (loginEmail ? { email: loginEmail } : null) } as never,
  );
  const management = new BookingManagementService(bookings, services, professionals, service, messages, clock);
  return { service, bookings, messages, management, services, professionals };
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

  const times = await offered(service, MONDAY);

  assert.equal(times[0], "09:00");
  assert.equal(times.at(-1), "18:30"); // 18:30 + 30 min closes at 19:00
});

test("returns no times on a closed day", async () => {
  const { service } = setup();
  assert.deepEqual(await offered(service, SUNDAY), []);
});

test("books a free slot with the chosen barber and stores the end time", async () => {
  const { service, bookings } = setup();

  const booking = await service.book(shop, {
    serviceId: classicHaircut.id,
    professionalId: daniel.id,
    date: MONDAY,
    startMinute: 9 * 60,
    ...customer,
  });

  assert.equal(booking.professionalId, daniel.id);
  assert.equal(booking.endMinute, 9 * 60 + 30);
  assert.equal(bookings.items.length, 1);
});

test("the same time can be booked with each barber, but not twice with one", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  const first = await service.book(shop, { ...request, professionalId: daniel.id });
  const second = await service.book(shop, { ...request, professionalId: luca.id });

  assert.equal(first.professionalId, daniel.id);
  assert.equal(second.professionalId, luca.id);
  await assert.rejects(service.book(shop, { ...request, professionalId: daniel.id }), assertAppError(409));
});

test("availability lists each barber's own free times", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };
  await service.book(shop, { ...request, professionalId: daniel.id });

  const barbers = await service.availability(shop, classicHaircut.id, MONDAY);
  const freeAt = (professionalId: number) => barbers.find((barber) => barber.professionalId === professionalId)?.times ?? [];

  assert.equal(freeAt(daniel.id).includes("09:00"), false);
  assert.equal(freeAt(luca.id).includes("09:00"), true);
});

test("a time stays offered until every barber is busy at that time", async () => {
  const { service } = setup();
  const request = { serviceId: classicHaircut.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await service.book(shop, { ...request, professionalId: daniel.id });
  assert.ok((await offered(service, MONDAY)).includes("09:00"));

  await service.book(shop, { ...request, professionalId: luca.id });
  assert.equal((await offered(service, MONDAY)).includes("09:00"), false);
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
  await assert.rejects(offered(service, "2029-12-31"), assertAppError(400));
});

test("returns 404 for an unknown service or professional", async () => {
  const { service } = setup();
  await assert.rejects(service.availability(shop, 999, MONDAY), assertAppError(404));
  await assert.rejects(offered(service, MONDAY, 999), assertAppError(404));
});

test("a suspended barbershop cannot take bookings", async () => {
  const { service } = setup();
  const suspended: Tenant = { ...shop, licenseStatus: "suspended" };
  const request = { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer };

  await assert.rejects(service.availability(suspended, classicHaircut.id, MONDAY), assertAppError(403));
  await assert.rejects(service.book(suspended, request), assertAppError(403));
});

test("a shop whose trial has ended cannot take bookings", async () => {
  const { service } = setup();
  const expired: Tenant = { ...shop, licenseStatus: "trial", trialEndsAt: new Date("2029-12-01T00:00:00Z") };

  await assert.rejects(service.availability(expired, classicHaircut.id, MONDAY), assertAppError(403));
});

test("the owner's list shows this shop's upcoming bookings with the barber's name and contact details", async () => {
  const { service } = setup();
  await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 10 * 60, ...customer });
  await service.book(otherShop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 10 * 60, ...customer });

  const list = await service.upcomingForOwner(shop);

  assert.equal(list.length, 1, "the other shop's booking is not listed");
  const { id, ...row } = list[0]!;
  assert.ok(id, "the row carries the booking id");
  assert.deepEqual(row, {
    date: MONDAY,
    startTime: "10:00",
    endTime: "10:30",
    serviceId: classicHaircut.id,
    serviceName: "Classic haircut",
    professionalId: daniel.id,
    professionalName: "Daniel",
    customerName: customer.customerName,
    customerEmail: customer.customerEmail,
    customerPhone: customer.customerPhone,
  });
});

test("a booking queues its confirmation and reminder in the same step as the booking", async () => {
  const { service, bookings } = setup();
  await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  assert.deepEqual(bookings.queued.map((draft) => draft.kind), ["confirmation", "reminder"]);
});

test("the barber's booking e-mail goes to their contact address, with the customer's summary", async () => {
  const { service, bookings, professionals } = setup("login@shop.test");
  professionals.setContact(shop.id, daniel.id, "chair@shop.test");
  await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  const note = bookings.queued.find((draft) => draft.kind === "barber-booking");
  assert.equal(note?.toAddress, "chair@shop.test", "the contact address is used before the login's");
  assert.match(note?.body ?? "", /Duration: 30 min/);
  assert.match(note?.body ?? "", /Total: /);
  assert.match(note?.body ?? "", /Email: ada@example\.com/);
});

test("without a contact address, the barber's booking e-mail goes to their login", async () => {
  const { service, bookings } = setup("login@shop.test");
  await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  assert.equal(bookings.queued.find((draft) => draft.kind === "barber-booking")?.toAddress, "login@shop.test");
});

test("a barber with neither a contact address nor a login is not e-mailed about the booking", async () => {
  const { service, bookings } = setup();
  await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  assert.ok(!bookings.queued.some((draft) => draft.kind === "barber-booking"));
});

test("cancelling frees the time for the next customer and queues a cancellation", async () => {
  const { service, bookings, management } = setup();
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  await management.cancel(shop, booked.id, { kind: "customer" });

  assert.ok(bookings.queued.some((draft) => draft.kind === "cancellation"));
  const again = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });
  assert.equal(again.professionalId, daniel.id, "the same chair takes a new booking at the same time");
});

test("a cancelled booking cannot be cancelled or moved again", async () => {
  const { service, management } = setup();
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });
  await management.cancel(shop, booked.id, { kind: "owner" });

  await assert.rejects(management.cancel(shop, booked.id, { kind: "owner" }), assertAppError(409));
  await assert.rejects(management.move(shop, booked.id, { kind: "owner" }, { date: MONDAY, startMinute: 10 * 60 }), assertAppError(409));
});

test("a move frees the old time, takes the new one, and queues a move notice", async () => {
  const { service, bookings, management } = setup();
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  await management.move(shop, booked.id, { kind: "customer" }, { date: MONDAY, startMinute: 11 * 60 });

  assert.ok(bookings.queued.some((draft) => draft.kind === "moved"));
  assert.ok((await offered(service, MONDAY, daniel.id)).includes("09:00"), "the old time is free");
  assert.ok(!(await offered(service, MONDAY, daniel.id)).includes("11:00"), "the new time is taken");
});

test("a move is refused when the new time is taken by another booking", async () => {
  const { service, management } = setup();
  const mine = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });
  await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 11 * 60, ...customer });

  await assert.rejects(management.move(shop, mine.id, { kind: "customer" }, { date: MONDAY, startMinute: 11 * 60 }), assertAppError(409));
});

test("a barber can change only the bookings in their own chair", async () => {
  const { service, management } = setup();
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: luca.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  await assert.rejects(management.cancel(shop, booked.id, { kind: "barber", professionalId: daniel.id }), assertAppError(404));
  await management.cancel(shop, booked.id, { kind: "barber", professionalId: luca.id });
});

test("a booking that has started cannot be changed by the customer", async () => {
  const { service, bookings, services, professionals } = setup();
  const started = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  // Half an hour after the start: the same data, read by a management service whose clock is later.
  const halfHourAfter: Clock = { now: () => new Date("2030-01-07T09:30:00Z"), today: () => "2030-01-07" };
  const management = new BookingManagementService(
    bookings,
    services,
    professionals,
    service,
    new BookingMessages({ secret: TEST_SECRET, publicUrl: "https://shop.test", enabled: true }, halfHourAfter),
    halfHourAfter,
  );

  await assert.rejects(management.cancel(shop, started.id, { kind: "customer" }), assertAppError(409));
  assert.equal((await management.viewForCustomer(shop, started.id)).status, "started");
});

test("a customer's view says whether the booking is upcoming, cancelled or started", async () => {
  const { service, management } = setup();
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });
  assert.equal((await management.viewForCustomer(shop, booked.id)).status, "upcoming");
  await management.cancel(shop, booked.id, { kind: "customer" });
  assert.equal((await management.viewForCustomer(shop, booked.id)).status, "cancelled");
});

test("a booking in another shop is not found", async () => {
  const { service, management } = setup();
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });
  await assert.rejects(management.viewForCustomer(otherShop, booked.id), assertAppError(404));
});

test("a time that has already passed today cannot be booked", async () => {
  const { service } = setup();
  // The clock says 10:00 on TODAY, so a 09:00 start today is in the past.
  await assert.rejects(
    service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: TODAY, startMinute: 9 * 60, ...customer }),
    assertAppError(409),
  );
  assert.ok(!(await offered(service, TODAY)).includes("09:00"));
  assert.ok((await offered(service, TODAY)).includes("10:00"));
});

test("the barber is told when a booking in their chair is cancelled, and when it is moved", async () => {
  const { service, bookings, management } = setup("login@shop.test");
  const booked = await service.book(shop, { serviceId: classicHaircut.id, professionalId: daniel.id, date: MONDAY, startMinute: 9 * 60, ...customer });

  await management.move(shop, booked.id, { kind: "customer" }, { date: MONDAY, startMinute: 11 * 60 });
  assert.equal(bookings.queued.find((draft) => draft.kind === "barber-moved")?.toAddress, "login@shop.test");

  await management.cancel(shop, booked.id, { kind: "owner" });
  assert.equal(bookings.queued.find((draft) => draft.kind === "barber-cancellation")?.toAddress, "login@shop.test");
});
