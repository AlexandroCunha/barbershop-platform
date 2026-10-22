import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The link a customer uses to see, cancel or move their own booking. It is signed with the
 * session secret, so it cannot be forged, and it names one booking in one shop. It needs no account.
 */
export interface ManageClaims {
  tenantId: number;
  bookingId: string;
}

interface Payload extends ManageClaims {
  /** Milliseconds since the epoch after which the link stops working. */
  expiresAt: number;
}

const SIGNATURE_CONTEXT = "booking-manage:";
const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function issueManageToken(secret: string, claims: ManageClaims, expiresAt: Date): string {
  const payload: Payload = { ...claims, expiresAt: expiresAt.getTime() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

/** The claims a token carries, or null when it is forged, malformed or expired. */
export function readManageToken(secret: string, token: string | undefined, now: Date): ManageClaims | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];
  if (!safeEqual(signature, sign(secret, body))) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isPayload(payload) || payload.expiresAt <= now.getTime()) return null;

  return { tenantId: payload.tenantId, bookingId: payload.bookingId };
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(SIGNATURE_CONTEXT + body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isPayload(value: unknown): value is Payload {
  if (typeof value !== "object" || value === null) return false;
  const { tenantId, bookingId, expiresAt } = value as Record<string, unknown>;
  return (
    typeof tenantId === "number" &&
    Number.isInteger(tenantId) &&
    typeof bookingId === "string" &&
    BOOKING_ID.test(bookingId) &&
    typeof expiresAt === "number" &&
    Number.isFinite(expiresAt)
  );
}
