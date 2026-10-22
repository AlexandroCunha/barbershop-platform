import { useEffect, useMemo } from "react";
import { tenantApi } from "../api";
import { AdminPage } from "../admin/AdminPage";
import { AccessPage } from "./AccessPage";
import { BarberPage } from "./BarberPage";
import { ManagePage } from "./ManagePage";
import { ResetPage } from "./ResetPage";
import { useAsync } from "../hooks";
import { TenantContext } from "../tenant-context";
import { NotFound } from "./Static";
import { SitePage } from "./SitePage";

export type ShopView = "site" | "admin" | "barber" | "access" | "manage" | "reset";

/** Loads one barbershop, then shows its public site or its owner area. */
export function TenantPage({ slug, view }: { slug: string; view: ShopView }) {
  const api = useMemo(() => tenantApi(slug), [slug]);
  const business = useAsync(() => api.business(), [api]);
  const profile = business.data;

  useEffect(() => {
    if (profile) {
      document.title = profile.tagline ? `${profile.name} — ${profile.tagline}` : profile.name;
    }
  }, [profile]);

  if (business.loading) {
    return <p className="status page-status">Loading…</p>;
  }
  if (!profile) {
    return <NotFound message={business.error ?? "Barbershop not found"} />;
  }

  return (
    <TenantContext.Provider value={{ slug, api, business: profile }}>
      {view === "site" ? (
        <SitePage />
      ) : view === "admin" ? (
        <AdminPage />
      ) : view === "barber" ? (
        <BarberPage />
      ) : view === "manage" ? (
        <ManagePage />
      ) : view === "reset" ? (
        <ResetPage />
      ) : (
        <AccessPage />
      )}
    </TenantContext.Provider>
  );
}
