import { createHmac } from "node:crypto";
import { createApp } from "./app.js";
import { AdminController } from "./controllers/admin-controller.js";
import { BookingController } from "./controllers/booking-controller.js";
import { OwnerController } from "./controllers/owner-controller.js";
import { PlatformController } from "./controllers/platform-controller.js";
import { SiteController } from "./controllers/site-controller.js";
import { loadConfig } from "./config/env.js";
import { MEDIA_DIR } from "./config/paths.js";
import { createPool } from "./db/pool.js";
import { requireOwner } from "./middlewares/require-owner.js";
import { requirePlatform } from "./middlewares/require-platform.js";
import { rateLimit } from "./middlewares/rate-limit.js";
import { PgBookingRepository } from "./repositories/pg-booking-repository.js";
import { PgOwnerRepository } from "./repositories/pg-owner-repository.js";
import { PgProfessionalRepository } from "./repositories/pg-professional-repository.js";
import { PgServiceRepository } from "./repositories/pg-service-repository.js";
import { PgSessionRepository } from "./repositories/pg-session-repository.js";
import { PgTenantRepository } from "./repositories/pg-tenant-repository.js";
import { AccountService } from "./services/account-service.js";
import { AdminService } from "./services/admin-service.js";
import { BookingService } from "./services/booking-service.js";
import { SessionService } from "./services/session-service.js";
import { systemClock as clock } from "./utils/clock.js";

const MINUTE = 60_000;

const config = loadConfig();
const pool = createPool(config.databaseUrl);

const tenants = new PgTenantRepository(pool);
const owners = new PgOwnerRepository(pool);
const services = new PgServiceRepository(pool);
const professionals = new PgProfessionalRepository(pool);
const bookings = new PgBookingRepository(pool);
const sessions = new SessionService(new PgSessionRepository(pool), clock);

// The platform key is derived from the platform token, so rotating the token ends platform sessions.
const platformKey =
  config.platformToken === undefined
    ? undefined
    : createHmac("sha256", config.sessionSecret).update(`platform:${config.platformToken}`).digest("base64url");

const accounts = new AccountService(tenants, owners, clock);
const app = createApp(
  {
    tenants,
    booking: new BookingController(new BookingService(services, professionals, bookings, clock)),
    site: new SiteController(),
    admin: new AdminController(new AdminService(tenants, MEDIA_DIR, services, professionals)),
    owner: new OwnerController({
      accounts,
      sessions,
      secret: config.sessionSecret,
      secureCookies: config.secureCookies,
      clock,
    }),
    platform: new PlatformController({
      platformToken: config.platformToken,
      platformKey,
      accounts,
      sessions,
      secureCookies: config.secureCookies,
      clock,
    }),
    requireOwner: requireOwner(config.sessionSecret, owners, sessions),
    requirePlatform: requirePlatform(platformKey, sessions),
    loginLimit: rateLimit({
      windowMs: 15 * MINUTE,
      max: 10,
      message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
    }),
    bookingLimit: rateLimit({
      windowMs: 10 * MINUTE,
      max: config.bookingRateLimit,
      message: "Too many booking attempts. Please wait a few minutes and try again.",
    }),
  },
  { secureCookies: config.secureCookies, trustProxyHops: config.trustProxyHops, mediaRoot: MEDIA_DIR },
);

app.listen(config.port, () => {
  console.log(`Barbearia running at http://localhost:${config.port}`);
  console.log(
    config.platformToken === undefined
      ? "Platform area disabled: PLATFORM_ADMIN_TOKEN is not set"
      : "Platform area: /platform",
  );
});
