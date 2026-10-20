import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../utils/app-error.js";

interface Bucket {
  count: number;
  resetAt: number;
}

/** Keeps the in-memory table bounded even when many addresses make a single request each. */
const MAX_TRACKED_ADDRESSES = 10_000;

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  now?: () => number;
}

/** Fixed-window limit per client address. Requests over the limit get 429 with Retry-After. */
export function rateLimit({ windowMs, max, message, now = Date.now }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const current = now();
    const key = req.ip ?? "unknown";

    if (buckets.size > MAX_TRACKED_ADDRESSES) {
      for (const [address, bucket] of buckets) {
        if (bucket.resetAt <= current) buckets.delete(address);
      }
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      bucket = { count: 0, resetAt: current + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - current) / 1000)));
      next(new AppError(429, message));
      return;
    }

    next();
  };
}
