# Deploying Barbearia

This guide covers production. One server runs fine on the defaults. To run several servers behind a load balancer, follow the [scaling](#scaling) section.

## What you need

- Node.js 22 and PostgreSQL 17.
- A domain name with HTTPS. Session cookies are marked `Secure` in production, so the site does not work over plain HTTP.
- A reverse proxy in front of the app (for example Caddy or nginx) that handles HTTPS.
- For several servers, an S3-compatible bucket for photos. Cloudflare R2 is a good fit because it has no egress fees.

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
| `MEDIA_STORAGE` | no | `local` (default) keeps photos on this server's disk. `s3` stores them in a bucket. |
| `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | when `MEDIA_STORAGE=s3` | Bucket and credentials. The app refuses to start if one is missing. |
| `S3_REGION` | no | Defaults to `auto`, which is what R2 expects. |

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

## Render and Neon

This is the setup used for online tests. The app runs on Render, and the database is PostgreSQL 17 on Neon. The repository includes `render.yaml`, a Render blueprint with the build, the start command (migrations, then the app), the health check and the environment variables.

### 1. Database (Neon)

1. Create a project in Neon with PostgreSQL 17, in the region closest to the app (for example `aws-eu-west-2` for Frankfurt or London).
2. Copy the connection string from the Neon console. Use `sslmode=verify-full` in it, so the driver stays on the strict SSL mode.
3. Leave the `neondb` database as it is. The migrations create the tables on first start.

### 2. Application (Render)

1. In Render, choose **New > Blueprint** and select the repository `AlexandroCunha/barbearia`.
2. Render reads `render.yaml` and asks for three values, which are not stored in git:
   - `DATABASE_URL`: the Neon connection string from step 1.
   - `SESSION_SECRET`: generate with `openssl rand -hex 32`.
   - `PLATFORM_ADMIN_TOKEN`: generate with `openssl rand -hex 24`.
3. Apply the blueprint. The first deploy runs the migrations and then starts the app.
4. Open `https://<your-service>.onrender.com/platform`, sign in with `PLATFORM_ADMIN_TOKEN`, and create the first barbershop.

### Limits of the free plan

- **Photos are lost on every deploy and restart.** The free plan has no disk that persists. For tests that need photos to last, set `MEDIA_STORAGE=s3` with an R2 bucket (see [Cloudflare R2](#cloudflare-r2)).
- **Memory is 512 MB.** Each password check uses about 128 MB, so several sign-ins at the same moment can exhaust it. If that happens, move the service to a paid instance.
- **The service sleeps after 15 minutes without traffic**, and the first request after that is slow.
- **Migrations run on every start.** They are safe to repeat, but with several instances they could race. Keep one instance until you add a pre-deploy step.

## Upgrades

1. Back up the database and the photos (see [Backups](#backups)).
2. Pull the new version, then run `npm ci`, `npm run build` and `npm run db:migrate`.
3. Restart the process. With several servers, restart them one at a time so the site stays up.

Sessions issued before an upgrade remain valid until they expire or are revoked.

## Backups

- **Database:** a daily `pg_dump`, kept off the server.
- **Photos:** with `MEDIA_STORAGE=local`, the `media/` folder. With `s3`, enable versioning or a lifecycle rule on the bucket. Photos are not in the database, so a database backup alone does not include them.

## Scaling

Running several servers is supported. The pieces that used to live in one process are now shared:

| Part | Where it lives | Shared across servers? |
| --- | --- | --- |
| Sessions | PostgreSQL (`sessions`) | Yes |
| Rate limits | PostgreSQL (`rate_limits`) | Yes. One counter per address and limit, so a limit holds however many servers there are. |
| Photos | `local` disk or S3-compatible bucket | Only with `MEDIA_STORAGE=s3` |

### Steps to run several servers

1. **Put the photos in a bucket.** Set `MEDIA_STORAGE=s3` and the `S3_*` variables on every server. Existing photos in `media/` are not copied automatically: move them into the bucket under `<shop>/<file name>` before switching.
2. **Check that the bucket refuses duplicate names.** The app relies on a conditional write so two servers cannot overwrite the same photo. Upload a photo named `test.jpg` to a test shop, then upload it again. The second upload must be saved as `test-2.jpg`. If it comes back as `test.jpg`, the provider does not support conditional writes, and you should not run several servers against it.
3. **Put a load balancer in front.** Each server gets its own copy of the app with the same environment. Keep `TRUST_PROXY` set to the number of proxies in front of the app, counting the load balancer.
4. **Put a CDN in front of `/media`.** Photo responses carry `Cache-Control: public, max-age=31536000, immutable`, and a photo name is never reused, so a CDN can keep them for good. This removes most photo traffic from the servers.

### Cloudflare R2

1. Create a bucket in R2.
2. Create an API token with read and write access to that bucket only.
3. Set `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_BUCKET` to the bucket name, and the token's key pair as `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. Leave `S3_REGION` at `auto`.
4. Run the duplicate-name check from step 2 above.

## Checklist

- [ ] `NODE_ENV=production`, and the site is served over HTTPS only.
- [ ] `SESSION_SECRET` and `PLATFORM_ADMIN_TOKEN` are long random values, not the examples.
- [ ] `TRUST_PROXY=1` only if the proxy is the only route in, and unset otherwise.
- [ ] The app's port is not reachable from the internet.
- [ ] With several servers: `MEDIA_STORAGE=s3`, and the duplicate-name check passed.
- [ ] Database and photo backups run and have been restored at least once.
- [ ] `npm audit --omit=dev` reports no vulnerabilities.
