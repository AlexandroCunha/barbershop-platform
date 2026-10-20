/**
 * End-to-end simulation of one barbershop with ten concurrent agents:
 *   1 owner, 3 new barbers, 6 customers.
 *
 * It talks to a running server over HTTP and checks the database directly.
 * Usage: npm run simulate   (server must be running; .env must hold PLATFORM_ADMIN_TOKEN)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// psql is used to read the database directly. Postgres.app ships it outside the PATH.
const PSQL =
  process.env.PSQL ??
  (existsSync("/Applications/Postgres.app/Contents/Versions/latest/bin/psql")
    ? "/Applications/Postgres.app/Contents/Versions/latest/bin/psql"
    : "psql");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);

const results = [];
const log = (agent, name, ok, detail = "") => {
  results.push({ agent, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${agent}] ${name}${detail ? ` — ${detail}` : ""}`);
};

/** Small HTTP helper that returns status, parsed body and any cookie set by the response. */
async function call(method, path, { body, cookie, raw, contentType } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  let payload;
  if (raw) {
    headers["Content-Type"] = contentType;
    payload = raw;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const started = performance.now();
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const elapsed = Math.round(performance.now() - started);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = response.headers.get("set-cookie") ?? "";
  const pair = setCookie.match(/^[^;]+=[^;]*/);
  return { status: response.status, json, cookie: pair ? pair[0] : undefined, elapsed };
}

function dayAfter(days, weekday) {
  // Returns the next date (YYYY-MM-DD) at least `days` ahead that falls on `weekday` (0 = Sunday).
  const date = new Date();
  date.setDate(date.getDate() + days);
  while (date.getDay() !== weekday) date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function psql(sql) {
  const url = new URL(env.DATABASE_URL);
  return execFileSync(
    PSQL,
    ["-h", url.hostname, "-p", url.port, "-U", decodeURIComponent(url.username), "-d", url.pathname.slice(1), "-tAc", sql],
    { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, encoding: "utf8" },
  ).trim();
}

const slug = `sim-${Date.now().toString(36)}`;
const OWNER_EMAIL = `owner.${slug}@example.test`;
const OWNER_PASSWORD = "simulation-owner-password-2026";
const MONDAY = dayAfter(8, 1);
const SATURDAY = dayAfter(8, 6);
const SUNDAY = dayAfter(8, 0);
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

// ---------------------------------------------------------------------------
// Platform owner creates the shop.
// ---------------------------------------------------------------------------
const platform = await call("POST", "/api/platform/session", { body: { token: env.PLATFORM_ADMIN_TOKEN } });
log("platform", "signs in with the platform token", platform.status === 200, `HTTP ${platform.status}`);
const platformCookie = platform.cookie;

const created = await call("POST", "/api/platform/tenants", {
  cookie: platformCookie,
  body: { name: "Simulation Barbers", slug, ownerEmail: OWNER_EMAIL, ownerPassword: OWNER_PASSWORD },
});
log("platform", "creates a barbershop with a 14-day trial", created.status === 201 && created.json.state === "trial", `HTTP ${created.status}`);

// ---------------------------------------------------------------------------
// Owner agent: sets up the shop.
// ---------------------------------------------------------------------------
const OWNER = "owner";
const wrong = await call("POST", `/api/t/${slug}/owner/login`, { body: { email: OWNER_EMAIL, password: "wrong password here" } });
log(OWNER, "is refused with a wrong password", wrong.status === 401, `HTTP ${wrong.status}`);

const login = await call("POST", `/api/t/${slug}/owner/login`, { body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
log(OWNER, "signs in", login.status === 200 && Boolean(login.cookie), `HTTP ${login.status}`);
let ownerCookie = login.cookie;

const second = await call("POST", `/api/t/${slug}/owner/login`, { body: { email: OWNER_EMAIL, password: OWNER_PASSWORD } });
const otherDeviceCookie = second.cookie;

const session = await call("GET", `/api/t/${slug}/owner/session`, { cookie: ownerCookie });
log(OWNER, "sees the licence state", session.status === 200 && session.json.license.state === "trial", `state=${session.json?.license?.state}`);

const crossShop = await call("GET", `/api/t/northgate/owner/session`, { cookie: ownerCookie });
log(OWNER, "cannot use this shop's session on another shop", crossShop.status === 401, `HTTP ${crossShop.status}`);

const business = (await call("GET", `/api/t/${slug}/business`)).json;
const updatedBusiness = {
  ...business,
  name: "Simulation Barbers",
  tagline: "Sharp cuts, calm chair.",
  about: "A test shop run by ten simulated agents.",
  phone: "+353 1 555 0199",
  email: "hello@simulation.example.test",
  address: { street: "1 Test Street", city: "Dublin", postcode: "D08 T123", country: "Ireland" },
  hours: {
    ...business.hours,
    sunday: null,
    saturday: { open: "09:00", close: "18:00" },
  },
};
const saved = await call("PUT", `/api/t/${slug}/owner/business`, { cookie: ownerCookie, body: updatedBusiness });
log(OWNER, "saves business details and hours", saved.status === 200 && saved.json.hours.sunday === null, `HTTP ${saved.status}`);

const invalidHours = await call("PUT", `/api/t/${slug}/owner/business`, {
  cookie: ownerCookie,
  body: { ...updatedBusiness, hours: { ...updatedBusiness.hours, monday: { open: "19:00", close: "09:00" } } },
});
log(OWNER, "is refused hours that close before they open", invalidHours.status === 400, `HTTP ${invalidHours.status}`);

const services = (await call("GET", `/api/t/${slug}/services`)).json;
const serviceById = Object.fromEntries(services.map((s) => [s.id, s]));
const updateService = await call("PATCH", `/api/t/${slug}/owner/services/${services[0].id}`, {
  cookie: ownerCookie,
  body: { description: "Scissor or clipper cut with a finish.", priceCents: 2800 },
});
log(OWNER, "updates a service price and description", updateService.status === 200 && updateService.json.priceCents === 2800);

const addService = await call("POST", `/api/t/${slug}/owner/services`, {
  cookie: ownerCookie,
  body: { name: "Hot towel shave", description: "Traditional shave with a hot towel.", priceCents: 2200, durationMinutes: 25 },
});
log(OWNER, "adds a new service", addService.status === 201, `HTTP ${addService.status}`);
const duplicateService = await call("POST", `/api/t/${slug}/owner/services`, {
  cookie: ownerCookie,
  body: { name: "Hot towel shave", description: "", priceCents: 2200, durationMinutes: 25 },
});
log(OWNER, "is refused a duplicate service name", duplicateService.status === 409, `HTTP ${duplicateService.status}`);

// Owner uploads a portrait for the first new barber.
const PHOTO = "/System/Library/Desktop Pictures/Solid Colors/Space Gray.png";
const photoBytes = readFileSync(PHOTO);
const upload = await call("POST", `/api/t/${slug}/owner/media?name=${encodeURIComponent("Ada Reyes portrait.png")}`, {
  cookie: ownerCookie,
  raw: photoBytes,
  contentType: "image/png",
});
log(OWNER, "uploads a portrait photo", upload.status === 201 && upload.json.name.endsWith(".png"), `name=${upload.json?.name}`);

const notAnImage = await call("POST", `/api/t/${slug}/owner/media?name=fake.png`, {
  cookie: ownerCookie,
  raw: Buffer.from("definitely not a picture"),
  contentType: "image/png",
});
log(OWNER, "is refused a fake image", notAnImage.status === 400, `HTTP ${notAnImage.status}`);

// ---------------------------------------------------------------------------
// Three new barbers, each set up by the owner on their behalf.
// ---------------------------------------------------------------------------
const NEW_BARBERS = [
  { name: "Ada Reyes", specialties: ["Classic cuts", "Scissor work"], bio: "Tailored classic cuts." },
  { name: "Ben Walker", specialties: ["Skin fades", "Line-ups"], bio: "Sharp fades every week." },
  { name: "Cleo Park", specialties: ["Beard work", "Textured styles"], bio: "Beard shaping and texture." },
];
const barberIds = {};
for (const barber of NEW_BARBERS) {
  const res = await call("POST", `/api/t/${slug}/owner/professionals`, { cookie: ownerCookie, body: { name: barber.name, specialties: [], bio: "" } });
  log(OWNER, `adds barber ${barber.name}`, res.status === 201, `HTTP ${res.status}`);
  barberIds[barber.name] = res.json.id;
}
const ada = await call("PATCH", `/api/t/${slug}/owner/professionals/${barberIds["Ada Reyes"]}`, {
  cookie: ownerCookie,
  body: { specialties: NEW_BARBERS[0].specialties, bio: NEW_BARBERS[0].bio, photo: upload.json.name },
});
log(OWNER, "gives Ada her specialties, bio and portrait", ada.status === 200 && ada.json.photo === upload.json.name);

for (const barber of NEW_BARBERS.slice(1)) {
  const res = await call("PATCH", `/api/t/${slug}/owner/professionals/${barberIds[barber.name]}`, {
    cookie: ownerCookie,
    body: { specialties: barber.specialties, bio: barber.bio },
  });
  log(OWNER, `gives ${barber.name} specialties and bio`, res.status === 200);
}

const publicBarbers = (await call("GET", `/api/t/${slug}/professionals`)).json;
log(OWNER, "the shop lists all three new barbers to customers", publicBarbers.filter((p) => Object.values(barberIds).includes(p.id)).length === 3);

// The shop starts with two placeholder barbers. The owner removes them before opening.
const placeholders = publicBarbers.filter((p) => /^Barber \d$/.test(p.name));
log(OWNER, "finds the two placeholder barbers from setup", placeholders.length === 2, placeholders.map((p) => p.name).join(", "));
for (const placeholder of placeholders) {
  const removed = await call("DELETE", `/api/t/${slug}/owner/professionals/${placeholder.id}`, { cookie: ownerCookie });
  log(OWNER, `removes placeholder ${placeholder.name}`, removed.status === 204, `HTTP ${removed.status}`);
}
const afterRemoval = (await call("GET", `/api/t/${slug}/professionals`)).json;
log(OWNER, "removed barbers no longer appear to customers", afterRemoval.length === 3 && !afterRemoval.some((p) => /^Barber \d$/.test(p.name)), `${afterRemoval.length} barbers listed`);
const removedBookable = await call("GET", `/api/t/${slug}/availability?serviceId=${services[0].id}&date=${dayAfter(8, 1)}&professionalId=${placeholders[0].id}`);
log("customers", "a removed barber cannot be chosen for a booking", removedBookable.status === 404, `HTTP ${removedBookable.status}`);

const removedService = await call("DELETE", `/api/t/${slug}/owner/services/${services[3].id}`, { cookie: ownerCookie });
log(OWNER, "removes a service from the menu", removedService.status === 204, `HTTP ${removedService.status}`);
const menu = (await call("GET", `/api/t/${slug}/services`)).json;
log("customers", "the removed service is no longer on the menu", !menu.some((s) => s.id === services[3].id));
const removedServiceBooking = await call("POST", `/api/t/${slug}/bookings`, { body: { customerName: "Old Link", customerEmail: "old@example.test", customerPhone: "+353 85 123 4567", serviceId: services[3].id, date: dayAfter(8, 1), time: "09:00" } });
log("customers", "an old link to the removed service is refused", removedServiceBooking.status === 404, `HTTP ${removedServiceBooking.status}`);

// ---------------------------------------------------------------------------
// Six customers.
// ---------------------------------------------------------------------------
const SERVICE_CLASSIC = services[0].id; // 30 min (the first service; never removed above)
const SERVICE_FADE = services[1].id; // 45 min
const SERVICE_BEARD = services[2].id; // 20 min
const customerBody = (name, extra = {}) => ({
  customerName: name,
  customerEmail: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
  customerPhone: "+353 85 123 4567",
  ...extra,
});

// Customers first, all at once, for the same slot: the core concurrency test.
const RACE_TIME = "10:00";
const RACE_DATE = MONDAY;
const raceCustomers = ["Alice Morgan", "Ben Ortiz", "Chloe Hart", "Dev Shah", "Eve Lind", "Finn Doyle"];
const raceResults = await Promise.all(
  raceCustomers.map(async (name, index) => {
    // A short, different delay per agent so that requests overlap without being identical.
    await new Promise((resolve) => setTimeout(resolve, index * 3));
    const preferred = name === "Chloe Hart" ? barberIds["Ada Reyes"] : undefined;
    return {
      name,
      res: await call("POST", `/api/t/${slug}/bookings`, {
        body: customerBody(name, {
          serviceId: SERVICE_CLASSIC,
          date: RACE_DATE,
          time: RACE_TIME,
          ...(preferred ? { professionalId: preferred } : {}),
        }),
      }),
    };
  }),
);
for (const { name, res } of raceResults) {
  const outcome = res.status === 201 ? `booked with barber #${res.json.professionalId}` : `refused (HTTP ${res.status}: ${res.json?.error})`;
  log(name, "tries 10:00 with a classic cut", res.status === 201 || res.status === 409, outcome);
}
const winners = raceResults.filter((r) => r.res.status === 201);
const losers = raceResults.filter((r) => r.res.status === 409);
log("customers", "six customers race for the same 10:00 slot", winners.length + losers.length === 6 && winners.length >= 1, `${winners.length} booked, ${losers.length} refused`);
const winnerBarbers = winners.map((w) => w.res.json.professionalId);
log("customers", "each booking in the race goes to a different barber", new Set(winnerBarbers).size === winners.length);
log("customers", "the race fills all three barbers at 10:00, no more", winners.length === 3, `${winners.length} of 3 chairs taken`);
const raceAvg = Math.round(raceResults.reduce((sum, r) => sum + r.res.elapsed, 0) / raceResults.length);
log("customers", "race requests answer in under 1s on average", raceAvg < 1000, `${raceAvg} ms average`);

// Remaining customer journeys, run concurrently with each other.
const journeys = {
  "Ben Ortiz": async () => {
    const bad = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Ben Ortiz", { serviceId: SERVICE_BEARD, date: MONDAY, time: "14:00", customerEmail: "not-an-email" }) });
    log("Ben Ortiz", "is refused an invalid email with a clear message", bad.status === 400 && /email/i.test(bad.json.error), bad.json?.error);
    const good = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Ben Ortiz", { serviceId: SERVICE_BEARD, date: MONDAY, time: "14:00", professionalId: barberIds["Ben Walker"] }) });
    log("Ben Ortiz", "books a beard trim with Ben Walker at 14:00", good.status === 201 && good.json.professionalId === barberIds["Ben Walker"], `HTTP ${good.status}`);
  },
  "Chloe Hart": async () => {
    const past = await call("GET", `/api/t/${slug}/availability?serviceId=${SERVICE_CLASSIC}&date=${YESTERDAY}`);
    log("Chloe Hart", "cannot see times for a past date", past.status === 400, `HTTP ${past.status}`);
    const sunday = await call("GET", `/api/t/${slug}/availability?serviceId=${SERVICE_CLASSIC}&date=${SUNDAY}`);
    log("Chloe Hart", "sees no times on a closed Sunday", sunday.status === 200 && sunday.json.times.length === 0);
    const closed = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Chloe Hart", { serviceId: SERVICE_CLASSIC, date: SUNDAY, time: "10:00" }) });
    log("Chloe Hart", "cannot book on a closed Sunday", closed.status === 409, `HTTP ${closed.status}`);
  },
  "Dev Shah": async () => {
    const noPhone = await call("POST", `/api/t/${slug}/bookings`, { body: { ...customerBody("Dev Shah", { serviceId: SERVICE_BEARD, date: MONDAY, time: "15:00" }), customerPhone: "" } });
    log("Dev Shah", "is asked for a mobile number", noPhone.status === 400 && /customerPhone/.test(noPhone.json.error), noPhone.json?.error);
    const ghostBarber = await call("GET", `/api/t/${slug}/availability?serviceId=${SERVICE_BEARD}&date=${MONDAY}&professionalId=999999`);
    log("Dev Shah", "gets a 404 for a barber that does not exist", ghostBarber.status === 404, `HTTP ${ghostBarber.status}`);
  },
  "Eve Lind": async () => {
    const ghostService = await call("GET", `/api/t/${slug}/availability?serviceId=999999&date=${MONDAY}`);
    log("Eve Lind", "gets a 404 for a service that does not exist", ghostService.status === 404, `HTTP ${ghostService.status}`);
    const other = await call("GET", `/api/t/${slug}-missing/services`);
    log("Eve Lind", "gets a 404 for a shop that does not exist", other.status === 404, `HTTP ${other.status}`);
    const fade = await call("GET", `/api/t/${slug}/availability?serviceId=${SERVICE_FADE}&date=${SATURDAY}`);
    const lastStart = fade.json.times.at(-1);
    // Times are offered on a 30-minute grid from opening. A 45-minute fade must end by 18:00, so the last start is 17:00.
log("Eve Lind", "a 45-minute fade is only offered if it ends by closing time", lastStart === "17:00", `last start ${lastStart}`);
    const tooLate = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Eve Lind", { serviceId: SERVICE_FADE, date: SATURDAY, time: "17:30" }) });
    log("Eve Lind", "cannot book a fade that would run past closing", tooLate.status === 409, `HTTP ${tooLate.status}`);
    const fits = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Eve Lind", { serviceId: SERVICE_FADE, date: SATURDAY, time: "17:00" }) });
    log("Eve Lind", "books the last fade slot of the day", fits.status === 201, `HTTP ${fits.status}`);
  },
  "Finn Doyle": async () => {
    const shave = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Finn Doyle", { serviceId: addService.json.id, date: MONDAY, time: "16:00" }) });
    log("Finn Doyle", "books the new hot towel shave", shave.status === 201, `HTTP ${shave.status}`);
    const hugeName = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("F".repeat(120), { serviceId: SERVICE_BEARD, date: MONDAY, time: "17:00" }) });
    log("Finn Doyle", "is refused an overlong name", hugeName.status === 400, `HTTP ${hugeName.status}`);
  },
};
await Promise.all(Object.values(journeys).map((journey) => journey()));

// ---------------------------------------------------------------------------
// Barber agents: each checks that its own diary is right.
// ---------------------------------------------------------------------------
const bookingsByBarber = {};
for (const w of winners) {
  (bookingsByBarber[w.res.json.professionalId] ??= []).push(w.res.json.startTime);
}
for (const barber of NEW_BARBERS) {
  const id = barberIds[barber.name];
  const diary = (await call("GET", `/api/t/${slug}/availability?serviceId=${SERVICE_CLASSIC}&date=${RACE_DATE}&professionalId=${id}`)).json;
  const booked = psql(`SELECT start_minute || ',' || end_minute FROM bookings b JOIN tenants t ON t.id = b.tenant_id WHERE t.slug = '${slug}' AND b.professional_id = ${id} AND b.booking_date = '${RACE_DATE}'`)
    .split("\n").filter(Boolean).map((row) => row.split(",").map(Number));
  const clashing = diary.times.filter((time) => {
    const [h, m] = time.split(":").map(Number);
    const start = h * 60 + m;
    return booked.some(([from, to]) => start < to && from < start + 30);
  });
  log(barber.name, "never offers a time that overlaps one of their bookings", clashing.length === 0, clashing.length ? `clashes at ${clashing}` : `${booked.length} bookings on the day`);
}

// Barber calendars must never overlap. Checked in the database, not just through the API.
const overlaps = Number(psql(`
  SELECT count(*) FROM bookings a
  JOIN bookings b ON a.tenant_id = b.tenant_id AND a.professional_id = b.professional_id
    AND a.booking_date = b.booking_date AND a.id <> b.id
    AND a.start_minute < b.end_minute AND b.start_minute < a.end_minute
  WHERE a.tenant_id = (SELECT id FROM tenants WHERE slug = '${slug}')`));
log("database", "no two bookings overlap for the same barber", overlaps === 0, `${overlaps} overlapping pairs`);

// Overlapping starts with different lengths: the race the unique key alone does not stop.
const overlapRaces = [];
for (let round = 0; round < 5; round++) {
  const date = dayAfter(20 + round * 7, 2); // a Tuesday, a week apart
  const barberId = barberIds["Cleo Park"];
  const [long, short] = await Promise.all([
    call("POST", `/api/t/${slug}/bookings`, { body: customerBody(`Long ${round}`, { serviceId: SERVICE_FADE, date, time: "11:00", professionalId: barberId }) }),
    call("POST", `/api/t/${slug}/bookings`, { body: customerBody(`Short ${round}`, { serviceId: SERVICE_CLASSIC, date, time: "11:30", professionalId: barberId }) }),
  ]);
  overlapRaces.push({ date, both: long.status === 201 && short.status === 201, long: long.status === 201, short: short.status === 201 });
}
const doubleBooked = overlapRaces.filter((r) => r.both).length;
log("customers", "two overlapping bookings for one chair are never both accepted", doubleBooked === 0, `${doubleBooked} of ${overlapRaces.length} rounds double-booked`);
const overlapRoundsAccepted = overlapRaces.filter((r) => r.long || r.short).length;
log("customers", "each overlap round still accepts one of the two bookings", overlapRoundsAccepted === overlapRaces.length, `${overlapRoundsAccepted} of ${overlapRaces.length} rounds`);

// ---------------------------------------------------------------------------
// Owner again: password change and session handling.
// ---------------------------------------------------------------------------
const changed = await call("PUT", `/api/t/${slug}/owner/password`, {
  cookie: ownerCookie,
  body: { currentPassword: OWNER_PASSWORD, newPassword: "simulation-owner-password-2027" },
});
log(OWNER, "changes the password", changed.status === 200 && Boolean(changed.cookie), `HTTP ${changed.status}`);
const staleSession = await call("GET", `/api/t/${slug}/owner/session`, { cookie: otherDeviceCookie });
log(OWNER, "the other device is signed out after the change", staleSession.status === 401, `HTTP ${staleSession.status}`);
const refreshed = await call("GET", `/api/t/${slug}/owner/session`, { cookie: changed.cookie });
log(OWNER, "this device stays signed in", refreshed.status === 200);
ownerCookie = changed.cookie;

// ---------------------------------------------------------------------------
// Platform suspends the shop: customers are stopped, owner can still look.
// ---------------------------------------------------------------------------
const shopId = (await call("GET", "/api/platform/tenants", { cookie: platformCookie })).json.find((t) => t.slug === slug).id;
await call("PATCH", `/api/platform/tenants/${shopId}/license`, { cookie: platformCookie, body: { status: "suspended", trialEndsAt: null, paidUntil: null } });
const suspendedBooking = await call("POST", `/api/t/${slug}/bookings`, { body: customerBody("Late Customer", { serviceId: SERVICE_CLASSIC, date: MONDAY, time: "12:00" }) });
log("platform", "suspending the shop stops new bookings", suspendedBooking.status === 403, suspendedBooking.json?.error);
const ownerView = await call("GET", `/api/t/${slug}/owner/session`, { cookie: ownerCookie });
log(OWNER, "still sees the suspension and can sign in", ownerView.status === 200 && ownerView.json.license.state === "suspended");
await call("PATCH", `/api/platform/tenants/${shopId}/license`, { cookie: platformCookie, body: { status: "active", trialEndsAt: null, paidUntil: null } });
const reopened = await call("GET", `/api/t/${slug}/availability?serviceId=${SERVICE_CLASSIC}&date=${MONDAY}`);
log("platform", "reactivating the shop reopens bookings", reopened.status === 200 && reopened.json.times.length > 0);

// ---------------------------------------------------------------------------
// Summary.
// ---------------------------------------------------------------------------
const byAgent = {};
for (const r of results) {
  byAgent[r.agent] ??= { pass: 0, fail: 0 };
  byAgent[r.agent][r.ok ? "pass" : "fail"] += 1;
}
console.log("\nAgent summary");
console.table(byAgent);
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length} of ${results.length} checks passed (shop: ${slug})`);
process.exitCode = failed.length ? 1 : 0;
