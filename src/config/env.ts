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
  /** Trust X-Forwarded-For from a reverse proxy. */
  trustProxy: boolean;
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
    trustProxy: isTrue(env.TRUST_PROXY),
  };
}
