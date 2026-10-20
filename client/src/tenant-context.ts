import { createContext, useContext } from "react";
import type { TenantApi } from "./api";
import type { Business } from "./types";

export interface TenantContextValue {
  slug: string;
  api: TenantApi;
  business: Business;
}

export const TenantContext = createContext<TenantContextValue | null>(null);

/** The barbershop the current page belongs to. Only valid inside TenantPage. */
export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) {
    throw new Error("useTenant must be used inside TenantPage");
  }
  return value;
}

/** The shop's business profile, for components that only need the details. */
export function useBusiness(): Business {
  return useTenant().business;
}
