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
  findByProfessionalAndDate(tenantId: number, professionalId: number, isoDate: string): Promise<Booking[]>;
  create(tenantId: number, booking: NewBooking): Promise<Booking>;
}
