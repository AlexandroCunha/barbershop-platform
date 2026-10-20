import { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Business } from "./types";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Loads a value whenever `deps` change, ignoring responses that are no longer current. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));

    load(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof ApiError ? error.message : "We could not load this. Please try again.";
        setState({ data: null, error: message, loading: false });
      });

    return () => controller.abort();
  }, deps);

  return state;
}

export const useServices = () => useAsync(() => api.services(), []);

export const useProfessionals = () => useAsync(() => api.professionals(), []);

export const useBusinessProfile = () => useAsync(() => api.business(), []);

export function useAvailability(serviceId?: number, date?: string, professionalId?: number) {
  return useAsync(
    (signal) => {
      if (!serviceId || !date) {
        return Promise.resolve({ date: date ?? "", times: [] });
      }
      return api.availability(serviceId, date, professionalId, signal);
    },
    [serviceId, date, professionalId],
  );
}

/** The business profile, shared with every part of the public site. */
export const BusinessContext = createContext<Business | null>(null);

export function useBusiness(): Business {
  const business = useContext(BusinessContext);
  if (!business) {
    throw new Error("useBusiness must be used inside BusinessContext");
  }
  return business;
}
