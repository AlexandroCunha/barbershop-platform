import type { Business } from "./business.js";

/** What the platform owner has set for a barbershop. */
export type LicenseStatus = "trial" | "active" | "suspended";

/** What the barbershop can do right now, worked out from its license. */
export type AccessState = "trial" | "active" | "expired" | "suspended";

/** One barbershop on the platform. Every shop's data is kept apart by its id. */
export interface Tenant {
  id: number;
  slug: string;
  name: string;
  business: Business;
  licenseStatus: LicenseStatus;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

export interface LicenseInfo {
  state: AccessState;
  /** When the current period ends, when it has an end date. */
  endsAt: Date | null;
}

/**
 * Works out what a barbershop may do at a given moment.
 *
 * - suspended: nothing. The platform owner switched it off.
 * - active: as long as paidUntil is empty (managed by hand) or in the future.
 * - trial: until trialEndsAt.
 * - anything else: expired. The owner area stays open so the shop can see the
 *   reason, but customers cannot book.
 */
export function licenseInfo(tenant: Tenant, now: Date): LicenseInfo {
  if (tenant.licenseStatus === "suspended") {
    return { state: "suspended", endsAt: null };
  }

  if (tenant.licenseStatus === "active") {
    if (tenant.paidUntil === null || tenant.paidUntil > now) {
      return { state: "active", endsAt: tenant.paidUntil };
    }
    return { state: "expired", endsAt: tenant.paidUntil };
  }

  if (tenant.trialEndsAt !== null && tenant.trialEndsAt > now) {
    return { state: "trial", endsAt: tenant.trialEndsAt };
  }
  return { state: "expired", endsAt: tenant.trialEndsAt };
}

export function allowsBookings(state: AccessState): boolean {
  return state === "trial" || state === "active";
}
