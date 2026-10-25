import { AppError } from "../utils/app-error.js";
import { parseNewPassword } from "./accounts.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new AppError(400, "Request body must be a JSON object");
  }
  return body;
}

function parseBarberEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new AppError(400, "Enter a valid email address");
  }
  return email;
}

/** The address where a barber hears about new bookings. An empty value removes it. */
export function parseContactEmail(body: unknown): string {
  const input = requireObject(body);
  if (input.email === "" || input.email === null) {
    return "";
  }
  return parseBarberEmail(input.email);
}

/** A barber's sign-in: an email and a password, with the password's presence checked here. */
export function parseBarberLogin(body: unknown): { email: string; password: string } {
  const input = requireObject(body);
  const password = typeof input.password === "string" ? input.password : "";
  if (password.length === 0 || password.length > 200) {
    throw new AppError(400, "Enter your password");
  }
  return { email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "", password };
}

/** The owner sets a barber's login: a valid email and a new password of the usual length. */
export function parseBarberCredentials(body: unknown): { email: string; password: string } {
  const input = requireObject(body);
  return {
    email: parseBarberEmail(input.email),
    password: parseNewPassword(input.password, "password"),
  };
}
