import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Only what the site needs, all from its own address. Nothing is loaded from other companies, so no visitor data leaves the site. */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const TWO_YEARS_SECONDS = 63_072_000;

interface SecurityHeaderOptions {
  /** Send Strict-Transport-Security. Only enable when the site is served over HTTPS. */
  hsts: boolean;
}

export function securityHeaders({ hsts }: SecurityHeaderOptions): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (hsts) {
      res.setHeader("Strict-Transport-Security", `max-age=${TWO_YEARS_SECONDS}; includeSubDomains`);
    }
    next();
  };
}
