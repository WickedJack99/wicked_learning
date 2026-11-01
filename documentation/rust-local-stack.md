# Rust/Axum local foundation

This is a greenfield proof-of-concept stack. It does not replace, route traffic
to, import data from, or otherwise alter the existing Laravel application.

The separate [`compose.rust.yaml`](../compose.rust.yaml) leaves the current
Laravel [`compose.yaml`](../compose.yaml) untouched. It starts four services:

| Service | Responsibility | Publicly reachable |
| --- | --- | --- |
| `frontend` | React static files and same-origin `/api` reverse proxy | Yes, port 8081 by default |
| `backend` | Rust/Axum API | No |
| `application-db` | Greenfield application data only | No |
| `identity-db` | Greenfield credentials and identity data only | No |

The backend has one mounted named volume, `wicked_media`, at
`/var/lib/wicked-learning/media`. It is the initial media store; object storage
is a future adapter-backed feature. The database services have separate named
volumes and credentials. They are separate PostgreSQL databases, not separate
schemas inside one database.

## Start locally

1. Copy `.env.rust.example` to `.env.rust` and replace both database passwords
   before using any shared environment. The committed defaults are deliberately
   local-development-only values.
2. Start the two database services:

   ```bash
   docker compose --env-file .env.rust -f compose.rust.yaml up -d application-db identity-db
   ```

3. Run the forward-only migrations once. This is deliberately a one-off action,
   rather than something every API replica runs at startup:

   ```bash
   docker compose --env-file .env.rust -f compose.rust.yaml run --rm backend migrate
   ```

   This applies the two Rust-owned migration sets and provisions the maintained
   session library's `tower_sessions.session` table in the identity database.
   It never imports, reads, or modifies the Laravel database.

4. Start the frontend and API:

   ```bash
   docker compose --env-file .env.rust -f compose.rust.yaml up --build frontend backend
   ```

Open `http://localhost:8081`. The React foundation requests
`/api/v1/health/ready` at the same public origin. The endpoint is ready only
when both PostgreSQL databases are reachable.

## Coolify-shaped deployment

The Compose file is structured for a later isolated Coolify application: select
`frontend` as the public service (port 80), keep `backend`, `application-db`
and `identity-db` private, and retain the three named volumes. Run the same
`backend migrate` command as a one-off release step before releasing a backend
that needs a new schema.

Do not copy the example password values to a shared environment, attach an
existing Laravel volume/database, or deploy this proof of concept to production.
No production deployment is authorized by this document.

## Continuous verification

The `Rust replatform foundation` GitHub Actions workflow checks changes to the
Rust, contract, frontend and Compose files. It runs Rust formatting and tests,
detects generated TypeScript-client drift, builds the standalone frontend and
validates the Compose definition. It does not deploy the stack or change the
Laravel workflows.
