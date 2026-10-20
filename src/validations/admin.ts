import type { ProfessionalPatch, ServicePatch } from "../domain/types.js";
import { parseMediaNameOrEmpty, parseText } from "../domain/business.js";
import { AppError } from "../utils/app-error.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    throw new AppError(400, "Request body must be a JSON object");
  }
  return body;
}

function parseInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AppError(400, `${field} must be a whole number between ${min} and ${max}`);
  }
  return value;
}

export function parseServiceId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "Service id must be a positive integer");
  }
  return id;
}

export function parseProfessionalId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, "Professional id must be a positive integer");
  }
  return id;
}

/** Only the fields that are present are validated and returned. */
export function parseServicePatch(body: unknown): ServicePatch {
  const input = requireObject(body);
  const patch: ServicePatch = {};

  if (input.name !== undefined) {
    patch.name = parseText(input.name, "name", 80);
    if (!patch.name) throw new AppError(400, "name is required");
  }
  if (input.description !== undefined) {
    patch.description = parseText(input.description, "description", 500);
  }
  if (input.priceCents !== undefined) {
    patch.priceCents = parseInteger(input.priceCents, "priceCents", 0, 1_000_000);
  }
  if (input.durationMinutes !== undefined) {
    patch.durationMinutes = parseInteger(input.durationMinutes, "durationMinutes", 5, 480);
  }
  return patch;
}

export function parseProfessionalPatch(body: unknown): ProfessionalPatch {
  const input = requireObject(body);
  const patch: ProfessionalPatch = {};

  if (input.name !== undefined) {
    patch.name = parseText(input.name, "name", 80);
    if (!patch.name) throw new AppError(400, "name is required");
  }
  if (input.specialties !== undefined) {
    if (!Array.isArray(input.specialties) || input.specialties.length > 8) {
      throw new AppError(400, "specialties must be a list of up to 8 items");
    }
    patch.specialties = input.specialties
      .map((item) => parseText(item, "specialty", 40))
      .filter((item) => item.length > 0);
  }
  if (input.bio !== undefined) {
    patch.bio = parseText(input.bio, "bio", 600);
  }
  if (input.photo !== undefined) {
    const photo = input.photo === null ? "" : parseMediaNameOrEmpty(input.photo, "photo");
    patch.photo = photo || null;
  }
  return patch;
}
