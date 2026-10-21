/** Shortest accepted values, so the secrets cannot be guessed easily. */
const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_PLATFORM_TOKEN_LENGTH = 24;

export interface Config {
  port: number;
  databaseUrl: string;
  /** Signs owner and platform sessions. Changing it signs everyone out. */
  sessionSecret: string;
  /** Platform owner's token for /platform. Undefined keeps the platform area closed. */
  platformToken: string | undefined;
  /** Send session cookies only over HTTPS. On by default in production. */
  secureCookies: boolean;
  /**
   * Number of reverse proxies in front of the app, each of which appends to X-Forwarded-For.
   * 0 means the app is reached directly, and client addresses come from the socket alone.
   */
  trustProxyHops: number;
  /** Booking requests allowed per address in 10 minutes. Raise it for load tests only. */
  bookingRateLimit: number;
}

function parseRateLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("BOOKING_RATE_LIMIT must be a positive whole number");
  }
  return parsed;
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

  const platformToken = env.PLATFORM_ADMIN_TOKEN?.trim() || undefined;
  if (platformToken !== undefined && platformToken.length < MIN_PLATFORM_TOKEN_LENGTH) {
    throw new Error(`PLATFORM_ADMIN_TOKEN must be at least ${MIN_PLATFORM_TOKEN_LENGTH} characters long`);
  }

  const production = env.NODE_ENV === "production";

  return {
    port,
    databaseUrl,
    sessionSecret,
    platformToken,
    secureCookies: env.COOKIE_SECURE === undefined ? production : isTrue(env.COOKIE_SECURE),
    trustProxyHops: parseTrustProxyHops(env.TRUST_PROXY),
    bookingRateLimit: parseRateLimit(env.BOOKING_RATE_LIMIT, 30),
  };
}
