import express, { Router, type RequestHandler } from "express";
import type { AdminController } from "../controllers/admin-controller.js";
import type { BookingController } from "../controllers/booking-controller.js";
import type { OwnerController } from "../controllers/owner-controller.js";
import type { SiteController } from "../controllers/site-controller.js";
import { MEDIA_CONTENT_TYPES } from "../media/media-store.js";

export interface ApiControllers {
  booking: BookingController;
  site: SiteController;
  admin: AdminController;
  owner: OwnerController;
  requireOwner: RequestHandler;
  /** Throttles sign-in attempts. */
  loginLimit: RequestHandler;
  /** Throttles booking requests from one address. */
  bookingLimit: RequestHandler;
}

export function createApiRouter({
  booking,
  site,
  admin,
  owner,
  requireOwner,
  loginLimit,
  bookingLimit,
}: ApiControllers): Router {
  const router = Router();

  // Public site.
  router.get("/business", site.business);
  router.get("/services", booking.listServices);
  router.get("/professionals", booking.listProfessionals);
  router.get("/availability", booking.availability);
  router.post("/bookings", bookingLimit, booking.book);

  // Owner sign-in and sign-out do not need a session.
  router.post("/admin/login", loginLimit, owner.login);
  router.post("/admin/logout", owner.logout);

  // Everything else under /admin needs a valid session.
  const ownerRoutes = Router();
  ownerRoutes.use(requireOwner);
  ownerRoutes.get("/session", owner.session);
  ownerRoutes.put("/business", admin.saveBusiness);
  ownerRoutes.get("/media", admin.listMedia);
  ownerRoutes.post("/media", express.raw({ type: MEDIA_CONTENT_TYPES, limit: "8mb" }), admin.uploadMedia);
  ownerRoutes.patch("/services/:id", admin.updateService);
  ownerRoutes.patch("/professionals/:id", admin.updateProfessional);
  router.use("/admin", ownerRoutes);

  return router;
}
