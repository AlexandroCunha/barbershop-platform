import { createApp } from "./app.js";
import { OwnerAuth } from "./auth/owner-auth.js";
import { ensureBusinessFile, BusinessStore } from "./content/business-store.js";
import { loadConfig } from "./config/env.js";
import { CONTENT_FILE, CONTENT_TEMPLATE, MEDIA_DIR } from "./config/paths.js";
import { AdminController } from "./controllers/admin-controller.js";
import { BookingController } from "./controllers/booking-controller.js";
import { OwnerController } from "./controllers/owner-controller.js";
import { SiteController } from "./controllers/site-controller.js";
import { createPool } from "./db/pool.js";
import { MediaStore } from "./media/media-store.js";
import { rateLimit } from "./middlewares/rate-limit.js";
import { requireOwner } from "./middlewares/require-owner.js";
import { PgBookingRepository } from "./repositories/pg-booking-repository.js";
import { PgProfessionalRepository } from "./repositories/pg-professional-repository.js";
import { PgServiceRepository } from "./repositories/pg-service-repository.js";
import { AdminService } from "./services/admin-service.js";
import { BookingService, type Clock } from "./services/booking-service.js";

const MINUTE = 60_000;

const config = loadConfig();
const pool = createPool(config.databaseUrl);

await ensureBusinessFile(CONTENT_FILE, CONTENT_TEMPLATE);

const businessStore = new BusinessStore(CONTENT_FILE);
const mediaStore = new MediaStore(MEDIA_DIR);
await mediaStore.list(); // creates the media folder if it does not exist yet

const services = new PgServiceRepository(pool);
const professionals = new PgProfessionalRepository(pool);
const bookings = new PgBookingRepository(pool);

const clock: Clock = {
  today: (timeZone) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
      new Date(),
    ),
};

const auth = new OwnerAuth(config.adminToken);
const bookingService = new BookingService(services, professionals, bookings, businessStore, clock);
const adminService = new AdminService(businessStore, mediaStore, services, professionals);

const app = createApp(
  {
    booking: new BookingController(bookingService),
    site: new SiteController(businessStore),
    admin: new AdminController(adminService),
    owner: new OwnerController(auth, config.secureCookies),
    requireOwner: requireOwner(auth),
    loginLimit: rateLimit({
      windowMs: 15 * MINUTE,
      max: 10,
      message: "Too many sign-in attempts. Please wait 15 minutes and try again.",
    }),
    bookingLimit: rateLimit({
      windowMs: 10 * MINUTE,
      max: 30,
      message: "Too many booking attempts. Please wait a few minutes and try again.",
    }),
  },
  { secureCookies: config.secureCookies, trustProxy: config.trustProxy },
);

app.listen(config.port, () => {
  console.log(`Site running at http://localhost:${config.port}`);
  console.log(config.adminToken ? "Owner area: /admin" : "Owner area disabled: set ADMIN_TOKEN in .env");
});
