import { isValidSlug } from "../domain/slug.js";
import { AppError } from "../utils/app-error.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new AppError(400, "Request body must be a JSON object");
  }
  return body;
}

export function parseEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new AppError(400, "Enter a valid email address");
  }
  return email;
}

/** Passwords are long rather than complicated; length matters most against guessing. */
export function parseNewPassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, `${field} must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new AppError(400, `${field} must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
  return value;
}

/** Sign-in accepts whatever was typed; only presence and the length cap are checked there. */
export function parseLoginPassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_PASSWORD_LENGTH) {
    throw new AppError(400, `Enter your ${field === "password" ? "password" : "current password"}`);
  }
  return value;
}

export function parseLogin(body: unknown): { email: string; password: string } {
  const input = requireObject(body);
  return {
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    password: parseLoginPassword(input.password),
  };
}

export function parsePasswordChange(body: unknown): { current: string; next: string } {
  const input = requireObject(body);
  return {
    current: parseLoginPassword(input.currentPassword, "current password"),
    next: parseNewPassword(input.newPassword, "newPassword"),
  };
}

export interface NewTenantInput {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
}

export function parseNewTenant(body: unknown): NewTenantInput {
  const input = requireObject(body);

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) {
    throw new AppError(400, "Enter the barbershop name (up to 80 characters)");
  }

  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  if (!isValidSlug(slug)) {
    throw new AppError(400, "The address must be 2-40 letters, digits or dashes, and not a reserved word");
  }

  return {
    name,
    slug,
    ownerEmail: parseEmail(input.ownerEmail),
    ownerPassword: parseNewPassword(input.ownerPassword, "ownerPassword"),
  };
}

export type LicenseStatusInput = "trial" | "active" | "suspended";

export interface LicenseInput {
  status: LicenseStatusInput;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new AppError(400, `${field} must be a date`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `${field} must be a valid date`);
  }
  return date;
}

export function parseLicense(body: unknown): LicenseInput {
  const input = requireObject(body);
  const status = input.status;
  if (status !== "trial" && status !== "active" && status !== "suspended") {
    throw new AppError(400, "status must be trial, active or suspended");
  }
  return {
    status,
    trialEndsAt: parseOptionalDate(input.trialEndsAt, "trialEndsAt"),
    paidUntil: parseOptionalDate(input.paidUntil, "paidUntil"),
  };
}

/** A reset request names only the e-mail; the reply never says whether it has an account. */
export function parseResetRequest(body: unknown): string {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  return parseEmail(input.email);
}

const LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** A reset link's token and the new password. A malformed token is the same "no longer valid" as a used one. */
export function parseResetConfirm(body: unknown): { token: string; password: string } {
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const token = typeof input.token === "string" ? input.token : "";
  if (!LINK_TOKEN.test(token)) {
    throw new AppError(400, "This link is no longer valid. Ask for a new one.");
  }
  return { token, password: parseNewPassword(input.password) };
}
