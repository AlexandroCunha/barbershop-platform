import { isValidSlug } from "../domain/slug.js";
import type { S3Settings } from "../media/s3-media-storage.js";
import { parseMail, type MailConfig } from "./mail-config.js";

/** Shortest accepted values, so the secrets cannot be guessed easily. */
const MIN_SESSION_SECRET_LENGTH = 32;

export interface Config {
  port: number;
  databaseUrl: string;
  /** Signs owner and platform sessions. Changing it signs everyone out. */
  sessionSecret: string;
  /** Send session cookies only over HTTPS. On by default in production. */
  secureCookies: boolean;
  /** NODE_ENV is production. Some warnings only matter on the live site. */
  production: boolean;
  /**
   * Number of reverse proxies in front of the app, each of which appends to X-Forwarded-For.
   * 0 means the app is reached directly, and client addresses come from the socket alone.
   */
  trustProxyHops: number;
  /** Booking requests allowed per address in 10 minutes. Raise it for load tests only. */
  bookingRateLimit: number;
  /**
   * Months to keep a customer's name, e-mail and phone after the appointment date. Older bookings are
   * anonymised (the booking itself stays for the shop's records). 0 keeps everything.
   */
  bookingRetentionMonths: number;
  /** Address of the barbershop the home page opens. Undefined means the first shop created. */
  homeShopSlug: string | undefined;
  media: MediaConfig;
  /** The address the site is reached at, without a trailing slash. Links in e-mails are built from it. */
  publicUrl: string;
  mail: MailConfig;
}

/** Local disk for a single server; S3-compatible storage when several servers share the photos. */
export type MediaConfig = { kind: "local" } | { kind: "s3"; settings: S3Settings };

function parseMedia(env: NodeJS.ProcessEnv): MediaConfig {
  const kind = env.MEDIA_STORAGE?.trim().toLowerCase() || "local";
  if (kind === "local") return { kind: "local" };
  if (kind !== "s3") {
    throw new Error(`MEDIA_STORAGE must be "local" or "s3", not "${kind}"`);
  }

  const bucket = env.S3_BUCKET?.trim();
  const endpoint = env.S3_ENDPOINT?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    const missing = [
      !bucket && "S3_BUCKET",
      !endpoint && "S3_ENDPOINT",
      !accessKeyId && "S3_ACCESS_KEY_ID",
      !secretAccessKey && "S3_SECRET_ACCESS_KEY",
    ].filter(Boolean);
    throw new Error(`MEDIA_STORAGE=s3 needs these variables: ${missing.join(", ")}`);
  }

  return {
    kind: "s3",
    settings: { bucket, endpoint, region: env.S3_REGION?.trim() || "auto", accessKeyId, secretAccessKey },
  };
}

function parseRateLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("BOOKING_RATE_LIMIT must be a positive whole number");
  }
  return parsed;
}

const DEFAULT_RETENTION_MONTHS = 24;
const MAX_RETENTION_MONTHS = 120;

function parseRetentionMonths(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return DEFAULT_RETENTION_MONTHS;
  const months = Number(value);
  if (!Number.isInteger(months) || months < 0 || months > MAX_RETENTION_MONTHS) {
    throw new Error(`BOOKING_RETENTION_MONTHS must be a whole number from 0 to ${MAX_RETENTION_MONTHS} (0 keeps everything)`);
  }
  return months;
}

const MAX_PROXY_HOPS = 5;

/**
 * Trusting X-Forwarded-For is only safe when a proxy sits in front of the app and appends to it.
 * Without one, any client can send that header with any address, and the per-address rate
 * limits stop protecting anything. So the value must be the proxy count, and unset means none.
 */
function parseTrustProxyHops(value: string | undefined): number {
  const text = value?.trim() ?? "";
  if (text === "" || text === "0") return 0;

  const hops = Number(text);
  if (!Number.isInteger(hops) || hops < 1 || hops > MAX_PROXY_HOPS) {
    throw new Error(
      `TRUST_PROXY must be the number of reverse proxies in front of the app (0 to ${MAX_PROXY_HOPS}), ` +
        `usually 1. Leave it unset when the app is reached directly. Got "${text}".`,
    );
  }
  return hops;
}

const isTrue = (value: string | undefined): boolean => value?.toLowerCase() === "true";

function parsePublicUrl(value: string | undefined, port: number, production: boolean): string {
  const text = value?.trim();
  if (!text) {
    if (production) {
      throw new Error("PUBLIC_URL is required on the live site, such as https://your-shop.example");
    }
    return `http://localhost:${port}`;
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("PUBLIC_URL must be a full address, such as https://your-shop.example");
  }
  if (production && url.protocol !== "https:") {
    throw new Error("PUBLIC_URL must use https on the live site");
  }
  return url.origin;
}

function parseHomeShop(value: string | undefined): string | undefined {
  const slug = value?.trim().toLowerCase();
  if (!slug) return undefined;
  if (!isValidSlug(slug)) {
    throw new Error("HOME_SHOP_SLUG must be a valid barbershop address, such as northgate");
  }
  return slug;
}


export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const port = Number(env.PORT ?? 3100);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535");
  }

  const sessionSecret = env.SESSION_SECRET?.trim() ?? "";
  if (sessionSecret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters long`);
  }

  const production = env.NODE_ENV === "production";

  return {
    port,
    databaseUrl,
    sessionSecret,
    secureCookies: env.COOKIE_SECURE === undefined ? production : isTrue(env.COOKIE_SECURE),
    production,
    trustProxyHops: parseTrustProxyHops(env.TRUST_PROXY),
    bookingRateLimit: parseRateLimit(env.BOOKING_RATE_LIMIT, 30),
    bookingRetentionMonths: parseRetentionMonths(env.BOOKING_RETENTION_MONTHS),
    homeShopSlug: parseHomeShop(env.HOME_SHOP_SLUG),
    media: parseMedia(env),
    publicUrl: parsePublicUrl(env.PUBLIC_URL, port, production),
    mail: parseMail(env, production),
  };
}
