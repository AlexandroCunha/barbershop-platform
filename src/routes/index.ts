import express, { Router, type RequestHandler } from "express";
import type { AdminController } from "../controllers/admin-controller.js";
import type { BookingController } from "../controllers/booking-controller.js";
import type { OwnerController } from "../controllers/owner-controller.js";
import type { PlatformController } from "../controllers/platform-controller.js";
import type { SiteController } from "../controllers/site-controller.js";
import { MEDIA_CONTENT_TYPES } from "../media/media-store.js";
import { loadTenant } from "../middlewares/load-tenant.js";
import type { TenantRepository } from "../repositories/types.js";

export interface ApiDependencies {
  tenants: TenantRepository;
  booking: BookingController;
  site: SiteController;
  admin: AdminController;
  owner: OwnerController;
  platform: PlatformController;
  requireOwner: RequestHandler;
  requirePlatform: RequestHandler;
  /** Throttles sign-in attempts from one address. */
  loginLimit: RequestHandler;
  /** Throttles booking requests from one address. */
  bookingLimit: RequestHandler;
}

/**
 * /api/t/:slug/...   one barbershop: public site, bookings and its owner area
 * /api/platform/...  the platform owner: barbershops and their licences
 */
export function createApiRouter(deps: ApiDependencies): Router {
  const router = Router();

  const shop = Router({ mergeParams: true });
  shop.use(loadTenant(deps.tenants));

  // Public site.
  shop.get("/business", deps.site.business);
  shop.get("/services", deps.booking.listServices);
  shop.get("/professionals", deps.booking.listProfessionals);
  shop.get("/availability", deps.booking.availability);
  shop.post("/bookings", deps.bookingLimit, deps.booking.book);

  // Owner sign-in and sign-out.
  shop.post("/owner/login", deps.loginLimit, deps.owner.login);
  shop.post("/owner/logout", deps.owner.logout);

  // Everything else in the owner area needs a session for this shop.
  const owner = Router();
  owner.use(deps.requireOwner);
  owner.get("/session", deps.owner.session);
  owner.put("/password", deps.owner.changePassword);
  owner.put("/business", deps.admin.saveBusiness);
  owner.get("/media", deps.admin.listMedia);
  owner.post("/media", express.raw({ type: MEDIA_CONTENT_TYPES, limit: "8mb" }), deps.admin.uploadMedia);
  owner.post("/services", deps.admin.createService);
  owner.post("/professionals", deps.admin.createProfessional);
  owner.patch("/services/:id", deps.admin.updateService);
  owner.patch("/professionals/:id", deps.admin.updateProfessional);
  shop.use("/owner", owner);

  router.use("/t/:slug", shop);

  // Platform owner.
  const platform = Router();
  platform.post("/session", deps.loginLimit, deps.platform.login);
  platform.post("/logout", deps.platform.logout);

  const platformRoutes = Router();
  platformRoutes.use(deps.requirePlatform);
  platformRoutes.get("/session", deps.platform.session);
  platformRoutes.get("/tenants", deps.platform.listTenants);
  platformRoutes.post("/tenants", deps.platform.createTenant);
  platformRoutes.patch("/tenants/:id/license", deps.platform.setLicense);
  platform.use(platformRoutes);

  router.use("/platform", platform);

  return router;
}
