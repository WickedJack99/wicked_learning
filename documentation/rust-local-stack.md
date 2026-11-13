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

The local backend sets `SESSION_COOKIE_SECURE=false` only because this stack is
served at `http://localhost`. The Rust default is secure cookies; leave that
default enabled for any HTTPS environment.

## Start locally

1. Copy `.env.rust.example` to `.env.rust` and replace both database passwords,
   the CSRF cookie key and the TOTP encryption key before using any shared
   environment. `TOTP_ENCRYPTION_KEY` is a Base64-encoded 32-byte key that must
   be retained for the life of enrolled TOTP factors; changing it makes those
   factors unreadable. The committed defaults are deliberately
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

`GET /api/v1/security/csrf` issues a non-cacheable CSRF token and matching
encrypted, HTTP-only cookie for the future unsafe browser endpoints. This is a
foundation endpoint. The local proof of concept exposes password
`POST /api/v1/session/login` and `POST /api/v1/session/logout`, with a small
React sign-in/sign-out proof: both require the token's `X-CSRF-Token` header
and the configured `PUBLIC_ORIGIN`. Login accepts only active, email-verified
Rust identities and shares a small client-IP rate-limit burst with invitation
registration. The API can privately start and confirm an authenticated TOTP
enrollment, retaining only encrypted secrets and Argon2id recovery-code
verifiers, but the original React two-factor control remains absent until the
login challenge and complete account-management contract arrive. Verification,
recovery-code use, MFA/passkeys, audit records and the full authorization
matrix remain separate required work; this is not a user cutover.

The local HTTP stack intentionally does not mark session or CSRF cookies
`Secure`; an HTTPS deployment does. Set `PUBLIC_ORIGIN` to the exact browser
origin for every non-local deployment.

## Browser acceptance checks

With the stack running, install the Chromium test browser once and run the
standalone frontend's browser checks:

```bash
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

The tests visit the actual local Compose stack. They cover root, place and route
deep-links; public information; public exploration/search/place and route
outlines; the unavailable API state; unknown browser routes; public
JSON/problem contracts; and the safe anonymous session shape. When a disposable
bootstrap administrator is provided, they also cover the Rust-owned React
sign-in/sign-out proof. They do not use, start, or alter the Laravel stack.

Credentialed browser checks bootstrap one real same-origin CSRF/session login
per Playwright run. Their opted-in fixture keeps each test anonymous until its
source-derived login form submits, then installs an isolated copy of that
server-issued local session instead of repeatedly spending the production-like
per-client login-rate-limit burst. The dedicated session and invalid-credential
contract checks still call the live login endpoint. The transient state lives
only under ignored frontend/test-results; no credentials or session material
are committed.

## Fresh administrator bootstrap

After migrations, create the first administrator with the backend's explicit
one-time command. It needs two values that must not be committed: the intended
administrator email and a local file containing the password. The password is
read from the file so it is not exposed in a shell command or an environment
variable.

```bash
docker compose --env-file .env.rust -f compose.rust.yaml run --rm --user 0:0 \
  --volume /absolute/path/to/admin-password:/run/secrets/bootstrap-admin-password:ro \
  --env BOOTSTRAP_ADMIN_EMAIL='admin@example.test' \
  --env BOOTSTRAP_ADMIN_PASSWORD_FILE='/run/secrets/bootstrap-admin-password' \
  backend bootstrap-admin
```

The command validates and normalizes the email, creates a verified Rust-owned
identity with an Argon2id password verifier, creates the separate application
principal, and grants that principal the `platform_administrator` role. It is
safe to re-run to repair the application-principal/role mapping; it never
replaces the password of an existing identity.

### Persistent disposable browser-test administrator

The local Compose development/test stack has a disposable administrator for
credentialed browser evidence: `e2e-admin@wicked-learning.local`. Its password
is deliberately not committed or repeated in documentation; it is stored mode
`0600` at `/home/student/.config/wicked-learning/e2e-admin-password`. Future
Codex sessions may read that local file only to supply `E2E_LOGIN_PASSWORD`
while running tests, alongside `E2E_LOGIN_EMAIL=e2e-admin@wicked-learning.local`.
This account belongs only to the local Compose databases and must never be used
against production or copied to a shared deployment.

A separate persistent local learner,
`e2e-learner@wicked-learning.local`, is available for manual collaboration
checks. Its password is likewise deliberately not
committed; it is stored mode `0600` at
`/home/student/.config/wicked-learning/e2e-learner-password`. Future Codex
sessions may read that file only to supply `E2E_SECOND_LOGIN_PASSWORD` alongside
`E2E_SECOND_LOGIN_EMAIL=e2e-learner@wicked-learning.local` for manual local
collaboration checks. This account belongs only to the local Compose databases
and must never be used against production or copied to a shared deployment.

When `E2E_LOGIN_EMAIL` and `E2E_LOGIN_PASSWORD` are set, the browser suite
instead creates two fresh invitation-registered learners during global setup
and keeps only their short-lived authenticated session state under ignored
`frontend/test-results`. This keeps durable learner workflow evidence isolated
without placing more passwords or credentials in the repository.

## Local invitation registration

The lifted `/register` page requires a one-use invitation. Issue one to a
private temporary file in the running backend, then copy that file to a
private local path. The command writes the plaintext token only to its newly
created output file (mode `0600` on Linux) and stores only its SHA-256 hash in
the identity database. It never prints the token.

```bash
docker compose --env-file .env.rust -f compose.rust.yaml exec -T \
  -e REGISTRATION_TOKEN_OUTPUT_FILE='/tmp/registration-token' \
  backend wicked-learning-api issue-registration-token
docker compose --env-file .env.rust -f compose.rust.yaml cp \
  backend:/tmp/registration-token ./registration-token
```

Use the token from that file in the local registration screen, then delete the
local and container copies yourself when they are no longer needed. To record
a non-secret operator note, add `-e REGISTRATION_TOKEN_NOTE='purpose'` to the
`docker compose exec` command. The source-adapted Users workspace owns expiry
selection, hierarchy-checked role grants, token listing and revocation. The CLI
remains a private local operator/bootstrap path rather than a replacement for
that administrator workflow.

## Coolify-shaped deployment

The Compose file is structured for a later isolated Coolify application: select
`frontend` as the public service (port 80), keep `backend`, `application-db`
and `identity-db` private, and retain the three named volumes. Run the same
`backend migrate` command as a one-off release step before releasing a backend
that needs a new schema. Schedule the following private backend command at
least monthly (and it is safe to run more often) to rotate due random-governance
organization leaders without making a learner's browser read mutate state:

```bash
docker compose --env-file .env.rust -f compose.rust.yaml exec -T backend \
  wicked-learning-api rotate-random-organization-leaders
```

The command locks due organizations and is safe for overlapping scheduler
invocations. It returns success when there is nothing to rotate.

If a database interruption leaves an account deprovisioning job pending, run
the following private maintenance command. It is idempotent: it completes the
identity/application deletion sequence or removes a job whose identity has
already been removed. A shared deployment should schedule it as a bounded
worker; it is not a browser-facing endpoint.

```bash
docker compose --env-file .env.rust -f compose.rust.yaml exec -T backend \
  wicked-learning-api reconcile-identity-deletions
```

Do not copy the example password values to a shared environment, attach an
existing Laravel volume/database, or deploy this proof of concept to production.
No production deployment is authorized by this document.

## Continuous verification

The `Rust replatform foundation` GitHub Actions workflow checks changes to the
Rust, contract, frontend and Compose files. It runs Rust formatting and tests,
detects generated TypeScript-client drift, builds the standalone frontend and
validates the Compose definition, starts the isolated four-service stack and
runs the Chromium browser checks against it. It removes the CI-only volumes
afterward. CI creates an ephemeral administrator with a generated job-only
password so that login/session/logout can be verified; it does not deploy the
stack or change the Laravel workflows.
