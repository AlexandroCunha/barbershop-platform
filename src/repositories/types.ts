import type { Business } from "../domain/business.js";
import type { Booking, NewBooking, Professional, ProfessionalPatch, Service, ServicePatch } from "../domain/types.js";
import type { LicenseStatus, Tenant } from "../domain/tenant.js";
import type { BarberWeek } from "../domain/barber-hours.js";

/** A shop owner's login. The password is stored as a hash only. */
export interface OwnerAccount {
  id: number;
  tenantId: number;
  email: string;
  passwordHash: string;
  sessionVersion: number;
}

export interface NewTenant {
  slug: string;
  name: string;
  business: Business;
  licenseStatus: LicenseStatus;
  trialEndsAt: Date | null;
  ownerEmail: string;
  ownerPasswordHash: string;
  services: { name: string; description: string; priceCents: number; durationMinutes: number }[];
  professionals: { name: string; specialties: string[]; bio: string }[];
}

export interface LicenseUpdate {
  licenseStatus: LicenseStatus;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

export interface TenantRepository {
  findBySlug(slug: string): Promise<Tenant | null>;
  findById(id: number): Promise<Tenant | null>;
  listAll(): Promise<Tenant[]>;
  /** The address of the barbershop created first, or null when there is none yet. */
  findFirstSlug(): Promise<string | null>;
  /** Creates the shop, its owner and its starting services and barbers in one transaction. */
  create(input: NewTenant): Promise<Tenant>;
  updateBusiness(id: number, business: Business): Promise<void>;
  /** When the shop's address last changed, or null if it never has. */
  lastAddressChange(id: number): Promise<Date | null>;
  /** True when the address is a shop's current address, or one a shop used before. */
  addressInUse(slug: string): Promise<boolean>;
  /** The current address of the shop that used this address before, or null. */
  findRedirect(oldSlug: string): Promise<string | null>;
  /**
   * Moves the shop to a new address, keeping the old one as a redirect. Fails with 409 when the new
   * address is taken in the meantime.
   */
  changeSlug(id: number, oldSlug: string, newSlug: string, now: Date): Promise<Tenant>;
  updateLicense(id: number, update: LicenseUpdate): Promise<Tenant | null>;
}

export interface OwnerRepository {
  findByEmail(tenantId: number, email: string): Promise<OwnerAccount | null>;
  findById(id: number): Promise<OwnerAccount | null>;
  /** Stores a new hash and bumps the session version, which signs out other sessions. Returns the new version. */
  updatePassword(id: number, passwordHash: string): Promise<number>;
  /** Stores a new hash of the same password under stronger settings. Signs nobody out. */
  replacePasswordHash(id: number, passwordHash: string): Promise<void>;
}

export type SessionKind = "owner" | "barber";

export interface SessionRecord {
  id: string;
  kind: SessionKind;
  /** Set for owner sessions only. */
  tenantId: number | null;
  /** Set for owner sessions only. */
  ownerId: number | null;
  /** Set for barber sessions only. */
  barberAccountId: number | null;
  expiresAt: Date;
}

/** A barber's own login for one shop. The password is stored as a hash only. */
export interface BarberAccount {
  id: number;
  tenantId: number;
  professionalId: number;
  email: string;
  passwordHash: string;
}

export interface BarberAccountRepository {
  findByEmail(tenantId: number, email: string): Promise<BarberAccount | null>;
  findById(id: number): Promise<BarberAccount | null>;
  findByProfessional(tenantId: number, professionalId: number): Promise<BarberAccount | null>;
  /**
   * Creates the barber's login, or replaces its email and password. Fails with 409 when the email
   * already belongs to another barber of the same shop.
   */
  upsert(tenantId: number, professionalId: number, email: string, passwordHash: string): Promise<BarberAccount>;
  /** Removes the barber's login. Returns false when there was none. */
  remove(tenantId: number, professionalId: number): Promise<boolean>;
  /** Stores a new password hash for an existing login. The caller ends the login's sessions. */
  updatePasswordHash(id: number, passwordHash: string): Promise<void>;
}

export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  /** The session when it exists, is not revoked and has not expired at `now`; otherwise null. */
  findActive(id: string, now: Date): Promise<SessionRecord | null>;
  revoke(id: string): Promise<void>;
  /** Ends every session of one owner, for example after a password change. */
  revokeAllForOwner(ownerId: number): Promise<void>;
  /** Ends every session of one barber login, for example when the login is replaced or removed. */
  revokeAllForBarberAccount(barberAccountId: number): Promise<void>;
}

export interface NewService {
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
}

export interface NewProfessional {
  name: string;
  specialties: string[];
  bio: string;
}

export interface ServiceRepository {
  findAll(tenantId: number): Promise<Service[]>;
  findById(tenantId: number, id: number): Promise<Service | null>;
  /** Hides the service from customers and the owner. Existing bookings keep it. */
  archive(tenantId: number, id: number): Promise<boolean>;
  create(tenantId: number, input: NewService): Promise<Service>;
  update(tenantId: number, id: number, patch: ServicePatch): Promise<Service | null>;
}

export interface ProfessionalRepository {
  findAll(tenantId: number): Promise<Professional[]>;
  findById(tenantId: number, id: number): Promise<Professional | null>;
  /** Stops the barber taking new bookings. Existing bookings keep them. */
  archive(tenantId: number, id: number): Promise<boolean>;
  create(tenantId: number, input: NewProfessional): Promise<Professional>;
  update(tenantId: number, id: number, patch: ProfessionalPatch): Promise<Professional | null>;
  /** Where the barber hears about new bookings. Empty when none is set. Never shown to customers. */
  findContactEmail(tenantId: number, id: number): Promise<string>;
  /** Sets or clears (empty) the barber's booking e-mail. Returns false when the barber does not exist. */
  setContactEmail(tenantId: number, id: number, email: string): Promise<boolean>;
}

/** The working hours each barber has set for themselves. */
export interface BarberHoursRepository {
  /** The barber's own hours, or null when they follow the shop's hours. */
  findByProfessional(tenantId: number, professionalId: number): Promise<BarberWeek | null>;
  /** Replaces the barber's hours for every day of the week. */
  replace(tenantId: number, professionalId: number, week: BarberWeek): Promise<void>;
}

/** A booking as stored, including whether it has been cancelled. */
export interface BookingRecord extends Booking {
  cancelledAt: Date | null;
}

export type NotificationKind =
  | "confirmation"
  | "reminder"
  | "cancellation"
  | "moved"
  | "barber-booking"
  | "barber-cancellation"
  | "barber-moved";

/** An e-mail about a booking. It is written to the outbox in the same transaction as the change it reports. */
export interface NotificationDraft {
  kind: NotificationKind;
  toAddress: string;
  subject: string;
  /** Plain-text version, always sent. */
  body: string;
  /** HTML version, sent with the plain text so every mail client can show one of them. */
  html: string;
  sendAt: Date;
}

/** Where a booking moves to. The end is derived from the service's length by the caller. */
export interface BookingSlot {
  date: string;
  startMinute: number;
  endMinute: number;
}

/**
 * Active bookings are the ones that have not been cancelled. Only active bookings hold a time, show in
 * the lists and count for availability.
 */
export interface BookingRepository {
  /** Every active booking on one date, across all barbers of the shop. */
  findByDate(tenantId: number, isoDate: string): Promise<Booking[]>;
  /** One barber's active bookings on or after a date, in order. */
  findFromDate(tenantId: number, professionalId: number, fromIsoDate: string): Promise<Booking[]>;
  /** The shop's active bookings on or after a date, across all barbers, earliest first, at most limit. */
  findUpcoming(tenantId: number, fromIsoDate: string, limit: number): Promise<Booking[]>;
  /** One booking, cancelled or not. */
  findById(tenantId: number, id: string): Promise<BookingRecord | null>;
  /**
   * Stores the booking and the messages `messagesFor` writes about it, in one transaction. Fails with 409
   * when the time is taken.
   */
  create(tenantId: number, booking: NewBooking, messagesFor: (id: string) => NotificationDraft[]): Promise<Booking>;
  /** Frees the booking's time and queues its messages. Returns false when it was already cancelled or is missing. */
  cancel(tenantId: number, id: string, at: Date, messages: NotificationDraft[]): Promise<boolean>;
  /** Moves an active booking to another time. Fails with 409 when that time is taken. Returns false when missing. */
  move(tenantId: number, id: string, slot: BookingSlot, messages: NotificationDraft[]): Promise<boolean>;
}

export interface ClaimedNotification {
  id: number;
  toAddress: string;
  subject: string;
  body: string;
  html: string;
  attempts: number;
}

/** The outbox of e-mails. A worker claims due messages, sends them and records the outcome. */
export interface NotificationRepository {
  /** Claims up to `limit` messages that are due. Each one is held until `leaseUntil`, so no other worker takes it. */
  claimDue(now: Date, leaseUntil: Date, limit: number): Promise<ClaimedNotification[]>;
  /** Marks the message sent and clears its address and text, which are no longer needed. */
  markSent(id: number): Promise<void>;
  markRetry(id: number, retryAt: Date): Promise<void>;
  /** Gives up on the message and clears its address and text. */
  markFailed(id: number): Promise<void>;
}

export interface PasswordResetTarget {
  tenantId: number;
  ownerId: number | null;
  barberAccountId: number | null;
}

/** Password reset links. Only the hash of each token is stored. */
export interface PasswordResetRepository {
  create(reset: PasswordResetTarget & { tokenHash: string; expiresAt: Date }): Promise<void>;
  /**
   * Marks the link used and returns whom it was for, if it is still valid. The update is one statement,
   * so when two requests use the same link only one of them gets the target.
   */
  consume(tokenHash: string, tenantId: number, now: Date): Promise<PasswordResetTarget | null>;
}

/** Removes personal data that is no longer needed (GDPR storage limitation). */
export interface RetentionRepository {
  /** Blanks the customer details of bookings dated before `cutoff` (YYYY-MM-DD). Returns how many bookings changed. */
  anonymiseBookingsBefore(cutoff: string): Promise<number>;
}
