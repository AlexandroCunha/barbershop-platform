import type { NextFunction, Request, RequestHandler, Response } from "express";
import { isValidSlug } from "../domain/slug.js";
import type { Tenant } from "../domain/tenant.js";
import type { TenantRepository } from "../repositories/types.js";
import { AppError } from "../utils/app-error.js";

/** Finds the barbershop named by the :slug route parameter. Every shop route depends on it. */
export function loadTenant(tenants: TenantRepository): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const slug = String(req.params.slug ?? "");
    if (!isValidSlug(slug)) {
      next(new AppError(404, "Barbershop not found"));
      return;
    }

    const tenant = await tenants.findBySlug(slug);
    if (!tenant) {
      next(new AppError(404, "Barbershop not found"));
      return;
    }

    req.tenant = tenant;
    next();
  };
}

/** For handlers that run after loadTenant. Reaching this without a shop is a programming error. */
export function tenantOf(req: Request): Tenant {
  if (!req.tenant) {
    throw new Error("loadTenant must run before this handler");
  }
  return req.tenant;
}
