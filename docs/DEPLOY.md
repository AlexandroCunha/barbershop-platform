# Deploying Barbearia

This guide covers a single production server. Read the scaling notes at the end before running more than one instance.

## What you need

- Node.js 22 and PostgreSQL 17.
- A domain name with HTTPS. Session cookies are marked `Secure` in production, so the site does not work over plain HTTP.
- A reverse proxy in front of the app (for example Caddy or nginx) that handles HTTPS.

## Configuration

Set these variables in the server's environment, or in a `.env` file that only the server can read. Never commit real values.

| Variable | Required | Notes |
| --- | :---: | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. |
| `SESSION_SECRET` | yes | At least 32 characters. Generate with `openssl rand -hex 32`. Changing it signs everyone out. |
| `PLATFORM_ADMIN_TOKEN` | for `/platform` | At least 24 characters. Generate with `openssl rand -hex 24`. |
| `NODE_ENV` | yes | Set to `production`. This turns on secure cookies by default. |
| `PORT` | no | Defaults to `3100`. Bind it to `127.0.0.1` so only the proxy can reach it. |
| `TRUST_PROXY` | see below | The number of reverse proxies in front of the app. |
| `COOKIE_SECURE` | no | Defaults to `true` in production. |
| `BOOKING_RATE_LIMIT` | no | Booking requests per address in 10 minutes. Defaults to `30`. |

### `TRUST_PROXY`: read this before you set it

The app uses the client address for its rate limits (sign-in and booking). When a proxy sits in front of the app, the real address arrives in the `X-Forwarded-For` header, and the app reads it from there.

- **With a proxy in front:** set `TRUST_PROXY=1`. The proxy appends the real client address to the header, and the app reads the entry it added.
- **Without a proxy:** leave `TRUST_PROXY` unset. The app then uses the socket address only.
- **Never set it without a proxy.** Any client can send an `X-Forwarded-For` header with any address, so the rate limits can be bypassed.
- **The proxy must be the only way in.** Bind the app to `127.0.0.1` and block the app's port at the firewall. If a client can reach the app directly while `TRUST_PROXY=1`, it can forge its address.
- `TRUST_PROXY=true` is refused on purpose. Use the number.

Example nginx location block for a single proxy:

```nginx
location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Caddy appends to `X-Forwarded-For` by default, so `reverse_proxy 127.0.0.1:3100` needs no extra header rule.

## First deployment

```bash
npm ci
npm run build
npm run db:migrate
npm start
```

Run the app under a process manager (systemd, or pm2) so it restarts after a crash or reboot. Migrations are applied once each and recorded in `schema_migrations`, so running `npm run db:migrate` again is safe.

Then open `https://your-domain/platform`, sign in with `PLATFORM_ADMIN_TOKEN`, and create the first barbershop.

## Upgrades

1. Back up the database and the `media/` folder.
2. Pull the new version, then run `npm ci`, `npm run build` and `npm run db:migrate`.
3. Restart the process.

Sessions issued before an upgrade remain valid until they expire or are revoked.

## Backups

- **Database:** a daily `pg_dump`, kept off the server.
- **Photos:** the `media/` folder. It is not in git and is not in the database, so a database backup alone does not include the photos.

## Scaling

The app runs well as one instance. Two things are local to one process, so running more than one instance needs changes first:

- **Rate limits** are kept in memory. Each instance counts separately, so an attacker can multiply the limit by the number of instances. Store the counters in PostgreSQL (the simplest option, with no new service) or in Redis when traffic grows.
- **Photos** are written to the local `media/` folder. Another instance cannot see them. Move them to S3-compatible object storage. Cloudflare R2 is a good fit because it has no egress fees.

Sessions already live in PostgreSQL, so they work across instances as they are.

## Checklist

- [ ] `NODE_ENV=production`, and the site is served over HTTPS only.
- [ ] `SESSION_SECRET` and `PLATFORM_ADMIN_TOKEN` are long random values, not the examples.
- [ ] `TRUST_PROXY=1` only if the proxy is the only route in, and unset otherwise.
- [ ] The app's port is not reachable from the internet.
- [ ] Database and `media/` backups run and have been restored at least once.
- [ ] `npm audit --omit=dev` reports no vulnerabilities.
