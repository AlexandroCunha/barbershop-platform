import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "owner_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Compares two secrets in constant time. Hashing first hides their lengths too. */
export function secretsMatch(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Checks the owner's access token and issues signed, time-limited sessions.
 *
 * A session is `expiresAt.signature`. The signature is an HMAC keyed by the
 * admin token, so changing ADMIN_TOKEN signs every owner out at once. The
 * token itself is never stored in the browser.
 */
export class OwnerAuth {
  private readonly signingKey: string | undefined;

  constructor(
    private readonly adminToken: string | undefined,
    private readonly now: () => number = Date.now,
  ) {
    this.signingKey = adminToken
      ? createHmac("sha256", adminToken).update("owner-session-key").digest("hex")
      : undefined;
  }

  get isConfigured(): boolean {
    return this.adminToken !== undefined;
  }

  checkToken(token: string): boolean {
    return this.adminToken !== undefined && secretsMatch(token, this.adminToken);
  }

  issueSession(): string {
    const expiresAt = Math.floor(this.now() / 1000) + SESSION_TTL_SECONDS;
    return `${expiresAt}.${this.sign(String(expiresAt))}`;
  }

  verifySession(value: string | undefined): boolean {
    if (!value || this.signingKey === undefined) return false;

    const parts = value.split(".");
    if (parts.length !== 2) return false;
    const [expiresText, signature] = parts as [string, string];

    if (!secretsMatch(signature, this.sign(expiresText))) return false;
    return Number(expiresText) > Math.floor(this.now() / 1000);
  }

  private sign(payload: string): string {
    if (this.signingKey === undefined) {
      throw new Error("Owner sessions need ADMIN_TOKEN to be configured");
    }
    return createHmac("sha256", this.signingKey).update(payload).digest("hex");
  }
}
