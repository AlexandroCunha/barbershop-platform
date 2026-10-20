import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed, time-limited token: base64url(JSON payload) + "." + HMAC-SHA256.
 * Tokens are not encrypted, so the payload must hold nothing secret.
 */
export interface TokenPayload {
  kind: "owner" | "platform";
  /** Unix time in seconds after which the token is no longer valid. */
  exp: number;
  tenantId?: number;
  ownerId?: number;
  /** The owner's session version when the token was issued. Changing the password bumps it. */
  version?: number;
}

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Compares two strings in constant time. Hashing first hides their lengths too. */
export function stringsMatch(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function isPayload(value: unknown): value is TokenPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TokenPayload>;
  return (candidate.kind === "owner" || candidate.kind === "platform") && typeof candidate.exp === "number";
}

export function issueToken(secret: string, payload: TokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

/** Returns the payload when the signature is valid and the token has not expired; otherwise null. */
export function readToken(secret: string, value: string | undefined, nowMs: number): TokenPayload | null {
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];

  if (!stringsMatch(signature, sign(secret, body))) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isPayload(payload)) return null;
  if (payload.exp <= Math.floor(nowMs / 1000)) return null;

  return payload;
}
