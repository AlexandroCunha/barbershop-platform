export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Day = (typeof DAYS)[number];

export interface DayHours {
  open: string;
  close: string;
}

export interface Business {
  name: string;
  tagline: string;
  about: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: { street: string; city: string; postcode: string; country: string };
  mapsUrl: string;
  instagram: string;
  hours: Record<Day, DayHours | null>;
  heroImage: string;
  timeZone: string;
  currency: string;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
}

export interface Professional {
  id: number;
  name: string;
  specialties: string[];
  bio: string;
  photo: string | null;
}

export interface Availability {
  date: string;
  times: string[];
}

export interface BookingInput {
  serviceId: number;
  professionalId?: number;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

export interface Confirmation {
  id: string;
  serviceId: number;
  professionalId: number;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
}

export interface MediaItem {
  name: string;
  url: string;
}

/** What a barbershop may do right now. */
export type AccessState = "trial" | "active" | "expired" | "suspended";

export interface LicenseSummary {
  state: AccessState;
  endsAt: string | null;
}

export interface OwnerSession {
  ok: boolean;
  license: LicenseSummary;
}

/** One barbershop as the platform owner sees it. */
export interface TenantSummary extends LicenseSummary {
  id: number;
  slug: string;
  name: string;
  status: "trial" | "active" | "suspended";
  trialEndsAt: string | null;
  paidUntil: string | null;
}
