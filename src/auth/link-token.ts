import { createHash, randomBytes } from "node:crypto";

/**
 * A secret sent in a link, such as a password reset. The link carries the token; the database
 * keeps only its hash, so a leaked table cannot be used to sign in.
 */
export function createLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
