import express, { Router, type RequestHandler } from "express";
import type { AdminController } from "../controllers/admin-controller.js";
import type { BarberController } from "../controllers/barber-controller.js";
import type { BookingController } from "../controllers/booking-controller.js";
import type { ManageController } from "../controllers/manage-controller.js";
import type { PasswordResetController } from "../controllers/password-reset-controller.js";
import type { OwnerController } from "../controllers/owner-controller.js";
import type { SiteController } from "../controllers/site-controller.js";
import { MEDIA_CONTENT_TYPES } from "../media/media-storage.js";
import { loadTenant } from "../middlewares/load-tenant.js";
import type { TenantRepository } from "../repositories/types.js";

export interface ApiDependencies {
  tenants: TenantRepository;
  booking: BookingController;
  site: SiteController;
  barber: BarberController;
  /** Lets through only a barber signed in to their own area of the shop. */
  requireBarber: RequestHandler;
  admin: AdminController;
  owner: OwnerController;
  requireOwner: RequestHandler;
  /** Throttles sign-in attempts from one address. */
  loginLimit: RequestHandler;
  /** Throttles booking requests from one address. */
  bookingLimit: RequestHandler;
  /** Throttles password reset requests and confirmations from one address. */
  resetLimit: RequestHandler;
  /** Throttles the customer's link actions from one address, so a token cannot be guessed by trying many. */
  manageLimit: RequestHandler;
  manage: ManageController;
  passwordReset: PasswordResetController;
}

/**
 * /api/t/:slug/...   one barbershop: public site, bookings and its owner area
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

  // A customer's own booking, through the link in their e-mail. The token is sent in the body.
  shop.post("/manage/view", deps.manageLimit, deps.manage.view);
  shop.post("/manage/cancel", deps.manageLimit, deps.manage.cancel);
  shop.post("/manage/move", deps.manageLimit, deps.manage.move);
  shop.post("/manage/availability", deps.manageLimit, deps.manage.availability);

  // Forgotten passwords. The owner and the barber each request a link; the link sets the new password.
  shop.post("/password-reset/owner", deps.resetLimit, deps.passwordReset.requestOwner);
  shop.post("/password-reset/barber", deps.resetLimit, deps.passwordReset.requestBarber);
  shop.post("/password-reset/confirm", deps.resetLimit, deps.passwordReset.confirm);

  // Owner sign-in and sign-out.
  shop.post("/owner/login", deps.loginLimit, deps.owner.login);
  shop.post("/owner/logout", deps.owner.logout);

  // Everything else in the owner area needs a session for this shop.
  const owner = Router();
  owner.use(deps.requireOwner);
  owner.get("/session", deps.owner.session);
  owner.put("/password", deps.owner.changePassword);
  owner.put("/business", deps.admin.saveBusiness);
  owner.put("/address", deps.admin.changeAddress);
  owner.get("/bookings", deps.booking.ownerBookings);
  owner.post("/bookings/:id/cancel", deps.booking.ownerCancel);
  owner.post("/bookings/:id/move", deps.booking.ownerMove);
  owner.get("/media", deps.admin.listMedia);
  owner.post("/media", express.raw({ type: MEDIA_CONTENT_TYPES, limit: "8mb" }), deps.admin.uploadMedia);
  owner.delete("/media/:name", deps.admin.removeMedia);
  owner.post("/services", deps.admin.createService);
  owner.post("/professionals", deps.admin.createProfessional);
  owner.delete("/services/:id", deps.admin.archiveService);
  owner.delete("/professionals/:id", deps.admin.archiveProfessional);
  owner.patch("/services/:id", deps.admin.updateService);
  owner.patch("/professionals/:id", deps.admin.updateProfessional);
  // Creating, replacing and removing a barber's login is an owner action.
  owner.put("/professionals/:id/login", deps.barber.setLogin);
  owner.delete("/professionals/:id/login", deps.barber.removeLogin);
  owner.get("/professionals/:id/hours", deps.barber.ownerHours);
  owner.put("/professionals/:id/hours", deps.barber.saveOwnerHours);
  // Where a barber hears about new bookings. Owner only, never part of the public barber list.
  owner.get("/professionals/:id/contact", deps.barber.ownerContact);
  owner.put("/professionals/:id/contact", deps.barber.saveOwnerContact);
  shop.use("/owner", owner);

  // A barber's own area: sign-in, sign-out, and only their upcoming bookings.
  shop.post("/barber/login", deps.loginLimit, deps.barber.login);
  shop.post("/barber/logout", deps.barber.logout);
  const barber = Router();
  barber.use(deps.requireBarber);
  barber.get("/session", deps.barber.session);
  barber.get("/bookings", deps.barber.bookings);
  barber.post("/bookings/:id/cancel", deps.barber.cancelBooking);
  barber.post("/bookings/:id/move", deps.barber.moveBooking);
  barber.get("/hours", deps.barber.hours);
  barber.put("/hours", deps.barber.saveHours);
  shop.use("/barber", barber);

  // The shop the home page opens. Not tied to a shop address.
  router.get("/home", deps.site.home);

  router.use("/t/:slug", shop);

  return router;
}
