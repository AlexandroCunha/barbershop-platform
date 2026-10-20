import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  // Body parser limit exceeded (e.g. an image larger than the upload limit).
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ error: "The file is too large" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}
