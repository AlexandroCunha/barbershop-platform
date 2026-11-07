# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.
Use GitHub's private reporting: **Security → Report a vulnerability** on this repository.

Include what you found, how to reproduce it and the impact if you can. You will get an answer as
soon as the maintainer can read it, and a fix is published before details are shared.

## Supported version

Only the latest version on the default branch receives security fixes.

## Practices in this project

- **Passwords:** scrypt at the OWASP minimum cost, with a decoy hash so response time never reveals which e-mails exist.
- **Sessions:** signed tokens, stored server-side, in `HttpOnly` + `SameSite=Strict` (+ `Secure` on HTTPS) cookies scoped to one shop's path.
- **Abuse limits:** per-address limits on sign-in, booking, password reset and booking management, shared by every instance through PostgreSQL.
- **Headers:** strict CSP with no third-party hosts, HSTS on HTTPS, `nosniff`, no framing, cross-origin isolation, minimal permissions.
- **Input:** validated on the server; request bodies are size-limited; database access uses parameterised queries.
- **Privacy (GDPR):** no third-party scripts, fonts or analytics; customer details are anonymised after `BOOKING_RETENTION_MONTHS` (default 24); sent messages lose their address and text.
- **Secrets:** never in the repository. `.env` is ignored and `render.yaml` marks secrets `sync: false`.
- **Supply chain:** Dependabot and `npm audit` run on every push and pull request.
- **Tests:** unit tests run in CI on every push and pull request.

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the checklist to run before going live.
