import type { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../utils/app-error.js";

/** The outcome of counting one request: how many the client has made in this window, and how long until it resets. */
export interface RateLimitHit {
  count: number;
  /** Whole seconds until the window ends, measured by the store's own clock. At least 1. */
  retryAfterSeconds: number;
}

/**
 * Where request counters live. PostgreSQL is shared by every instance; the in-memory store is
 * for tests and single-process use only, because each process would count on its own.
 */
export interface RateLimitStore {
  /** Counts one request by `client` against `bucket`, in the window that is open at the store's clock. */
  hit(bucket: string, client: string, windowMs: number): Promise<RateLimitHit>;
}

/** Keeps the in-memory table bounded even when many addresses make a single request each. */
const MAX_TRACKED_CLIENTS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly now: () => number = Date.now) {}

  async hit(bucket: string, client: string, windowMs: number): Promise<RateLimitHit> {
    const current = this.now();
    const key = `${bucket}\u0000${client}`;

    if (this.buckets.size > MAX_TRACKED_CLIENTS) {
      for (const [address, entry] of this.buckets) {
        if (entry.resetAt <= current) this.buckets.delete(address);
      }
    }

    let entry = this.buckets.get(key);
    if (!entry || entry.resetAt <= current) {
      entry = { count: 0, resetAt: current + windowMs };
      this.buckets.set(key, entry);
    }
    entry.count += 1;
    return { count: entry.count, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - current) / 1000)) };
  }
}

interface RateLimitOptions {
  /** Name of the limit, so that sign-in and booking counters never mix. */
  bucket: string;
  windowMs: number;
  max: number;
  message: string;
  store: RateLimitStore;
}

/** Fixed-window limit per client address. Requests over the limit get 429 with Retry-After. */
export function rateLimit({ bucket, windowMs, max, message, store }: RateLimitOptions): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hit = await store.hit(bucket, req.ip ?? "unknown", windowMs);
      if (hit.count > max) {
        res.setHeader("Retry-After", String(hit.retryAfterSeconds));
        next(new AppError(429, message));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
