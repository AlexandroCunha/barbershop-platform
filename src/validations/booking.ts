import type { BookingRequest } from "../services/booking-service.js";
import { AppError } from "../utils/app-error.js";
import { timeToMinutes } from "../utils/time.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LENGTH = 100;

export interface AvailabilityQuery {
  serviceId: number;
  professionalId?: number;
  date: string;
}

export function parseAvailabilityQuery(query: Record<string, unknown>): AvailabilityQuery {
  return {
    serviceId: parsePositiveInt(query.serviceId, "serviceId"),
    professionalId: parseOptionalPositiveInt(query.professionalId, "professionalId"),
    date: parseDate(query.date),
  };
}

export function parseBookingRequest(body: unknown): BookingRequest {
  if (typeof body !== "object" || body === null) {
    throw new AppError(400, "Request body must be a JSON object");
  }

  const input = body as Record<string, unknown>;

  return {
    serviceId: parsePositiveInt(input.serviceId, "serviceId"),
    professionalId: parseBarber(input.professionalId),
    date: parseDate(input.date),
    startMinute: timeToMinutes(parseTime(input.time)),
    customerName: parseText(input.customerName, "customerName"),
    customerEmail: parseEmail(input.customerEmail),
    customerPhone: parsePhone(input.customerPhone),
  };
}

function parsePositiveInt(value: unknown, field: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, `${field} must be a positive integer`);
  }
  return id;
}

/** A booking always names its barber. The customer chooses one before confirming. */
function parseBarber(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    throw new AppError(400, "Choose a barber for this booking");
  }
  return parsePositiveInt(value, "professionalId");
}

/** Absent or empty means "no preference"; anything else must be a valid id. */
function parseOptionalPositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parsePositiveInt(value, field);
}

function parseDate(value: unknown): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new AppError(400, "date must be in YYYY-MM-DD format");
  }
  return value;
}

function parseTime(value: unknown): string {
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw new AppError(400, "time must be in HH:MM format");
  }
  return value;
}

function parseText(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
    throw new AppError(400, `${field} must be 1-${MAX_TEXT_LENGTH} characters`);
  }
  return text;
}

const PHONE_PATTERN = /^\+?[0-9()\s-]+$/;

function parsePhone(value: unknown): string {
  const phone = typeof value === "string" ? value.trim() : "";
  if (!phone) {
    throw new AppError(400, "customerPhone is required");
  }
  const digits = phone.replace(/\D/g, "");
  if (!PHONE_PATTERN.test(phone) || digits.length < 7 || digits.length > 15) {
    throw new AppError(400, "customerPhone must be a valid mobile number, e.g. +353 85 123 4567");
  }
  return phone;
}

function parseEmail(value: unknown): string {
  const email = parseText(value, "customerEmail");
  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(400, "customerEmail is not a valid email");
  }
  return email;
}
