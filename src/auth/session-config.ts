/** Cookie names and lifetimes for owner and platform sessions. */
export const OWNER_COOKIE = "owner_session";
export const PLATFORM_COOKIE = "platform_session";
export const BARBER_COOKIE = "barber_session";
export const SESSION_SECONDS = 8 * 60 * 60;

/** Owner cookies are sent only to that shop's API, not to other shops or to the platform. */
export const ownerCookiePath = (slug: string): string => `/api/t/${slug}`;
export const PLATFORM_COOKIE_PATH = "/api/platform";

/** Barber cookies are sent only to that shop's barber area. */
export const barberCookiePath = (slug: string): string => `/api/t/${slug}/barber`;
