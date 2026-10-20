import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Work factor for scrypt: about 16 MB of memory and a noticeable delay per guess. */
const SCRYPT_OPTIONS: ScryptOptions = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/** Format: scrypt$N$r$p$salt$hash, with base64 for the salt and hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return ["scrypt", SCRYPT_OPTIONS.N, SCRYPT_OPTIONS.r, SCRYPT_OPTIONS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltText, keyText] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltText || !keyText) return false;

  const expected = Buffer.from(keyText, "base64");
  const actual = await derive(password, Buffer.from(saltText, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(expected, actual);
}

/**
 * A real hash of a random value. Checking a password against it when the email is
 * unknown takes as long as a real check, so timing does not reveal which emails exist.
 */
export const decoyPasswordHash: Promise<string> = hashPassword(randomBytes(24).toString("hex"));
