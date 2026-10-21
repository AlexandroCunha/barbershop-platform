import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Work factor for scrypt, the OWASP minimum: N = 2^17, r = 8, p = 1. Each hash needs about
 * 128 MB, so the memory limit is set explicitly above Node's 32 MB default.
 */
const SCRYPT_OPTIONS = { N: 2 ** 17, r: 8, p: 1 } as const;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { ...options, maxmem: SCRYPT_MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Format: scrypt$N$r$p$salt$hash, with base64 for the salt and hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  const { N, r, p } = SCRYPT_OPTIONS;
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Parses a stored hash into its scrypt settings and bytes, or null when it is not in our format. */
function parseStored(stored: string): { options: ScryptOptions; salt: Buffer; key: Buffer } | null {
  const [scheme, n, r, p, saltText, keyText] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltText || !keyText) return null;
  return {
    options: { N: Number(n), r: Number(r), p: Number(p) },
    salt: Buffer.from(saltText, "base64"),
    key: Buffer.from(keyText, "base64"),
  };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;

  // The hash carries its own settings, so hashes made with older settings still verify.
  const actual = await derive(password, parsed.salt, parsed.key.length, parsed.options);
  return timingSafeEqual(parsed.key, actual);
}

/** True when a stored hash was made with settings weaker than the current ones. */
export function needsRehash(stored: string): boolean {
  const parsed = parseStored(stored);
  if (!parsed) return false;
  const { options } = parsed;
  return options.N !== SCRYPT_OPTIONS.N || options.r !== SCRYPT_OPTIONS.r || options.p !== SCRYPT_OPTIONS.p;
}

/**
 * A real hash of a random value. Checking a password against it when the email is
 * unknown takes as long as a real check, so timing does not reveal which emails exist.
 */
export const decoyPasswordHash: Promise<string> = hashPassword(randomBytes(24).toString("hex"));
