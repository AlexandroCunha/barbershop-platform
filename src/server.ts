import { createApp } from "./app.js";
import { AdminController } from "./controllers/admin-controller.js";
import { BookingController } from "./controllers/booking-controller.js";
import { BarberController } from "./controllers/barber-controller.js";
import { ManageController } from "./controllers/manage-controller.js";
import { OwnerController } from "./controllers/owner-controller.js";
import { PasswordResetController } from "./controllers/password-reset-controller.js";
import { SiteController } from "./controllers/site-controller.js";
import { loadConfig } from "./config/env.js";
import { loadLocalEnv } from "./config/load-env.js";
import { MEDIA_DIR } from "./config/paths.js";
import { createPool } from "./db/pool.js";
import { createMailer } from "./mail/mailer.js";
import { requireOwner } from "./middlewares/require-owner.js";
import { requireBarber } from "./middlewares/require-barber.js";
import { rateLimit } from "./middlewares/rate-limit.js";
import { LocalMediaStorage } from "./media/local-media-storage.js";
import { createS3MediaStorage } from "./media/s3-media-storage.js";
import { PgBarberAccountRepository } from "./repositories/pg-barber-account-repository.js";
import { PgBarberHoursRepository } from "./repositories/pg-barber-hours-repository.js";
import { PgBookingRepository } from "./repositories/pg-booking-repository.js";
import { PgNotificationRepository } from "./repositories/pg-notification-repository.js";
import { PgPasswordResetRepository } from "./repositories/pg-password-reset-repository.js";
import { PgRateLimitStore } from "./repositories/pg-rate-limit-store.js";
import { PgOwnerRepository } from "./repositories/pg-owner-repository.js";
import { PgProfessionalRepository } from "./repositories/pg-professional-repository.js";
import { PgServiceRepository } from "./repositories/pg-service-repository.js";
import { PgSessionRepository } from "./repositories/pg-session-repository.js";
import { PgTenantRepository } from "./repositories/pg-tenant-repository.js";
import { AccountService } from "./services/account-service.js";
import { AdminService } from "./services/admin-service.js";
import { BarberService } from "./services/barber-service.js";
import { BookingManagementService } from "./services/booking-management-service.js";
import { BookingMessages } from "./services/booking-messages.js";
import { BookingService } from "./services/booking-service.js";
import { NotificationWorker } from "./services/notification-worker.js";
import { PasswordResetService } from "./services/password-reset-service.js";
import { SessionService } from "./services/session-service.js";
import { systemClock as clock } from "./utils/clock.js";

const MINUTE = 60_000;
const WORKER_INTERVAL_MS = MINUTE;

loadLocalEnv();
const config = loadConfig();
const pool = createPool(config.databaseUrl);

const tenants = new PgTenantRepository(pool);
const owners = new PgOwnerRepository(pool);
const services = new PgServiceRepository(pool);
const professionals = new PgProfessionalRepository(pool);
const bookings = new PgBookingRepository(pool);
const barberAccounts = new PgBarberAccountRepository(pool);
const barberHours = new PgBarberHoursRepository(pool);
const notifications = new PgNotificationRepository(pool);
const passwordResets = new PgPasswordResetRepository(pool);
const sessions = new SessionService(new PgSessionRepository(pool), clock);

const mailer = createMailer(config.mail);
const mailEnabled = config.mail.kind !== "off";
const messages = new BookingMessages({ secret: config.sessionSecret, publicUrl: config.publicUrl, enabled: mailEnabled }, clock);

const bookingService = new BookingService(services, professionals, bookings, clock, barberHours, messages);
const management = new BookingManagementService(bookings, services, professionals, bookingService, messages, clock);
const barbers = new BarberService(barberAccounts, professionals, services, bookings, sessions, clock, barberHours);
const passwordReset = new PasswordResetService(owners, barberAccounts, passwordResets, sessions, mailer, clock, {
  publicUrl: config.publicUrl,
  enabled: mailEnabled,
});

const accounts = new AccountService(tenants, owners, clock);
const media = config.media.kind === "s3" ? createS3MediaStorage(config.media.settings) : new LocalMediaStorage(MEDIA_DIR);
if (config.production && config.media.kind === "local") {
  // Free hosts reset the disk on every deploy, so photos stored here disappear. See docs/DEPLOY.md.
  console.warn("Photos are kept on this server's disk. Set MEDIA_STORAGE=s3 and the S3_* variables to keep them.");
}
if (config.production && !mailEnabled) {
  console.warn("E-mail is off: confirmations, reminders and password resets are not sent. Set MAIL_TRANSPORT=smtp.");
}
// Counters live in PostgreSQL, so every instance enforces the same limits.
const limits = new PgRateLimitStore(pool);

const app = createApp(
  {
    tenants,
    booking: new BookingController(bookingService, management),
    site: new SiteController({ tenants, homeShopSlug: config.homeShopSlug }),
    barber: new BarberController({
      barbers,
      management,
      secret: config.sessionSecret,
      secureCookies: config.secureCookies,
      clock,
    }),
    requireBarber: requireBarber(config.sessionSecret, barberAccounts, sessions),
    admin: new AdminController(new AdminService(tenants, media, services, professionals, clock)),
    owner: new OwnerController({
      accounts,
      sessions,
      secret: config.sessionSecret,
      secureCookies: config.secureCookies,
      clock,
    }),
    requireOwner: requireOwner(config.sessionSecret, owners, sessions),
    loginLimit: rateLimit({
      bucket: "sign-in",
      windowMs: 15 * MINUTE,
      max: 10,
      message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
      store: limits,
    }),
    bookingLimit: rateLimit({
      bucket: "booking",
      windowMs: 10 * MINUTE,
      max: config.bookingRateLimit,
      message: "Too many booking attempts. Please wait a few minutes and try again.",
      store: limits,
    }),
    resetLimit: rateLimit({
      bucket: "password-reset",
      windowMs: 60 * MINUTE,
      max: 5,
      message: "Too many password reset requests. Please try again in an hour.",
      store: limits,
    }),
    manageLimit: rateLimit({
      bucket: "manage",
      windowMs: 10 * MINUTE,
      max: 60,
      message: "Too many requests for this booking. Please wait a few minutes and try again.",
      store: limits,
    }),
    manage: new ManageController(management, bookingService, config.sessionSecret, clock),
    passwordReset: new PasswordResetController(passwordReset),
  },
  {
    secureCookies: config.secureCookies,
    trustProxyHops: config.trustProxyHops,
    media,
    findRedirect: (oldSlug) => tenants.findRedirect(oldSlug),
  },
);

if (mailEnabled) {
  const worker = new NotificationWorker(notifications, mailer, clock);
  setInterval(() => {
    worker.runOnce().catch((error: unknown) => console.error("The e-mail worker stopped a run", error));
  }, WORKER_INTERVAL_MS);
}

app.listen(config.port, () => {
  console.log(`Barbershop Platform running at http://localhost:${config.port}`);
});
