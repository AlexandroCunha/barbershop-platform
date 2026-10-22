import type { Business } from "../domain/business.js";
import type { Booking, NewBooking, Professional, ProfessionalPatch, Service, ServicePatch } from "../domain/types.js";
import type { LicenseStatus, Tenant } from "../domain/tenant.js";

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

export type SessionKind = "owner" | "platform";

export interface SessionRecord {
  id: string;
  kind: SessionKind;
  /** Set for owner sessions only. */
  tenantId: number | null;
  /** Set for owner sessions only. */
  ownerId: number | null;
  /** Set for platform sessions only: the developer who signed in. */
  developerId: number | null;
  expiresAt: Date;
}

/** A developer account for the platform area. The password is stored as a hash only. */
export interface DeveloperAccount {
  id: number;
  email: string;
  passwordHash: string;
}

export interface DeveloperRepository {
  findByEmail(email: string): Promise<DeveloperAccount | null>;
  /** Creates a developer. Fails with 409 when the email is already registered. */
  create(email: string, passwordHash: string): Promise<DeveloperAccount>;
}

export interface SessionRepository {
  create(session: SessionRecord): Promise<void>;
  /** The session when it exists, is not revoked and has not expired at `now`; otherwise null. */
  findActive(id: string, now: Date): Promise<SessionRecord | null>;
  revoke(id: string): Promise<void>;
  /** Ends every session of one owner, for example after a password change. */
  revokeAllForOwner(ownerId: number): Promise<void>;
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

export interface BookingRepository {
  /** Every booking on one date, across all barbers of the shop. */
  findByDate(tenantId: number, isoDate: string): Promise<Booking[]>;
  create(tenantId: number, booking: NewBooking): Promise<Booking>;
}
