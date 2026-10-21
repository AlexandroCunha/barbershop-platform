import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

/** Errors the body parser raises for a request the client sent wrongly. */
interface RequestBodyError {
  type: string;
  status: number;
}

/** Messages for body parser errors, so the parser's own wording never reaches the client. */
const BODY_ERRORS: Record<string, { status: number; message: string }> = {
  "entity.too.large": { status: 413, message: "The file is too large" },
  "entity.parse.failed": { status: 400, message: "The request body is not valid JSON" },
};

function bodyErrorOf(error: unknown): RequestBodyError | null {
  if (typeof error !== "object" || error === null || !("type" in error) || !("status" in error)) {
    return null;
  }
  const { type, status } = error;
  return typeof type === "string" && typeof status === "number" && status >= 400 && status < 500
    ? { type, status }
    : null;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  // A malformed or oversized request is the client's problem, so it gets a 4xx, not a 500.
  const bodyError = bodyErrorOf(error);
  if (bodyError) {
    const known = BODY_ERRORS[bodyError.type];
    res.status(known?.status ?? bodyError.status).json({ error: known?.message ?? "The request could not be processed" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
