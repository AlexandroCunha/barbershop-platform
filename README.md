# Barbearia

A barbershop website with online booking. It includes services, barbers, opening
hours, a contact section, and an owner area where the owner keeps the business
details and photos up to date. No code changes are needed to customise it.

- **Front end:** React, TypeScript, Vite.
- **API:** Node.js 22, Express 5, TypeScript.
- **Database:** PostgreSQL 17.

## For the owner

Everything is changed from the owner area at `/admin`. Sign in with the access
token that the person who installed the site gives you.

| Tab | What it does |
| --- | --- |
| **Business** | Name, slogan, about text, phone, WhatsApp, email, address, directions link, Instagram, opening hours, hero photo, time zone and currency. |
| **Photos** | Upload photos. They are stored in the `media/` folder. |
| **Barbers** | Name, specialties, biography and portrait of each barber. |
| **Services** | Name, description, price and duration of each service. |

Bookings are offered only inside the opening hours set in **Business**.

### Photos

The `media/` folder is where photos live. Put a photo there, or upload it in
**Photos**, then pick it in **Business → Hero photo** or **Barbers → Portrait**.

- Formats: JPG, PNG or WebP, up to 8 MB.
- Names: letters, numbers, dashes and spaces, for example `hero-shot.jpg`.
- Uploads get a simple name automatically. If the name is taken, `-2` is added.

## Running it

Requirements: Node.js 22 and Docker (or any PostgreSQL 17 server).

```bash
npm install
docker compose up -d                         # PostgreSQL on port 5434
cp .env.example .env                         # then set DATABASE_URL and ADMIN_TOKEN
npm run db:migrate
npm run build
npm start                                    # http://localhost:3100
```

Generate the owner's access token with `openssl rand -hex 32` and put it in
`ADMIN_TOKEN` in `.env`. It must be at least 24 characters. The owner area stays
closed while it is empty.

For development, run `npm run dev:api` and `npm run dev:web` in two terminals.

Run the tests with `npm test`, and the type checks with `npm run typecheck`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `PORT` | Port for the site and API. Defaults to 3100. |
| `ADMIN_TOKEN` | Owner access token. At least 24 characters. |
| `COOKIE_SECURE` | Send the owner's session cookie only over HTTPS. Defaults to `true` in production. |
| `TRUST_PROXY` | Set to `true` behind a reverse proxy that sets `X-Forwarded-For`. |

## Security

- The owner signs in with the access token. The server then issues a session in an
  `HttpOnly`, `SameSite=Strict` cookie that lasts 8 hours. The token is never stored
  in the browser.
- Changing `ADMIN_TOKEN` signs every owner out at once.
- Sign-in attempts are limited to 10 per 15 minutes per address. Bookings are limited
  to 30 per 10 minutes per address.
- Uploaded files are checked against their image signature, renamed on arrival, and
  never overwrite an existing photo.
- Pages are served with a Content Security Policy and related security headers.
- The site stores customers' names, emails and phone numbers for bookings. Before
  going live, publish a privacy notice that covers them.

## Before going live

- Serve the site over HTTPS, and set `NODE_ENV=production`.
- Use a long, random `ADMIN_TOKEN`, and keep `.env` out of version control.
- Back up the database, `content/business.json` and `media/`.
- Replace the starting barbers and services with the real ones from `/admin`.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | API: routes, controllers, booking rules, owner auth, media, database access. |
| `client/src/` | Website and owner area (React). |
| `db/migrations/` | Database schema. Each file runs once, in name order. |
| `content/business.example.json` | Template for the business profile. |
| `content/business.json` | The business profile. Created on first start, kept out of git. |
| `media/` | Photos. Kept out of git except for its instructions. |
| `.github/workflows/ci.yml` | Builds and tests every push and pull request. |
