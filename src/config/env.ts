/** Owner tokens shorter than this are too easy to guess. */
const MIN_ADMIN_TOKEN_LENGTH = 24;

export interface Config {
  port: number;
  databaseUrl: string;
  /** Owner's access token. Undefined keeps the owner area closed. */
  adminToken: string | undefined;
  /** Send cookies only over HTTPS. On by default in production. */
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

  const adminToken = env.ADMIN_TOKEN?.trim() || undefined;
  if (adminToken !== undefined && adminToken.length < MIN_ADMIN_TOKEN_LENGTH) {
    throw new Error(`ADMIN_TOKEN must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters long`);
  }

  const production = env.NODE_ENV === "production";

  return {
    port,
    databaseUrl,
    adminToken,
    secureCookies: env.COOKIE_SECURE === undefined ? production : isTrue(env.COOKIE_SECURE),
    trustProxy: isTrue(env.TRUST_PROXY),
  };
}
