import { AppError } from "../utils/app-error.js";
import { timeToMinutes } from "../utils/time.js";
import { isMediaFileName } from "./media-name.js";

/** Index matches Date#getUTCDay(): 0 = Sunday. */
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
  address: {
    street: string;
    city: string;
    postcode: string;
    country: string;
  };
  mapsUrl: string;
  instagram: string;
  /** `null` means closed that day. */
  hours: Record<Day, DayHours | null>;
  /** File name inside media/, or an empty string for no image. */
  heroImage: string;
  timeZone: string;
  currency: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function fail(message: string): never {
  throw new AppError(400, message);
}

/** Optional text: may be empty, otherwise trimmed and capped. */
export function parseText(value: unknown, field: string, maxLength = 200): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") fail(`${field} must be text`);
  const text = value.trim();
  if (text.length > maxLength) fail(`${field} must be at most ${maxLength} characters`);
  return text;
}

export function parseEmailOrEmpty(value: unknown, field: string): string {
  const email = parseText(value, field, 100);
  if (email && !EMAIL_PATTERN.test(email)) fail(`${field} is not a valid email`);
  return email;
}

export function parseUrlOrEmpty(value: unknown, field: string): string {
  const url = parseText(value, field, 300);
  if (url && !/^https?:\/\//.test(url)) fail(`${field} must start with http:// or https://`);
  return url;
}

export function parseMediaNameOrEmpty(value: unknown, field: string): string {
  const name = parseText(value, field, 120);
  if (name && !isMediaFileName(name)) fail(`${field} must be a file name from the media folder`);
  return name;
}

function parseDayHours(value: unknown, day: Day): DayHours | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) fail(`hours.${day} must be an object or null`);

  const open = value.open;
  const close = value.close;
  if (typeof open !== "string" || !TIME_PATTERN.test(open)) fail(`hours.${day}.open must be HH:MM`);
  if (typeof close !== "string" || !TIME_PATTERN.test(close)) fail(`hours.${day}.close must be HH:MM`);
  if (timeToMinutes(open) >= timeToMinutes(close)) fail(`hours.${day} must close after it opens`);

  return { open, close };
}

function parseHours(value: unknown): Record<Day, DayHours | null> {
  if (!isRecord(value)) fail("hours must be an object");
  const hours = {} as Record<Day, DayHours | null>;
  for (const day of DAYS) {
    hours[day] = parseDayHours(value[day], day);
  }
  return hours;
}

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Validates an owner-supplied business profile and returns a clean copy. */
export function parseBusiness(input: unknown): Business {
  if (!isRecord(input)) fail("Business settings must be an object");

  const address = isRecord(input.address) ? input.address : {};
  const name = parseText(input.name, "name", 80);
  if (!name) fail("name is required");

  const timeZone = parseText(input.timeZone, "timeZone", 60);
  if (!timeZone || !isValidTimeZone(timeZone)) fail("timeZone must be a valid IANA zone, e.g. Europe/Dublin");

  const currency = parseText(input.currency, "currency", 3).toUpperCase();
  if (!CURRENCY_PATTERN.test(currency)) fail("currency must be a 3-letter code, e.g. EUR");

  return {
    name,
    tagline: parseText(input.tagline, "tagline", 120),
    about: parseText(input.about, "about", 1000),
    phone: parseText(input.phone, "phone", 40),
    whatsapp: parseText(input.whatsapp, "whatsapp", 40),
    email: parseEmailOrEmpty(input.email, "email"),
    address: {
      street: parseText(address.street, "address.street", 120),
      city: parseText(address.city, "address.city", 80),
      postcode: parseText(address.postcode, "address.postcode", 20),
      country: parseText(address.country, "address.country", 80),
    },
    mapsUrl: parseUrlOrEmpty(input.mapsUrl, "mapsUrl"),
    instagram: parseText(input.instagram, "instagram", 60).replace(/^@/, ""),
    hours: parseHours(input.hours),
    heroImage: parseMediaNameOrEmpty(input.heroImage, "heroImage"),
    timeZone,
    currency,
  };
}
