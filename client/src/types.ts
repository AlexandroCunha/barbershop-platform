export const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Day = (typeof DAYS)[number];

export interface DayHours {
  open: string;
  close: string;
}

/** One upcoming booking as the owner sees it, with the customer's contact details. */
export interface OwnerBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  professionalId: number;
  professionalName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/** A barber's hours. custom is false while they follow the shop's opening hours. */
export interface BarberHours {
  custom: boolean;
  days: Record<Day, DayHours | null>;
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

/** One of a barber's own upcoming bookings. Contact details are not included. */
export interface BarberBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  durationMinutes: number;
  customerName: string;
}

export interface BarberProfile {
  id: number;
  name: string;
}

export interface Availability {
  date: string;
  /** Every time offered on the date, across the barbers. */
  times: string[];
  /** Each barber's own free times, so the customer can choose a barber for a time. */
  barbers: { professionalId: number; times: string[] }[];
}

export interface BookingInput {
  serviceId: number;
  professionalId: number;
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
