# Rust/Axum Replatforming Decision Record

## Status

These are the decisions recorded during phase 1 from the source inventory and
[replatforming plan](rust-axum-replatforming-plan.md). They authorize a local,
greenfield proof of concept only. They do not authorize a production deployment
or a change to the current Laravel application's user-facing behavior.

## ADR-001: Initial repository topology

**Status:** Accepted — 1 November 2026

**Decision:** Keep a modular monorepo initially, with `frontend/`, `backend/`,
`contracts/` and `infra/` top-level areas when phase 2 begins.

**Why:** The React client and Rust API will need atomic OpenAPI/client changes,
shared release evidence and one migration runbook. They still build and deploy
independently. Splitting repositories can be reconsidered after contracts and
release ownership stabilize.

**Alternative:** Two repositories immediately. This creates early cross-repo
contract/version coordination before a stable API exists.

## ADR-002: Browser-to-API origin

**Status:** Accepted — 1 November 2026

**Decision:** Serve the independently deployed SPA and API at one public
origin, initially using `/` for React and `/api` for Axum behind a reverse
proxy.

**Why:** Same-origin cookies and requests reduce CORS/CSRF complexity without
coupling deployment artifacts. A separate public API origin can be introduced
later for a demonstrated client/integration need.

**Alternative:** Separate frontend and API origins now. This requires an
approved credentialed-CORS, cookie-domain and CSRF design before the first
authenticated browser slice.

## ADR-003: Identity boundary

**Status:** Accepted — 1 November 2026

**Decision:** The Rust/Axum application owns identity. An external OIDC
provider such as Keycloak may be added later as an optional extension, not as
the initial authentication authority.

Rust ownership does not authorize hand-rolled cryptography, session storage,
password hashing, passkey verification, TOTP or database drivers. Build the
identity flows by composing maintained libraries after a compatibility and
security review:

- `axum-login` for Axum authentication-session integration;
- `tower-sessions` with `tower-sessions-sqlx-store` for server-side PostgreSQL
  sessions;
- RustCrypto `argon2` for Argon2id password hashing and verification;
- `webauthn-rs` for WebAuthn/passkey relying-party ceremonies; and
- a maintained TOTP library such as `totp-rs` for the existing two-factor
  capability, if the proof of concept confirms it covers the required flow.

Pin exact compatible versions only in the identity proof of concept. The
application will still implement its own domain-specific policy and flow
orchestration: registration-token rules, account state, verification and
recovery lifecycle, rate limits, audit records, email integration, and the
mapping from an authenticated subject to Wicked Learning permissions. It must
not implement cryptographic algorithms or generic session/auth frameworks.

**Why:** This keeps identity inside the Rust deployment while using established
security building blocks. It also preserves a future OIDC adapter boundary
without making an identity provider a launch dependency.

**Required proof before cutover:** password login; email verification and
recovery; TOTP enrollment/recovery; passkey registration/authentication;
session rotation/revocation; CSRF/rate-limit/audit behavior; and independent
security review. The new platform starts with fresh credentials and fresh
passkey enrollment; no Laravel password hash, passkey, session or account data
is migrated.

**Future extension:** an OIDC adapter may be added later. It must map a
validated OIDC subject to the same local identity subject and may not bypass
local account, role or map-scope policy.

## ADR-004: PostgreSQL migration posture

**Status:** Accepted in part — 1 November 2026

**Decision:** Use two separate greenfield PostgreSQL databases:

- an **identity database** owns canonical users, verified identifiers,
  password-hash records, passkeys, MFA/recovery factors, sessions, verification
  and reset tokens, login-rate-limit state and identity-security audit records;
- an **application database** owns Wicked Learning content, learner records,
  organizations, permissions, preferences, media metadata and application
  audit data. It stores an opaque identity subject mapping, never credential
  hashes or authentication secrets.

Both may initially run on the same PostgreSQL server, but they are separate
databases with distinct credentials, least-privilege roles, migration history,
backup/restore procedures and connection pools. Separate schemas in one
database do not satisfy this decision.

Define fresh schemas and forward-only Rust migrations for both databases. The
Laravel schema, models and migrations are behavior/domain evidence only; they
are not a persistence compatibility contract and are not replayed or imported.

**Cross-database mapping:** identity issues an immutable opaque UUID subject.
The application database stores that `identity_subject_id` in an application
principal/profile record and eventually in user-owned records. PostgreSQL cannot
enforce foreign keys across databases, so the application validates the
authenticated subject at its API boundary and uses idempotent provisioning plus
reconciliation checks. Registration and deletion flows must use an outbox or
compensating-action design; they cannot rely on a distributed transaction.

**Greenfield bootstrap:** create the initial administrator, access roles and
empty application content through an explicit secure bootstrap procedure. New
identities enroll passwords, MFA and passkeys in the Rust system. Existing
Laravel uploads and records are deliberately out of scope.

**Why:** There is no productive legacy platform to migrate. A clean schema
allows the rework to remove Laravel-only compatibility records and redesign the
application model while preserving the intended learner and author behavior.

## ADR-005: Contract source and compatibility

**Status:** Accepted — 1 November 2026

**Decision:** Use a versioned OpenAPI document under `contracts/openapi/` as
the browser/API boundary. Generate the TypeScript client from it, check
generated artifacts in CI, and version initial endpoints under `/api/v1`.

**Why:** It replaces implicit Inertia props/Wayfinder routes with a reviewable,
testable compatibility boundary and permits independent deploys.

**Alternative:** Hand-written request types or database-shaped endpoints. Both
would make compatibility and authorization review weaker.

## ADR-006: Media storage transition

**Status:** Accepted — 1 November 2026

**Initial decision:** Start with a fresh media store behind a Rust
`MediaStore` adapter. The current public/protected behavior is a requirements
reference only; no objects or paths need to be transferred. Store media in a
mounted backend volume initially.

**Future extension:** Managed object storage remains a later feature. It can
be evaluated when independent backend scaling, durability requirements or media
delivery needs justify its additional operational complexity. The `MediaStore`
adapter prevents storage-provider details from becoming HTTP or domain policy.

**Why:** A local mounted volume is the simplest operational foundation for the
proof of concept while retaining an explicit boundary for a later object-store
adapter.

## ADR-007: Deployment and background work

**Status:** Accepted — 1 November 2026

**Decision:** Build/deploy frontend and API as separate artifacts;
run database migrations as a one-off job; expose health/readiness endpoints;
use the local system for proof-of-concept testing; and keep Laravel production
routing unchanged until a feature-flagged, read-only Rust slice passes parity
checks.

The supplied Compose setup is deployment-shaped for later use in an isolated
environment such as Coolify, but this decision does not authorize deploying it
there yet.

## ADR-008: First vertical slice

**Status:** Accepted — 1 November 2026

**Decision:** Start phase 2 with a no-write Axum foundation and one standalone
React screen backed by a read-only public presentation or authenticated shell
endpoint. Do not start with activity progression, auth cutover, authoring or
media mutations.

**Why:** It validates deployment, observability, contracts and frontend/API
separation without threatening learner state or content integrity.

## ADR-009: Library-first implementation policy

**Status:** Accepted — 1 November 2026

**Decision:** Prefer maintained, reviewed Rust libraries for generic concerns:
authentication primitives, sessions, password hashing, WebAuthn, MFA, SQL
drivers/migrations, serialization, HTTP middleware, OpenAPI, mail transports,
object storage and observability. Application code should compose those
libraries behind narrow adapters and implement only Wicked Learning-specific
policy and behavior.

**Selection criteria:** active maintenance, compatible Rust/Axum/SQLx versions,
security history, license fit, documentation/tests, operational support and
ability to replace the adapter. Proof-of-concept evaluation precedes a version
pin; no dependency is selected merely because it is popular.

**Examples:** use SQLx rather than a custom PostgreSQL protocol layer, and use
the crates named in ADR-003 rather than custom password, session, passkey or
TOTP implementations.

## ADR-010: AI integration boundary

**Status:** Accepted — 1 November 2026

**Decision:** AI requests originate only in the Rust backend. The browser uses
versioned application contracts and never receives a provider credential or
calls a model provider directly. Each AI capability gets a named, versioned
input/output contract and server-owned JSON-schema validation before its result
can affect application state.

Use the maintained community crate `async-openai` with its `responses` feature
for the initial OpenAI Responses API adapter. It provides typed request and
response models, retries for rate limits, streaming support and OpenAI-
compatible configuration. It is intentionally behind an `AiProvider` adapter:
provider-specific types, model names and credentials may not leak into API
handlers, application policy or React.

**Why:** The OpenAI Responses API is the recommended API surface for new
OpenAI integrations, and `async-openai` has direct typed support for it. The
adapter keeps the project able to add another model provider later without
silently changing a learner or author contract. No AI network call, model
credential or user-facing AI feature is enabled by the phase-2 foundation.

**Safety boundary:** Treat model output as untrusted input. A model may propose
text or a structured draft only; it cannot choose permissions, execute tools,
write content, alter progress or override authorization without a separately
implemented and authorized application use case.

## Phase 1 gate

Phase 1 passed on 1 November 2026. The user accepted the monorepo, same-origin
`/api`, OpenAPI contract, read-only-first foundation, Rust-owned identity, two
greenfield databases, mounted media volume and local-system proof of concept.

The phase-2 local foundation was verified with the separate frontend, backend,
application PostgreSQL and identity PostgreSQL services. It does not deploy to
production, switch production routing, import legacy data or enable user-facing
writes. Fresh schema and bootstrap details remain reviewable implementation
artifacts, not a reason to delay this bounded foundation.
