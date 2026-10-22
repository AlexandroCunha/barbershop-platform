import type { Business } from "./types";

/** Keeps only the digits of a phone number, for wa.me links. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** The WhatsApp chat for the shop. Falls back to the phone number when no WhatsApp number is set. */
export function whatsappNumber(business: Business): string | null {
  const number = business.whatsapp || business.phone;
  return number ? digitsOnly(number) || null : null;
}

/** Where "Find us" leads: the shop's own map link, or a map search for its address. */
export function mapsHref(business: Business): string | null {
  if (business.mapsUrl) return business.mapsUrl;
  const { street, postcode, city, country } = business.address;
  const query = [street, postcode, city, country].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}
