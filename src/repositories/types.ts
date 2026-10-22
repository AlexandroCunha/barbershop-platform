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
}

/** The working hours each barber has set for themselves. */
export interface BarberHoursRepository {
  /** The barber's own hours, or null when they follow the shop's hours. */
  findByProfessional(tenantId: number, professionalId: number): Promise<BarberWeek | null>;
  /** Replaces the barber's hours for every day of the week. */
  replace(tenantId: number, professionalId: number, week: BarberWeek): Promise<void>;
}

export interface BookingRepository {
  /** Every booking on one date, across all barbers of the shop. */
  findByDate(tenantId: number, isoDate: string): Promise<Booking[]>;
  /** One barber's bookings on or after a date, in order. */
  findFromDate(tenantId: number, professionalId: number, fromIsoDate: string): Promise<Booking[]>;
  create(tenantId: number, booking: NewBooking): Promise<Booking>;
}
