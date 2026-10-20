import { licenseInfo, type Tenant } from "../domain/tenant.js";

/** What the owner sees about their own license. */
export function licenseSummary(tenant: Tenant, now: Date) {
  const info = licenseInfo(tenant, now);
  return { state: info.state, endsAt: info.endsAt?.toISOString() ?? null };
}

/** What the platform owner sees for each shop. */
export function tenantSummary(tenant: Tenant, now: Date) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.licenseStatus,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    paidUntil: tenant.paidUntil?.toISOString() ?? null,
    ...licenseSummary(tenant, now),
  };
}
