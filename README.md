<div align="center">

<img src="docs/banner.svg" alt="Barbearia: online booking for barbershops, made simple" width="100%">

**Online booking for barbershops, made simple.** Every shop gets its own address, a beautiful website,
a booking calendar and an owner area. One installation serves many shops.

[![CI](https://github.com/AlexandroCunha/barbearia/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexandroCunha/barbearia/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/license-proprietary-171717)

<br>

[![Screens](https://img.shields.io/badge/Screens-%E2%86%92-B77951?style=for-the-badge&labelColor=171717)](#-take-a-look)
[![Features](https://img.shields.io/badge/Features-%E2%86%92-41483A?style=for-the-badge&labelColor=171717)](#-what-you-get)
[![Quick start](https://img.shields.io/badge/Quick_start-%E2%86%92-8A5A3B?style=for-the-badge&labelColor=171717)](#-quick-start)
[![How it works](https://img.shields.io/badge/How_it_works-%E2%86%92-B77951?style=for-the-badge&labelColor=171717)](#-how-it-works)
[![Testing](https://img.shields.io/badge/Testing-%E2%86%92-41483A?style=for-the-badge&labelColor=171717)](#-testing--ci)

**🇬🇧 English** · [🇧🇷 Português](README.pt-BR.md)

</div>

> 🧪 All names, prices, addresses and phone numbers in the screenshots are invented for the demo.

---

## 👀 Take a look

<p align="center">
  <img src="docs/carousel.svg" alt="Screenshot carousel: the website, booking, the owner area and the platform area, shown in turn" width="100%">
</p>

---

## ✨ What you get

<table>
  <tr>
    <td valign="top" width="33%">

### 💈 Customers
- Pick a service, a day and a time
- Choose a barber, or let us find the first free one
- A live summary with price and duration
- Smooth on phones, with the booking button always in reach

</td>
    <td valign="top" width="33%">

### 🧑‍💼 Owners
- Business profile: name, slogan, contacts, address, hours
- Upload photos and pick a hero image and barber portraits
- Add, rename, reprice and remove barbers and services
- Change your password; other devices sign out
- See at a glance whether online booking is open

</td>
    <td valign="top" width="33%">

### 🏢 Platform owner
- Create a barbershop in one form (14-day trial included)
- Set each shop's license: trial, active or suspended
- Set trial end and paid-until dates

</td>
  </tr>
</table>

<p align="center">
  <sub>🎨 Same palette as the website:</sub><br>
  <img src="https://img.shields.io/badge/paper-F3F0E9-F3F0E9?style=flat-square" alt="Paper F3F0E9">
  <img src="https://img.shields.io/badge/copper-B77951-B77951?style=flat-square" alt="Copper B77951">
  <img src="https://img.shields.io/badge/olive-41483A-41483A?style=flat-square" alt="Olive 41483A">
  <img src="https://img.shields.io/badge/charcoal-171717-171717?style=flat-square" alt="Charcoal 171717">
</p>

---

## 🚀 Quick start

You need **Node.js 22** and **Docker** (or any PostgreSQL 17 server).

```bash
npm install
docker compose up -d            # PostgreSQL on port 5434
cp .env.example .env            # then fill in the two secrets below
npm run db:migrate
npm run build
npm start                       # http://localhost:3100
```

Create the two secrets:

```bash
openssl rand -hex 32            # SESSION_SECRET
openssl rand -hex 24            # PLATFORM_ADMIN_TOKEN
```

Then open **`http://localhost:3100/platform`**, sign in with `PLATFORM_ADMIN_TOKEN`, and add your first
barbershop. Its website lives at `/<address>` and its owner area at `/<address>/admin`. 🎉

> 💡 For development, run `npm run dev:api` and `npm run dev:web` in two terminals.

| Command | What it does |
| --- | --- |
| `npm test` | Builds the server and runs the unit tests |
| `npm run simulate` | Runs an end-to-end simulation with ten agents (see [Testing](#-testing--ci)) |
| `npm run typecheck` | Type-checks the server and the website |
| `npm run build` | Builds the server and the website |

---

## 🧭 How it works

Each barbershop is a **tenant** with its own address (`/northgate`). Its services, barbers,
bookings, owner accounts and photos never mix with another shop's data.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#fbfaf7", "primaryTextColor": "#171717", "primaryBorderColor": "#b77951", "lineColor": "#41483a", "secondaryColor": "#ebe6dc", "tertiaryColor": "#f3f0e9", "clusterBkg": "#ebe6dc", "clusterBorder": "#b77951", "fontFamily": "Inter, system-ui, sans-serif"}}}%%
flowchart LR
  classDef client fill:#b77951,stroke:#8a5a3b,color:#fbfaf7
  classDef server fill:#41483a,stroke:#171717,color:#f3f0e9
  classDef data fill:#171717,stroke:#171717,color:#f3f0e9

  subgraph Browser
    Site["🌐 Customer website<br/>/:shop"]
    Owner["🧑‍💼 Owner area<br/>/:shop/admin"]
    Platform["🏢 Platform area<br/>/platform"]
  end

  Browser -->|HTTPS| API

  subgraph Server["Node.js 22 · Express 5"]
    API["/api routes"]
    MW["Middlewares<br/>shop lookup · sessions · rate limits · headers"]
    CTRL["Controllers<br/>HTTP in and out"]
    SVC["Services<br/>booking rules · license checks · account rules"]
    REPO["Repositories<br/>SQL, always filtered by tenant"]
    DOM["Domain<br/>availability · opening hours · license states · validation"]
    API --> MW --> CTRL --> SVC --> REPO
    SVC --> DOM
  end

  REPO --> DB[("PostgreSQL 17")]
  Server -->|serves| Dist["Built React app<br/>dist-client/"]
  Server -->|serves| Media["media/&lt;shop&gt;/<br/>one folder per shop"]

  class Site,Owner,Platform client
  class API,MW,CTRL,SVC,REPO,DOM server
  class DB data
  style Browser fill:#f3f0e9,stroke:#b77951
  style Server fill:#ebe6dc,stroke:#41483a
```

**In short:** routes wire URLs to handlers, middlewares check who you are, controllers translate HTTP,
services hold the rules, and repositories are the only code that talks SQL. Every query filters by
`tenant_id`, so one shop can never see another's data.

### 🗂️ Data model

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#fbfaf7", "primaryTextColor": "#171717", "primaryBorderColor": "#b77951", "lineColor": "#41483a", "attributeBackgroundColorOdd": "#fbfaf7", "attributeBackgroundColorEven": "#ebe6dc", "fontFamily": "Inter, system-ui, sans-serif"}}}%%
erDiagram
  TENANTS ||--o{ TENANT_OWNERS : has
  TENANTS ||--o{ SERVICES : offers
  TENANTS ||--o{ PROFESSIONALS : employs
  TENANTS ||--o{ BOOKINGS : receives
  SERVICES ||--o{ BOOKINGS : "booked as"
  PROFESSIONALS ||--o{ BOOKINGS : "performed by"

  TENANTS {
    int id
    text slug
    jsonb business
    text license_status
    timestamptz trial_ends_at
    timestamptz paid_until
  }
  TENANT_OWNERS {
    int id
    int tenant_id
    text email
    text password_hash
    int session_version
  }
```

### 📅 A booking, step by step

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#41483a", "primaryTextColor": "#f3f0e9", "primaryBorderColor": "#171717", "actorBkg": "#41483a", "actorBorder": "#171717", "actorTextColor": "#f3f0e9", "signalColor": "#b77951", "signalTextColor": "#171717", "noteBkgColor": "#ebe6dc", "noteBorderColor": "#b77951", "noteTextColor": "#171717", "activationBkgColor": "#ebe6dc", "activationBorderColor": "#b77951", "fontFamily": "Inter, system-ui, sans-serif"}}}%%
sequenceDiagram
  participant C as Customer
  participant A as API
  participant S as BookingService
  participant L as License check
  participant R as Repositories
  C->>A: POST /api/t/northgate/bookings
  A->>A: loadTenant (slug) · rate limit
  A->>S: book(tenant, request)
  S->>L: is online booking allowed?
  L-->>S: trial / active (or 403)
  S->>R: free slots for each barber (opening hours, existing bookings)
  S->>R: create booking (the database rejects overlapping times for one barber)
  R-->>S: booking, or 409 if someone was faster
  S-->>A: booking
  A-->>C: 201 with date, time and reference
```

### 🎟️ Licenses

A shop's license decides whether customers can book. The owner area always stays open, so the owner
can see the reason and fix it.

| Status set by the platform owner | Customers can book? | What the owner sees |
| --- | :---: | --- |
| `trial`, before the trial ends | ✅ | "Free trial: online booking is open until …" |
| `active`, paid until a future date, or with no end date | ✅ | "Subscription active …" |
| `trial` or `active` whose period has ended | ⛔ | "Online booking is paused because the subscription has ended." |
| `suspended` | ⛔ | "Online booking is paused for this account." |

### 🔐 Security

- 🍪 **Sessions** are signed tokens (HMAC-SHA256) in `HttpOnly`, `SameSite=Strict` cookies, valid for 8 hours. The browser never keeps a reusable token.
- 🔑 **Passwords** are hashed with scrypt and a per-password salt. Unknown emails take as long to reject as real ones, so timing reveals nothing.
- 🚪 **Password changes** sign out every other session.
- 🚦 **Rate limits:** sign-in (10 attempts per 15 minutes) and booking (30 per 10 minutes), per address.
- 🖼️ **Uploads** are checked against the image's signature bytes, renamed on arrival, and never overwrite a photo. JPG, PNG and WebP only, up to 8 MB.
- 🛡️ **Headers:** Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS when cookies are secure.
- ✅ **Inputs** are validated on every endpoint, and SQL is always parameterised.

---

## 🗺️ Project layout

```
src/
  app.ts, server.ts         wiring: Express app and process start
  routes/                   URL → handler map, shop and platform sections
  middlewares/              shop lookup, owner and platform sessions, rate limits, headers
  controllers/              HTTP handlers (request → service → response)
  services/                 booking rules, account rules, owner content rules
  domain/                   pure logic: availability, opening hours, license states, slugs, defaults
  repositories/             SQL, one file per table, always tenant-scoped
  auth/                     tokens, password hashing, session names
  validations/              input checks for every endpoint
  media/                    per-shop photo storage
  test/                     unit tests (node:test)
client/src/
  pages/                    shop site, shop routing, platform area, landing and not-found
  components/               website sections (hero, barbers, services, booking, visit, footer)
  admin/                    owner area: business, photos, barbers, services, account
db/migrations/              schema, applied once each and recorded in schema_migrations
scripts/                    end-to-end simulation
docs/                       banner, screenshots and legal templates
media/<shop>/               each shop's photos (not committed)
```

---

## ⚙️ Configuration

| Variable | Required | What it does |
| --- | :---: | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ (32+ chars) | Signs owner and platform sessions. Changing it signs everyone out |
| `PLATFORM_ADMIN_TOKEN` | for `/platform` (24+ chars) | The platform owner's sign-in token |
| `PORT` | | Port for the site and API. Default `3100` |
| `COOKIE_SECURE` | | Send cookies only over HTTPS. On by default in production |
| `TRUST_PROXY` | | Set to `true` behind a reverse proxy that sets `X-Forwarded-For` |
| `BOOKING_RATE_LIMIT` | | Booking requests allowed per address in 10 minutes. Default `30` |

---

## 🧪 Testing & CI

- ✅ **`npm test`**: 53 unit tests covering availability, cross-shop booking rules, license states,
  password hashing, signed tokens, rate limits, uploads, slugs and input validation.
- 🤖 **`npm run simulate`**: an end-to-end run with ten agents (one owner, three new barbers, six
  customers) hitting the same slot at the same time, removing items, trying overlaps, suspending a
  shop and changing passwords. Start the server with a higher limit first:
  `BOOKING_RATE_LIMIT=500 npm start`. It also needs `psql` on the PATH, or `PSQL` set to its path.
- 🔁 **GitHub Actions** builds and tests every push and pull request.

---

## 💼 Business model and licensing

Barbershops pay a **subscription** to use the hosted service. The code stays with its owner, and
customers receive a license to use the service, not the software.

| Model | Who runs it | Fit for this product |
| --- | --- | --- |
| ☁️ **Hosted subscription (SaaS)**, one install for many shops | You | **Recommended.** Recurring revenue, one place to update. Implemented: multi-tenancy, trials, license states, platform area. |
| 🏠 **Self-hosted license** (license key or annual fee) | The customer | Possible later for shops that want their own server. Not implemented. |
| 🌍 **Open source** with a paid add-on | Anyone | Not recommended if the goal is to sell this product. |

The project is **proprietary**. [`LICENSE`](LICENSE) explains who owns the code and what customers may
and may not do. The customer agreement and privacy policy are in
[`docs/legal/terms-of-service.md`](docs/legal/terms-of-service.md) and
[`docs/legal/privacy-policy.md`](docs/legal/privacy-policy.md). They are templates, so have a lawyer
adapt them before you sell.

---

## 🛣️ Roadmap

- 💳 Payments, with licenses that update automatically
- 🌐 A custom domain for each barbershop
- 📧 E-mail confirmations and reminders
- 📋 A bookings list and cancellations for the owner
- 👥 Several owner accounts per shop

---

## 👨‍💻 About the author

Hi, I'm **Alexandro Cunha** ([@AlexandroCunha](https://github.com/AlexandroCunha)). I work on
back-end development, mainly with Node.js, TypeScript and PostgreSQL. I'm the author of **Financify**, a
personal finance REST API built with Express 5, PostgreSQL and JWT, and of this project, which I built
from scratch to show how a booking system can serve many barbershops with licenses, security and a
simple owner area.

In this project I designed the multi-tenant model, the booking and license rules, the authentication and
the user interface. Want to talk about the system, back-end work, or bringing this product to barbershops?
Reach out on GitHub. 👋

[Complete with your education, experience and contact details.]

---

<div align="center">

<img src="https://img.shields.io/badge/-%20-B77951?style=flat-square"><img src="https://img.shields.io/badge/-%20-41483A?style=flat-square"><img src="https://img.shields.io/badge/-%20-171717?style=flat-square">

Made with ☕ and a lot of careful testing · [🇧🇷 Leia em português](README.pt-BR.md)

</div>
