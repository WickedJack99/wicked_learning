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

**Required proof before cutover:** password login and recovery; the
source-disabled email-verification policy; TOTP enrollment/recovery; passkey
registration/authentication;
session rotation/revocation; CSRF/rate-limit/audit behavior; and independent
security review. The new platform starts with fresh credentials and fresh
passkey enrollment; no Laravel password hash, passkey, session or account data
is migrated.

**Current identity proof-of-concept policy:** preserve invitation-only
registration: a valid, bounded registration token is required before a new
identity can be created. Password verifiers live in a dedicated
`identity_password_credentials` table in the identity database, not in the
identity profile or application database. The foundation uses RustCrypto
Argon2id through the maintained `argon2` crate and rejects passwords shorter
than twelve characters. Session persistence will use `tower-sessions` with its
SQLx PostgreSQL store; Axum authentication integration will use `axum-login`.

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

**Implementation:** The initial adapter uses the maintained Apache Arrow
`object_store` crate's local filesystem provider rooted at the mounted backend
volume. It assigns opaque server-owned object keys and uses the provider's
atomic write behavior with filesystem sync enabled. The same adapter boundary
can later be configured with its S3-compatible or other object providers.

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

## ADR-011: Initial browser session boundary

**Status:** Accepted — 1 November 2026

**Decision:** Use the Rust identity database and the maintained
`tower-sessions-sqlx-store` library for opaque, server-side browser sessions.
`axum-login` owns session-authentication integration. The browser receives only
an HTTP-only, SameSite=Strict session identifier; it never receives a password
hash, identity record or credential in browser storage.

Secure cookies are enabled by default. The local Compose proof of concept sets
`SESSION_COOKIE_SECURE=false` solely because it is served over `http://localhost`.
Any HTTPS deployment must leave it enabled. A successful password change changes
the stored session-authentication hash, which invalidates existing sessions at
the next request.

The local proof of concept now has `POST /session/login` and `POST
/session/logout`, both protected by an exact configured Origin and CSRF token.
Login is limited to a five-attempt client-IP burst with one attempt replenished
per minute using `tower_governor`; Nginx overwrites the trusted `X-Real-IP`
header. This is a bounded identity proof, not a user cutover: durable
per-account limits, audit records, verification/recovery, MFA/passkeys and the
full authorization matrix remain required before a user pilot. SameSite is
defense in depth, not a substitute for CSRF or origin enforcement.

## ADR-012: Fresh public exploration model

**Status:** Implemented — 7 November 2026

**Decision:** The first fresh read-only exploration slice models published
`World → Map → MapAsset` records directly. It does not recreate Laravel's
internal `LearningNode` compatibility record or its legacy identifiers.

The public contract returns only published records, bounded to one default
world, its maps and their map assets. A map asset carries its own stable slug,
title, description, position and interaction mode. Activities, unlocks,
progress, private access, media and authoring are intentionally excluded until
their policies and transactions are implemented in their own slices.

**Why:** The product's learner-facing graph is World → Map → MapAsset →
activities. A separate Node record in the existing Laravel application is an
implementation compatibility layer, not a greenfield data requirement. This
direct model keeps the initial Rust contract small and makes a future activity
relation explicit rather than silently inheriting a legacy join.

## ADR-013: Fresh route-preview boundary

**Status:** Accepted — 3 November 2026

**Decision:** Extend the fresh public exploration model with direct
`MapAsset → Route → Activity` relations. The first public place-detail endpoint
returns a published, focusable MapAsset and at most twelve published route
previews, each with only its title, description and published activity count.
Its route-outline endpoint returns at most twenty-four published activity
titles and descriptions for orientation.

Neither read-only endpoint exposes activity configuration or interaction
details, begins a route, creates a run, or records learner state. Private
access, unlock rules, route selection, activity playback and all learner writes
remain later slices with their own authorization and transaction boundaries.

**Why:** A map place needs enough orientation to explain its available learning
directions, while starting or progressing a route is learner state and must not
be approximated by a read-only browser implementation. Direct fresh relations
keep the model aligned with the product graph without reintroducing Laravel's
internal compatibility Node.

## ADR-014: Foundation crate placement and extraction trigger

**Status:** Accepted — 3 November 2026

**Decision:** The initial Rust/Axum proof of concept intentionally uses one
small `backend` binary crate with route handlers and adapters directly under
`backend/src`. This was a temporary foundation layout, not a rejection of the
planned workspace architecture.

**Why:** ADR-008 authorized a no-write proof of concept to validate the
separate build, Compose topology, two PostgreSQL databases, OpenAPI generation,
health checks, media adapter, CSRF and session libraries. At that point there
were no proven application use cases or domain seams, so creating empty
`api`, `application`, `domain`, `persistence` and `infrastructure` crates would
have added ceremony without protecting a real boundary. Keeping the foundation
in one crate made those cross-cutting concerns executable and testable quickly.

**Extraction trigger:** Before adding a substantial behavior module beyond the
foundation—starting with the World content contract and its persistence/query
logic—refactor `backend` into the workspace described in the replatforming
plan. Put Axum/HTTP DTOs in `api`, use cases in `application`, policy/value
objects in `domain`, SQLx implementations in `persistence`, and media, mail,
AI and clock adapters in `infrastructure`. Do not add new domain behavior to
the flat root `backend/src` modules after this trigger.

**Documentation rule:** Any deliberate deviation from the planned repository
or crate structure needs a dated ADR that states the scope, rationale, owner,
and concrete trigger for revisiting it. Do not leave structural shortcuts as
implicit or chat-only context.

**Implementation:** The extraction trigger was reached and completed. The
workspace root is `backend/Cargo.toml`; `crates/api` owns Axum routes and HTTP
DTOs, `crates/application` owns use cases and transaction boundaries,
`crates/domain` owns policies/value objects, `crates/persistence` owns SQLx
adapters, and `crates/infrastructure` owns external adapters. New behavior is
added through those crates rather than restoring a flat root `backend/src`
layout. The original temporary rationale remains here as historical context,
not as a current structural choice.

## ADR-015: Authenticated learner World snapshot is a separate read contract

**Status:** Accepted — 4 November 2026

**Problem:** The anonymous World contract cannot safely represent a learner's
map access, bookmarks, activity summaries or route status. Letting React merge
public content with unscoped records would expose other learners' data and make
the browser responsible for authorization.

**Decision:** Add `GET /api/v1/learner/world` as a signed-in, read-only
snapshot. The API resolves the identity subject to an application principal,
filters maps by the principal's application roles (or the explicit `public`
map role), and returns only that principal's bookmark, activity-progress and
route-progress summaries, plus bounded published route previews for the visible
nodes. Learner-owned records reference
`application_principals`, not identities in the separate identity database.
The contract deliberately excludes answers, activity configuration, play-run
identifiers, mutation affordances and data owned by another learner.

**Why:** This follows the Laravel `LearningWorldSerializer` boundary while
keeping access policy and ownership checks in Rust/PostgreSQL. It creates a
small, independently testable foundation for lifting the original World UI
without treating public exploration as a learner-state implementation.

**Alternatives:** Extending `/public/world` would mix anonymous and private
contracts and invite accidental disclosure. Fetching public content and
learner records separately in React would force client-side joins and policy
decisions. Both are rejected.

**Limitations and next trigger:** The snapshot has no writer and does not yet
model tool inventory, groups, answer-derived reveal/unlock rules, route start
or activity playback. The interim `/world` React route uses this snapshot for a
signed-in session and the public contract otherwise, rendering its authorized
route previews in place of a link to a public-only endpoint. It has not yet
lifted the original `ActivityPanel`'s writer behavior. Its node drawer geometry,
close control, scroll ownership and touch swipe behavior are lifted from the
original `NodeDetailDrawer`; the ActivityPanel's read-only start-card,
progress and pagination presentation is lifted as well. Route start and reset
remain visibly unavailable until their server-owned learner-state policy, write
contract and browser evidence exist. These capabilities need their own complete
policy, schema and browser evidence before this endpoint can be described as
full World parity.

## ADR-016: Preserve node-specific activity starts separately from routes

**Status:** Accepted — 4 November 2026

**Problem:** Laravel distinguishes an activity route (the activity sequence)
from an activity start (how an eligible activity is offered from a particular
node). A start owns its ordering, label, description, images and button theme.
Representing every visible offer as a generic route would lose that behavior
and prevent the original `ActivityPanel` from being lifted faithfully.

**Decision:** Add `learning_activity_starts` to the application database. It
links a node to an activity and holds the learner-facing presentation fields.
The existing fresh orientation content receives one start per route's first
published activity. The authenticated World contract exposes starts, so the
React ActivityPanel lift does not synthesize them from generic route rows.

**Temporary limitation and trigger:** The first learner-progress schema keys
route progress by `(principal_id, route_id)`. That is safe for the current
fresh content, where each route has one node, but is not sufficient once a
route can be started from more than one node. Before authoring or publishing a
reused route, evolve route progress to reference `learning_activity_starts.id`
and preserve the old route-level records through an explicit local migration.
Do not let the temporary key become a permanent convention.

**Alternatives:** Synthesizing start buttons directly from routes would discard
their authored presentation and node-specific semantics. Delaying the table
would keep the provisional drawer in place and make the frontend re-create
server content decisions. Both are rejected.

## ADR-017: Server-owned route-start and reset runs

**Status:** Accepted — 5 November 2026

**Problem:** Starting, resuming and resetting an activity route changes
learner-owned state. A browser-generated run identifier, route-only progress
key, or client-side visibility decision would allow forged/reused runs and
would fail once the same route is offered by multiple activity starts.

**Decision:** The first local learner-state writer accepts only an authored
activity-start UUID. In one PostgreSQL transaction it resolves the
authenticated application principal, verifies published map/node/asset/route/
activity visibility and route eligibility, then creates or resumes a
server-generated UUID play run. Reset always creates a new UUID and clears
only current-run state. Progress is keyed by `(principal_id, activity_start_id)`
while retaining `route_id` as a query aid. Unknown and unauthorized starts both
produce the same not-found result.

**Why:** It preserves Laravel's `LearnerRouteProgressService` behavior while
keeping authorization, current-run identity and replay prevention in Rust and
PostgreSQL. The database now has a durable activity type/configuration boundary
so portal-input starts can be rejected by policy before a browser can invoke
them.

**Limitations:** This slice starts/resumes/resets a run. It does not complete
an activity or permit answer/reflection writes, inventory changes, tools, AI,
collaboration, or authoring. Those writers must validate an active
server-owned run and arrive as separate tested increments.

## ADR-018: Current-user display data remains identity-owned and self-scoped

**Status:** Accepted — 5 November 2026

**Problem:** The original learner shell presents a user menu with identifying
display information. The initial Rust `GET /me` contract exposed only an opaque
subject ID and application roles, which encouraged a substitute account page
instead of lifting that menu.

**Decision:** `GET /api/v1/me` may include the authenticated subject's own
normalized email address alongside its opaque subject ID and application
roles. The value is read from the identity database only for the active
session; the application database continues to own roles and never receives or
stores the address. Password hashes, credential metadata, other identities,
and profile/learner data remain excluded.

**Why:** This is the minimum safe display data needed to adapt the original
user-menu pattern without inventing a separate account surface or coupling
application records to credential data.

**Alternatives:** Showing the opaque UUID is not an acceptable learner-facing
identity. Duplicating email into `application_principals` would violate the
separate-database boundary. Adding a full profile model is premature until the
original profile/settings workstream is migrated.

## ADR-019: Playback reads are scoped to an active server-owned run

**Status:** Accepted — 5 November 2026

**Problem:** The original activity page receives the current activity and its
authored transition through Laravel state. Letting the React client select an
activity by slug or derive the next transition would let a URL bypass learner
progress, publication and access checks.

**Decision:** `GET /api/v1/learner/play-runs/{play_run_id}` resolves only the
authenticated principal's active, in-progress run. It returns the current
supported activity's type, authored configuration and its one `completed`
transition label/target. It never accepts an activity slug from the browser.
Unknown, completed, inaccessible and unsupported runs are all not-found.
The first reader and route-start policy support only `open_practice`; adding a
different activity type requires its own server validation, OpenAPI contract,
writer and lifted original React component.

**Why:** This makes the browser a renderer of server-authorized playback data,
matches the original route-progress ownership model and avoids a partial
player choosing a next activity. The narrow initial type gives the existing
`OpenPracticeActivity` a complete target without claiming that all activity
types have been migrated.

**Alternatives:** Exposing a generic activity-by-slug endpoint or returning
the entire route graph would duplicate authorization and transition policy in
the browser. Enabling every existing activity type through an untyped JSON
payload would misrepresent unsupported behavior. Both are rejected.

## ADR-020: Open-practice completion advances only the active run

**Status:** Accepted — 5 November 2026

**Problem:** The original `OpenPracticeActivity` completes the current
activity, then follows its authored `completed` transition. A browser command
that supplies a next activity or a run-wide “complete” action could skip an
activity after a stale refresh or a double click.

**Decision:** `POST /api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/complete`
accepts the displayed activity slug only as an expected-current-value. In one
PostgreSQL transaction Rust locks the matching active run, verifies that its
current activity is the supported published open-practice activity, marks it
completed, and resolves its authored completed transition. A valid target is
marked reached and becomes the run's current activity; no target completes the
run and increments its completion count. The response reports only whether the
same run is still in progress or completed. The browser reloads the playback
document for an in-progress run and never supplies a target activity.

**Why:** This retains Laravel's state progression while making stale activity
submissions safe: once the server advances or completes a run, the old
activity-slug command is no longer eligible. It also keeps per-activity and
per-route progress updates atomic.

**Alternatives:** Posting a client-selected next activity would duplicate graph
policy in React. Returning an arbitrary next-page URL would couple API policy
to browser routing. A generic completion endpoint without the expected current
activity would make stale submissions ambiguous. All are rejected.

## ADR-021: Private reflection is a distinct learner-state boundary

**Status:** Accepted — 5 November 2026

**Problem:** The original reflection activity is not a generic text field or a
public activity completion. It writes learner-owned private words, attaches
them to the currently active play run, organizes them in a private journal and
then follows an authored transition. Storing reflection text in route-progress
metadata, exposing it in the World snapshot, or allowing the browser to choose
a journal page would break that boundary.

**Decision:** The first reflection slice supports the original base
`reflection` activity only. `POST
/api/v1/learner/play-runs/{play_run_id}/activities/{activity_slug}/reflection`
accepts one bounded non-empty reflection for the authenticated principal's
current server-owned reflection activity. In one application-database
transaction it validates publication/access and the authored configuration,
upserts the principal's private journal page from the authored topic/subtopic,
adds an immutable structured reflection row, appends the journal representation
and advances or completes the active run through its authored `completed`
transition. The browser never supplies an activity target, journal identity,
topic, transition or evidence claim. The response deliberately does not echo
the learner's writing.

Each stored reflection also retains the authored activity-start identity active
at the time of writing. This lets a later private journal reader show its
original map/node context even after the learner resets or starts another run;
it must not derive old reflection context from mutable current progress.

`learner_journal_pages` and `learner_reflections` are application-database
tables keyed by `application_principals.id`; identity credentials and identity
profile data remain in the separate identity database. Neither table is part
of anonymous/public World data or the broad learner World snapshot.

**Why:** This preserves the original privacy and progression behavior while
providing a narrow, independently testable base that future journal and review
surfaces can read through separately authorized contracts.

**Alternatives:** A plain completion endpoint plus browser-local note would
lose the private durable record. A generic journal-write endpoint would allow a
stale activity page to write outside its current run. Both are rejected.

**Limitations and trigger:** This does not yet enable the original transfer,
explanation, review comparison, independent-check, confidence, cue, journal
editing/export or staff-feedback variants. Each has additional private data and
evidence semantics, so it needs a separate contract and browser parity slice;
the UI must not advertise those variants before then.

## ADR-022: Journal reading remains learner-scoped and bounded

**Status:** Accepted — 5 November 2026

**Problem:** The original journal is a private learner record. Returning all
pages and filtering in React, or reusing the broad World snapshot, could expose
another learner's writing or make private record loading unbounded. Its context
also cannot be recovered safely from mutable current route progress.

**Decision:** `GET /api/v1/learner/journal` reads only the authenticated
application principal's journal pages. It accepts bounded, server-validated
page, page-size and text-search parameters; PostgreSQL applies ownership,
search, ordering and pagination before returning page markdown. The response
may include the latest reflection's immutable activity-start map/node context
and the page's `view`/`edit` presentation preference, but includes no export,
feedback request, review, staff or other-learner data. Missing
application-principal authorization is forbidden.

**Why:** This was the safe read foundation for lifting the original journal
overlay without pretending that editing, export, expert access, learning
check-ins or revisit invitations had migrated. The later source-derived page
writer and revisit slices now consume the same learner-scoped model without
widening it to another principal.

**Alternatives:** A generic journal endpoint keyed by browser-supplied page or
principal IDs would weaken ownership. Adding disabled edit/review controls
would misrepresent unavailable workflows. Both are rejected.

**Limitations and trigger:** The basic page writer is separately defined in
ADR-024. The bounded read-only source Learning trail is now available from the
same learner-scoped model, but its activity-replay and competence links remain
omitted until those contracts and source surfaces exist. Export, feedback
requests and the fuller source check-in history/timeline still need their own
source UI and authorization evidence. Due revisit invitations are defined by
ADR-032 and ADR-033.

## ADR-023: Journal categories remain labels, not page identities

**Status:** Accepted — 5 November 2026

**Problem:** The initial Rust reflection migration made a learner's
topic/subtopic pair unique. That followed an early Laravel schema, but the
existing application later removed the unique key: a learner can create
several distinct manual pages in the same category, each with its own title.
Keeping the uniqueness restriction would reject valid existing behavior and
prevent a source-derived manual journal UI.

**Decision:** `learner_journal_pages` permits repeated topic/subtopic pairs
for the same application principal. Page UUID is the durable identity; title
and category are editable presentation data. Reflection persistence chooses the
oldest existing page for its authored category, matching Laravel's
`firstOrCreate` lookup, or creates one when the category is absent. A
transaction-scoped PostgreSQL advisory lock serializes that narrow reflection
lookup/create decision without preventing manual pages in the category. An
ordered principal/category index supports the lookup.

**Why:** This preserves both original behaviors: automatic reflections gather
under the first matching category page, and learners may independently keep
several titled notes under that category. The lock avoids a new-platform race
creating competing automatic pages after the uniqueness restriction is gone.

**Alternatives:** Retaining the unique constraint would silently narrow manual
journal behavior. Assigning a separate hidden reflection page would diverge
from a manual page that intentionally shares its category. Both are rejected.

**Limitations:** The source schema cascades deletion to attached private
reflection records; ADR-024 preserves that source behavior. Feedback,
export, check-in and revisit workflows remain separate slices.

## ADR-024: Manual journal pages use owner-scoped source-defined writes

**Status:** Accepted — 5 November 2026

**Problem:** The original private journal permits a learner to create a
free-form page, edit its title/category/Markdown and view preference, and
delete only a page they own. The prior Rust reader accurately displayed pages
but could not lift those original controls without either browser-local fake
state or an owner-safe writer contract.

**Decision:** Add authenticated, CSRF-protected `POST /learner/journal/pages`,
`PATCH /learner/journal/pages/{page_id}`, and `DELETE
/learner/journal/pages/{page_id}` commands. The application layer validates
the original title (240), topic/subtopic (160), Markdown (100000) and
`view`/`edit` bounds. PostgreSQL scopes every update and delete by both page
UUID and authenticated application principal; unknown and another learner's
page both return `404`. New pages use the original client defaults: “Untitled
page”, “General”, empty Markdown and edit mode. Deleting a page retains the
existing schema's source-equivalent cascade to its attached private
reflections.

**Why:** This lifts the original journal editor without exposing a page ID as
authority, retaining its explicit save/delete behavior and empty-page support.
It keeps structured reflection data inside the application database and does
not widen it to the browser or another learner.

**Alternatives:** A generic unscoped page mutation would permit cross-learner
writes. A browser-only editor would lose durable behavior. Soft-deleting or
reassigning reflections would alter the existing application's documented
database behavior. All are rejected.

**Limitations and trigger:** This slice does not include the original export,
feedback request/expert-access, learning check-in or revisit-invitation
controls. Each has distinct information-sharing or learning-state semantics
and requires its own contract and source-derived UI before it may appear.

## ADR-025: Bookmark commands are visibility-scoped and idempotent

**Status:** Accepted — 5 November 2026

**Problem:** The original World drawer lets a signed-in learner save or remove
an accessible place. The Rust World snapshot had a read-only bookmark marker,
which made the lifted UI look incomplete and encouraged a browser-side state
substitute. A raw node identifier must not let a learner bookmark a hidden or
role-restricted place.

**Decision:** Add CSRF-protected `POST` and `DELETE` commands at a map-slug and
node-slug path. The repository first resolves the target only among the
principal's currently visible maps and rejects hidden or empty-space nodes as
not found. It then uses the existing application-database
`(principal_id, node_id)` primary key for an idempotent insert or delete and
returns the bounded visible bookmark projection. Each projected bookmark
contains both map and node slugs: node slugs are only unique within a map, and
the original application used a globally unique node ID. The source-derived
World drawer preserves its bookmark/remove labels and keeps the prior
presentation when a request fails.

**Why:** The server remains the authority for access, visibility and learner
ownership, while the browser receives exactly the data it needs to update the
existing control. Idempotence makes retries and duplicate clicks safe.

**Alternatives:** A browser-only toggle would not persist. Accepting arbitrary
node UUIDs or slugs without the visible-map predicate could reveal restricted
content or create records for a hidden location. Both are rejected.

**Limitations and trigger:** This restores only bookmarking from the World
drawer. The dedicated bookmark-map page, Learning Desk integration, tools,
groups, audio and unlock/reveal rules remain separate source-defined slices.

## ADR-026: Personal bookmark map reads current visible context

**Status:** Accepted — 5 November 2026

**Problem:** The original `/bookmarks` route is not a generic saved-item list.
It arranges saved places on a personal map, retains each place's source-map
context and lets the learner remove a bookmark or return to that location.
The existing Rust World snapshot intentionally does not expose all of the
presentation fields this separate route needs.

**Decision:** Add authenticated `GET /learner/bookmarks`. PostgreSQL derives
the caller's allowed maps first, then returns at most 500 bookmarked nodes that
are still published, visible and not empty-space placeholders. Each result
contains only the place's map slug/title, learner-safe node presentation and
its published map asset when one exists. The first currently visible map
supplies the personal map's background/grid presentation, matching the
original serializer's template-map purpose without disclosing an inaccessible
map. React adapts the original bookmarks page and sends removal through the
existing CSRF-protected bookmark command.

**Why:** This preserves the original personal-map workflow while keeping
authorization and visibility on the server. Reusing the existing mutation
avoids two writers for the same learner bookmark relation.

**Alternatives:** Building the view from a browser-filtered full World payload
would couple it to unrelated reader fields and omit the original source-map
context. Returning a generic item list would redesign the existing learner
workflow. Returning the source world's first map regardless of visibility
could disclose role-restricted presentation. All are rejected.

**Limitations and trigger:** Learning Desk's separate bookmark rail and the
remaining learner navigation need their own source-derived contracts.

## ADR-027: Topics reader preserves the source directory-to-detail flow

**Status:** Accepted — 5 November 2026

**Problem:** The source topic directory is authenticated, paginated and
searchable, and every listed topic opens one detail document with a persistent
topic header and four sections: Trail, Routes, Maps and Overview. A Rust
directory without that document would create a non-functional or redesigned
destination. Conversely, the generic Paths contract did not return the topic
header or a server-owned node identifier needed to begin a selected path.

**Decision:** Expose the source-adapted authenticated `/topics` and
`/topics/{topic}` reader only after all four sections have Rust contracts. The
directory returns only published root topics
in a source-ordered area, applies literal bounded search and six-item
pagination in PostgreSQL, and derives each map count from maps the
authenticated principal may currently view. Overview returns a published topic
header and bounded published subtopics; Maps returns only maps currently
visible to the authenticated principal.

Trail resolves the source topic's published descendants server-side and returns
only the current learner's bounded qualitative evidence, recent check-ins and
private reflection comparison whose activities remain in currently visible,
published maps. It derives the source learning-area list from visible authored
activity configuration, rather than asking React to parse or filter it. Its
recent-reflection rows may use the shared opaque replay command, but it does
not provide a generic activity writer. The browser does not receive topic IDs,
unpublished records, arbitrary map access,
or a client-filtered collection. The detail reader retains the source default
Trail tab, tabs/keyboard behavior, section-specific query parameters, filters
and bounded pagination. The Routes tab invokes the existing CSRF-protected
start command; its opaque returned run remains the only authority to open
playback.

When `GET /learner/paths` is scoped with `topic`, it now returns nullable
`topic_context` and a `node_slug` per path. The context preserves the source
detail header without a second unrelated browser read; the node slug is an
explicit server-issued playback destination instead of parsing a World URL.

**Why:** This makes the data, authorization and URL boundary reviewable now
without presenting an incomplete workflow as migrated. It also preserves the
original separation between topic discovery and the learner-specific detail
trail.

**Alternatives:** Returning all topics to React for filtering would expose
unpublished or inaccessible context and lose source pagination semantics.
Publishing a directory whose links lead to a simplified topic summary would
make an unfinished substitute part of the product. Both are rejected.

**Limitations and trigger:** The standalone source `/paths` page remains
unavailable. Trail preserves the available source competence destination, but
intentionally omits the unavailable direct-Journal control rather than
inventing a substitute; the journal is currently an overlay, not a direct
document URL. Its broader
reflection-history controls need their own contracts and browser evidence
before they are restored.
The management control is also absent because the administration route has no
Rust contract. The shared Paths/World/start policy now covers roles, completed
nodes and valid schedules, but discovery, answer-event, tool, item and manual
opening parity remains a gate; rows needing those capabilities must not become
visible merely because the represented subset is available.

## ADR-028: Paths reader preserves source filtering without publishing a partial page

**Status:** Accepted — 5 November 2026

**Problem:** The original `/paths` screen and the topic-detail Routes section
offer authored activity starts only when their map is visible, their node is
playable, their activity can start, and their optional learning-intent and
time-guide filters match. The Rust database already has published starts,
map-role access, static node state, authored activity configuration and
principal-scoped route progress, but it has no Rust model yet for the source
schedule, reveal and tool-unlock state.

**Decision:** Add authenticated `GET /learner/paths` as an unexposed contract
foundation. PostgreSQL applies publication, map-role visibility, empty-space,
portal-input, topic, intent and time-guide predicates before a bounded
source-ordered scan. A framework-free Rust availability policy then resolves
the source's authored node state, nested AND/OR conditions, role and completed
node requirements, timed lock/unlock conditions, and the precedence of hidden,
scheduled, answer and manual openings. It is reused by the learner World
snapshot and the route start/reset command, so a displayed route and a direct
start request cannot disagree about the conditions currently represented by
Rust. It returns at most six starts, their server-owned World destinations,
authored presentation, valid competence-topic metadata and only the caller's
route progress. Intent defaults match the source activity-type rules when
configuration is absent; only 15- and 30-minute filters are retained. Unknown
source query values normalize to no filter as the Laravel controller does.

The first availability increment supplies the policy with the authenticated
principal's roles, completed nodes and current RFC 3339 schedule instants.
Malformed availability configuration fails closed. The source tool-belt and
its map-node reveal/unlock command now write only a verified owned tool's
discovery or tool-use fact. Answer events, item grants and staff manual
openings still have no Rust writer; absent facts remain unavailable instead of
being treated as satisfied.

**State-model evolution:** Application migration `0029` creates normalized
tool, item, ownership, discovery, tool-use and manual-opening records before
their source writers are lifted. The reader consumes each fact without turning
Laravel's mixed discovery metadata into an opaque cross-purpose JSON contract.
The first writer verifies map visibility, CSRF, learner ownership and the
configured tool before it records a source-equivalent reveal or unlock attempt.
Author-facing `toolId` and item-grant `items[].itemId` configuration now name
unique public slugs—not an internal Rust UUID or a Laravel numeric key—because
this is a greenfield platform. The source `tool_grant` activity is now the
sole Rust tool-acquisition writer: it derives the current active activity and
configured public tool slug from the authorized play run, inserts one
idempotent ownership record, and completion rechecks ownership before advancing
the authored transition. Its React component is lifted from the original
activity rather than being a new inventory workflow. The source `item_grant`
activity is its own item-acquisition writer; its roll and holding boundary is
recorded in ADR-034. NPC dialogue grants, answer events and staff overrides
remain absent and fail closed. This is the deliberate architecture boundary for
the source tool/discovery slice, not permission to publish the standalone Paths
screen.

**Why:** This retains server authority for availability and creates one bounded
reader that both the future `/paths` page and topic Routes panel can consume.
One policy also prevents a common migration failure where the browser hides a
route but a direct command still opens it. It avoids browser-side joins of map
access, node state, start presentation and private progress.

**Alternatives:** A browser-filtered World snapshot would disclose more content
than the source Paths reader needs and make eligibility client-controlled.
Publishing a card-list `/paths` page now would be a substitute for the source
Paths workflow. Both are rejected.

**Limitations and trigger:** This is not yet full dynamic availability parity.
Rows requiring answer events, item ownership or staff manual openings remain
unavailable until their learner-state writers, authorization tests and source
controls exist in Rust. Tool-dependent reveal and unlock are available only to
the current learner who already owns the exact configured tool; source tool
grant flows remain a separate slice. The standalone React
`/paths` route remains absent until its complete source page and every source
eligibility input are represented. The topic Routes tab may consume only the
facts Rust can currently prove and starts runs through the same server-owned
policy.

## ADR-029: Competence uses an append-only private evidence ledger

**Status:** Accepted — 5 November 2026

**Problem:** The source learner competence map is not a score table. It derives
qualitative light, recency and learning-history presentation from an
append-only event for every configured competence topic completed in an
authorized play run. A generic progress count would lose the source's
evidence-type, contribution, authored objective, confidence and independent
check context, and would make later Trail aggregation impossible to review.

**Decision:** Add application-database `competence_topic_definitions` and
`learner_evidence_events` tables. Definitions own active qualitative
thresholds. Evidence is scoped to one application principal, activity and
server-owned play-run UUID and has a uniqueness key per topic/evidence-type/
attempt. It may refer to a private reflection but never stores reflection text.
JSON metadata is constrained to arrays where applicable; all contributions are
positive and evidence types are the source-defined intent set. The supported
Rust playback writers (`open_practice`, question and base reflection) write the
normalized snapshot inside their existing active-run transaction. The browser
does not post evidence or select a topic, contribution, outcome or evidence
type. Separately, reading an authorized active run serializes on the
application principal and mirrors the source activity-entry behavior: it stores
the current private topic set and increments private topic-pair transition
counts only when that set changes. Topic visits do not create evidence events
and neither the last-topic value nor transition history is exposed to React.

**Why:** This is the minimum durable data boundary from which a future Rust
writer produces the source evidence record atomically with activity completion,
and from which a bounded private competence reader can derive its visual ratios
without exposing answers or journal writing.

**Alternatives:** Accumulated points discard event history and cannot reproduce
recent activity or evidence-ledger behavior. Returning raw completion/progress
rows would conflate progression with evidence and lose the authored topic
weights. Both are rejected.

**Limitations and trigger:** Dynamic completion variants, check-ins and review
attempts are not represented yet. The private transition ledger records only
the supported activity-entry slice; it is not an exposed topic graph or a
claim of complete navigation parity. Explanation and transfer evidence remains
`participate` unless the matching source response type is supported and stored
in the same run. Before enabling the competence browser route, add qualitative
aggregation, cross-user tests and the source-derived UI together; do not expose
a numeric score or a partial star map from these tables.

## ADR-030: Competence aggregation is private, qualitative, and contract-first

**Status:** Accepted — 5 November 2026

**Problem:** The source competence star map translates private evidence into
qualitative size, brightness and recency signals, a bounded evidence ledger and
private topic transitions. The newly migrated writers made those records
durable, but exposing their raw database rows, a numeric total, or a partial
browser star map would violate the product's no-score and privacy boundaries.

**Decision:** Add authenticated `GET /learner/competence` as an unexposed
contract foundation. PostgreSQL resolves only the authenticated application
principal, aggregates at most 100 evidence-bearing topics using the source's
30-day window and active authored thresholds, and returns the source visual
ratios/tier descriptions rather than contribution totals. Each topic includes
at most 12 recent events; source references and structured authored guidance
are retained from the server-written snapshot, while learner reflection text
and arbitrary metadata are omitted. Transition pairs are limited to the
returned private topics and capped at 1,000. The browser receives no endpoint
link to a past activity because a historical activity alone cannot authorize a
new Rust play run.

**Why:** This establishes a reviewable frontend/backend boundary and makes the
source aggregation testable without publishing a new screen or treating event
counts as learner achievement. It also keeps the later source UI from having
to reconstruct private evidence or authorization policy in React.

**Alternatives:** Returning raw evidence lets clients infer their own score and
would disclose fields that do not belong in a browser contract. Publishing the
existing star map with incomplete check-in/review and re-entry behavior would
present an approximation as a migration. Both are rejected.

**Limitations and trigger:** This contract currently covers only evidence and
topic entries written by the supported Rust activity slice. It omits source
check-ins, review attempts, activity/node links and richer response evidence;
no React route uses it. Before adding `/competence`, migrate those applicable
inputs, preserve server-authorized re-entry, lift the original star-map
components, and add cross-user/browser parity evidence together.

## ADR-031: Public presentation is a server-owned, source-derived read model

**Status:** Accepted — 5 November 2026

**Problem:** The lifted public React pages previously duplicated Laravel's
welcome copy, logo path, dark/light palette and auth-theme values in separate
frontend modules. That made the same public presentation configuration exist
in two places and prevented the Rust frontend from rendering a deployment's
stored presentation values faithfully.

**Decision:** Add application-database singleton
`public_presentation_settings` and anonymous `GET /public/presentation`.
The value is a strict, resolved public model containing only the logo, welcome
pages and per-page backgrounds, dark/light public palette, and the login and
welcome base auth-theme values required by the existing lifted UI. Migration
26 seeds it from the source application's current defaults. The application
layer and PostgreSQL repository deserialize it into typed Rust domain values;
a missing or malformed singleton returns `503` rather than silently reverting
to a looser or hand-coded frontend fallback.

React retrieves the model once for public presentation routes and passes it to
the lifted Welcome, Login, Information and Source components. The shared
presentation helper resolves the source palette opacity and background
selection rules. A temporary loading/unavailable state is shown only while the
required public read is unavailable; the old duplicated values are removed.

**Why:** This creates an explicit reviewable browser/API boundary for the
source presentation model, removes divergent frontend defaults, and keeps
deployment configuration in the application database without exposing private
administration metadata. It is deliberately read-only, so it changes neither
Laravel production routing nor administrator behavior.

**Alternatives:** Keeping copied TypeScript constants would continue to drift
from the deployment setting. Returning the legacy Laravel setting wholesale
would expose unrelated configuration and preserve its storage format as a
Rust contract. Both are rejected.

**Limitations and trigger:** This does not add an administrator writer,
presentation audit history, validation UI, configured information-page
ordering, or the full source cursor/theme set. A later administrator slice
must validate and write this typed model under appropriate authorization;
until then, the seeded source defaults are the only supported configuration.

## ADR-032: Private check-ins are normalized and bound to an owned completed run

**Status:** Accepted — 5 November 2026

**Problem:** Laravel stores a learner's optional post-activity check-ins and
revisit state inside mutable activity-progress JSON. That couples individual
private observations to an implementation detail, makes the source's bounded
history difficult to query safely, and lets a browser-oriented API risk
accepting a bare activity identifier without proving which learner/run owns it.

**Decision:** Store each check-in as an application-database
`learner_activity_check_ins` row owned by one application principal and one
activity. It holds only the source-defined feeling (`clearer`, `forming`,
`stretched`, `stuck`), optional private note (at most 500 characters), optional
direction (`revisit`, `related`, `settle`), server timestamp and opaque
server-issued play-run ID. PostgreSQL constrains those values and retains only
the latest 30 observations for each learner/activity, matching the source's
bounded history.

`POST /learner/play-runs/{play_run_id}/activities/{activity_slug}/check-ins`
does not trust a browser-supplied activity identity. In one transaction it
proves the authenticated principal owns the route run, the activity belongs to
that run's published/visible route, and the principal has already completed it.
A `revisit` direction schedules a private invitation for three days later;
every newer non-revisit direction clears that schedule. The migration records
the schedule explicitly on learner activity progress, rather than deriving it
from serialized JSON.

**Why:** This preserves the learner-controlled, private behavior while making
ownership, validation, retention and future journal/competence readers
reviewable in SQL. A play-run boundary also follows the replatforming rule that
the browser cannot choose an activity or progression state on its own.

**Alternatives:** Keeping Laravel-compatible metadata would copy a persistence
format rather than behavior. Taking only an activity slug would make the Rust
writer depend on a weaker authorization check. Both are rejected.

**Current browser evidence:** The ordinary route playback page lifts the
source post-activity check-in panel for open-practice, question and base
reflection activities. It receives only bounded authored presentation context
(choice prompt, objective, concept labels and at most three named areas) from
the playback projection. The browser sends only the source's optional private
fields after completion; continuing with no choice makes no write. Revisit
runs do not show this ordinary check-in panel, because their distinct review
attempt is already server-owned by ADR-033. Browser checks cover the
CSRF-protected write, no-write continuation, source hide/show conclusion
control (including keyboard focus recovery), and the source panel at desktop
and narrow widths; local Compose evidence covers the real Axum/PostgreSQL
transaction for both open-practice and question completion.

**Limitations and trigger:** The bounded read-only source Learning trail is
available in Journal. Activity replay and competence links, fuller journal
timeline and competence presentation remain unavailable until their contracts
and browser evidence exist. Due revisit invitations, their dismiss/snooze
actions and review-attempt recording are now exposed through the lifted
original Journal panel and ADR-033's server-owned re-entry flow; no substitute
React control was added.

The existing authenticated journal read model now carries the bounded private
check-in trail and due, visible revisit-invitation projection required by that
future UI. Its private command now also permits only the source's two due
invitation actions: `snooze` postpones the same invitation for seven days and
`dismiss` hides it. The command resolves the invitation from the authenticated
principal, current map visibility and completed progress; it never accepts a
bare activity writer. It does not expose an activity-reentry URL. Browser
controls are exposed only after ADR-033's command could create and complete a
server-owned revisit run, consume the invitation and record the source review
attempt atomically.

## ADR-033: Revisit runs are separate from authored route progress

**Status:** Accepted — 5 November 2026

**Problem:** A source revisit begins from a due private invitation for one
already completed activity. It is not a reset of every activity in the route.
Reusing `learner_route_progress` for it would overwrite an ordinary active
route selected from a World drawer, let an invitation choose a generic route
start, or consume the invitation before the learner actually completed the
review. It would also make a revisit of an activity which is not an authored
start impossible.

**Decision:** Model a revisit as a distinct, server-owned run, anchored to the
check-in that scheduled it. Opening an invitation will lock and re-validate the
owner, due time, published content and map visibility, then create or resume
one active revisit run for that check-in. The browser receives only its opaque
run ID and normal playback context; it cannot select an activity, check-in or
review state.

A revisit run plays the invited activity only. It does not advance or reset an
ordinary authored route. On successful completion, in the same transaction,
the server records the source-defined review attempt and evidence attempt,
increments the activity attempt count, completes the revisit run, and consumes
the matching invitation. Leaving a run unfinished does not consume it, so it
can safely resume. While such a run is active, snooze/dismiss commands must
not alter the invitation underneath it. The existing playback endpoint family
may serve either authorized run kind, but every writer must resolve the run
kind under lock; the browser never supplies an `is_revisit` flag.

**Why:** This preserves the learner-visible source behavior while retaining
the Rust rule that every activity write is tied to a server-owned run. It
avoids corrupting unrelated route progress and makes review-attempt creation
auditable and retry-safe.

**Alternatives:** Reusing a route start/reset would change unrelated learner
state and excludes activities without a start. Accepting a check-in or
activity identifier in a normal completion request would weaken the ownership
boundary. Consuming on open would punish a learner for leaving or refreshing a
review. All are rejected.

**Current foundation:** The normalized revisit-run and review-attempt tables,
an owner/due/visibility-scoped open-or-resume command exposed only at
`POST /learner/revisit-invitations/{check_in_id}/open`, a run-kind-aware
playback reader, and transactional writers now exist. The open command accepts
only the opaque check-in ID, resolves its activity/run server-side, and is
idempotent while the run remains active. The reader returns an active revisit
as an activity-only run: it deliberately has no authored start or route label.
The three supported activity writers (`open_practice`, question and reflection)
resolve the run kind under lock.
For a revisit they complete only that run, increment its existing activity
attempt count, write one review attempt and record completion evidence through
the existing activity-evidence policy, and consume the matching invitation;
they do not advance or reset route progress. This was
verified against a rebuilt local Compose stack with disposable owner-scoped
records for all three activity types.

**Implementation evidence:** The corresponding original Journal invitation
panel has been lifted with its one-at-a-time pagination and
`Open activity`/`Later`/`Hide` controls. Its browser test verifies the desktop
and narrow viewport panel, a CSRF-protected defer, and navigation only after
the opaque server-owned run is returned. It does not expose a partial re-entry
link or an `is_revisit` browser parameter.

## ADR-034: Item grants are one persisted roll per authorized play run

**Status:** Accepted — 6 November 2026

**Problem:** The original item-grant activity is neither a browser-selected
inventory mutation nor an ordinary completion. It rolls a configured
probability once, gives the configured quantities only after success, returns
the same result on refresh, and can grant again when the learner starts a new
route run. Reusing a generic progress JSON field would make quantity changes
hard to audit and would not reliably protect retries from duplicate grants.

**Decision:** Add `learner_item_grants`, keyed by application principal,
activity and opaque server-issued play-run ID. The `grant-items` command locks
the active visible `item_grant` activity, derives its chance and configured
public item slugs from server content, and records a PostgreSQL-generated roll
with its result in the same transaction as the normalized holding increments.
The command accepts no item, quantity, probability or learner identity from the
browser. A repeated request returns the persisted success/failure and bounded
source display snapshot; it never increments a holding again. Completion must
prove that the current run has a persisted grant result, so both a successful
grant and the source's unsuccessful-roll auto-continue path remain valid, but
a browser cannot skip the roll. A new route run uses a new key and therefore
can roll and grant again as in Laravel.

The existing `learning_items` and `learner_item_holdings` tables remain the
content and inventory owners. `items[].itemId` is a public item slug in this
greenfield contract, mirroring the established tool-reference choice without
exposing UUIDs or Laravel numeric IDs. The React scene is adapted directly from
the original `ItemGrantActivity`, including its loading state, background,
item grid, flight effect, automatic unsuccessful-roll completion and continue
action.

**Why:** This makes the server the sole authority for randomness, configured
content, ownership, retry behavior and transition eligibility while preserving
the source interaction. It also gives future item obstacles a normalized,
queryable inventory fact rather than a frontend cache or metadata convention.

**Alternatives:** Accepting item IDs and quantities from React would let a
learner forge inventory. Reusing generic route-progress metadata would obscure
the one-per-run uniqueness and complicate holding reconciliation. Both are
rejected.

**Limitations and trigger:** This restores source item grants and their
source-defined consumer, the item obstacle (ADR-035). It does not expose
access-link item grants, NPC or answer rewards, authoring, or an inventory
editor. Those source behaviors need their own contracts, authorization and
directly lifted UI before any related control is exposed. The temporary 100
configured-display-item bound is an API payload safeguard; authoring validation
must make the eventual content bound explicit before Rust authoring is
introduced.

## ADR-035: Item obstacles retain learner state while each play run proves its own pass

**Status:** Accepted — 6 November 2026

**Problem:** The original `ItemObstacleActivity` has two distinct lifetimes.
Filled slots, failed attempts and an optional timed lock belong to a learner's
relationship with an authored obstacle and remain available across later route
entries. In contrast, completing a currently active activity must prove that
this particular opaque play run met the obstacle. A browser-only drag state or
a generic route-progress blob would either permit forged item consumption or
lose that distinction.

**Decision:** Store one normalized `learner_item_obstacle_states` row per
application principal and activity, plus one normalized filled-slot row per
principal/activity/source slot index. `itemId` in greenfield authored
`slots[]` is a public item slug, never a Laravel numeric identifier or a
database UUID. The place command locks the active, published, visible route
activity; verifies that the requested public item is exactly the configured
item for that source slot; decrements one held quantity only when the slot was
previously empty; and persists the slot in the same transaction. Repeating a
drop on a filled slot is idempotent and does not consume another item.

The source `continue` command derives whether all slots are met. A failed
continue increments the durable failed-attempt count and applies the authored
`lockMinutes` period where configured. A successful continue records the
current opaque `passed_play_run_id`; generic playback completion rejects an
item obstacle unless that value matches the active run. When source
`consumeOnEachEntry` is enabled, the successful continue clears persisted
filled slots after recording that run-specific pass, so the next entry again
requires items without allowing the current run to skip completion.

The read document includes the bounded held-item inventory, a safe projection
of configured obstacle item presentation, and the current persisted state.
The React activity is lifted from the original scene and uses its inventory
drag gesture; it sends only the public slug and configured slot position to
the versioned contract. Its inventory action bar remains source-derived. No
audio control is exposed in this slice because the source's sound/media
contract is not yet migrated.

**Why:** The separate durable state and current-run pass fact retain the
source's re-entry behavior while preserving server authority over inventory,
locks, configuration and progression. Normalized rows make consumption and
filled slots inspectable without coupling them to browser state or an
unstructured metadata document.

**Alternatives:** A client-side slot map could be changed or replayed and
cannot atomically consume a holding. A single route-progress flag would make a
past run incorrectly authorize a later one, especially when source reset-on-
entry is configured. Generic JSON metadata would obscure the inventory and
slot invariants. These options are rejected.

**Limitations and trigger:** This covers only the source item obstacle in an
ordinary route run. Base tool obstacles are covered separately in ADR-036;
NPC grants, obstacle authoring, audio and the other unsupported activity types remain absent until each has a dedicated
contract, server policy and lifted source UI. The current maximum of ten slots
and one hundred held items is a bounded API safeguard; authoring validation
must own any later content limits.

## ADR-036: Base obstacles prove an owned useful tool without conflating current and durable state

**Status:** Accepted — 6 November 2026

**Problem:** The original `ObstacleActivity` lets a learner select an owned
tool from the source action bar and use it on a configured target. Only tools
listed by the author are useful. The source `persistAfterSolved` setting has a
meaningful distinction: a persistent clear remains visible and usable on later
entries, while a non-persistent useful action is valid only for the current
entry. Treating either as a generic browser completion would permit a forged
tool or let a non-persistent clear leak into a later run.

**Decision:** `allowedToolIds[]` is a list of greenfield public tool slugs.
`POST /learner/play-runs/{run}/activities/{slug}/use-obstacle-tool` accepts
only one owned public slug. Under a lock, Rust resolves the active published
`obstacle`, verifies the learner owns the selected tool, compares it with the
configured list, and records a normalized current-run pass only for a useful
tool. If `persistAfterSolved` is true (the source default), it additionally
records a durable principal/activity resolution. Generic completion allows an
obstacle only with a matching current-run pass or the durable resolution;
therefore a prior persistent clear can be revisited while a non-persistent one
cannot authorize another run. The playback document supplies the bounded
owned-tool projection and safe authored visual state, never UUIDs or internal
ownership facts. React lifts the original scene, tool belt selection, target
click, tool animation and cleared/revisit presentation; it replaces only the
Laravel command with the typed Rust contract.

**Why:** Separate normalized facts make the source persistence rule explicit,
auditable and race-safe. They also keep public tool references and authoring
configuration behind the server's ownership and authorization boundary.

**Alternatives:** A browser `isResolved` flag could be forged or reused after a
refresh. A single permanent activity-progress flag would silently change
`persistAfterSolved=false` into a durable clear. A run-only record would lose
the source revisit behavior. These options are rejected.

**Limitations and trigger:** This is the base source obstacle in ordinary
route runs. It intentionally does not restore obstacle audio because the
global media/sound contract has not yet migrated, and it does not add authoring
or a generic tool-action API. Any other activity that uses a tool must define
its own server policy and lifted source UI.

## ADR-037: Recall is a private queue with a one-question run

**Status:** Accepted — 6 November 2026

**Problem:** The source recall queue lets a learner retain an individual
question, answer it again later, see a transparent next interval, defer it for
a day, or remove it. It is neither authored route progress nor a revisit of a
completed activity. Reusing an ordinary route run would advance its authored
transition or create evidence; treating recall as a browser flag would let a
caller choose another learner's question or cause a scheduling write without
an authorized attempt.

**Decision:** Store the learner-selected queue item separately in
`learner_recall_items`, unique by principal and question activity. A dedicated
`learner_recall_runs` record authorizes exactly one queued, visible, published
question. `POST /learner/play-runs/{run}/activities/{slug}/recall` can only
queue the current question in an existing server-owned run; it accepts no
activity identifier. The private queue lists at most 24 visible items, ordered
due first. Opening, postponing and removing resolve an opaque queue-item ID
under principal and visibility checks.

An answer in a recall run records the source schedule: an incorrect answer is
due in one day; consecutive correct answers use 1, 3, 7, 14 and then 30 days.
Completion records optional post-feedback confidence and completes only the
recall run. It does not advance, reset or complete an authored route, record
ordinary route progress, evidence, a topic visit, or an ordinary check-in.
Removing an item after opening leaves the already authorized run usable, but
later schedule updates safely have no queue item to change.

**Why:** Dedicated facts preserve the source's learner-controlled spacing
workflow while making its boundaries explicit and auditable. The opaque run
keeps question selection, publication/visibility checks, scheduling and
completion server-owned. It also prevents recall from silently changing
competence or progression semantics.

**Alternatives:** Reusing a route start would alter unrelated route state and
could make a one-question review advance an authored transition. Reusing the
revisit mechanism would incorrectly require completed progress and create its
evidence semantics. Accepting a question ID, an `is_recall` browser flag or a
client-computed interval would weaken the authorization and scheduling
boundary. These alternatives are rejected.

**Current evidence and limitations:** The React feedback and `/home` Recall
Queue are adapted from the original question and Learning Desk structures; the
only necessary transport adaptation is first obtaining the opaque recall run
before opening a question. Local authenticated Compose evidence covered queue,
open, answer, source interval, completion and the invariant that recall adds
neither route progress nor evidence. The route exposes only this source
section, not an invented substitute for the remainder of the Learning Desk.
Full desk sections, recall authoring/settings, media/audio and non-question
recall remain deferred until their source contracts and direct UI adaptations
exist.

## ADR-038: Competence remains a private qualitative reader with source context

**Status:** Accepted — 6 November 2026

**Problem:** The source Competence page combines a bounded private evidence
map with recent learner check-ins, revisit history, optional links to a formal
Topic with the same competence-category slug, and a link back to the newest
evidence activity. Returning only visual ratios would not supply the original
page's explanatory context. Conversely, generating Laravel URLs or exposing
unbounded event metadata would couple the new client to the old framework and
leak private material that the source page intentionally omits.

**Decision:** Keep `GET /api/v1/learner/competence` private and read-only. Its
bounded contract now carries the source-visible check-in direction and up to
three authored learning areas, plus review-attempt assistance and up to eight
observed cues. Each competence category independently resolves an optionally
published formal Topic with the same slug. Its revisit context comes from its
newest evidence event only when that activity is still published and visible to
the current learner; it does not fall back to an older event. Rust transports
public slugs and titles, not Laravel-generated URLs or database IDs. A later
lifted React page must obtain any opaque play run through the existing
server-authorized start/open contracts before navigating to activity playback.

The legacy `responseType` field is not represented in the greenfield review
attempt schema. It is deliberately absent rather than inferred from activity
configuration or invented in React. Reflection bodies, arbitrary review
metadata and evidence values outside the source reader remain absent as well.

**Why:** This retains the source page's qualitative explanations and its
separation between a competence category, a formal Topic, and the activity
where evidence happened. Slug-based transport keeps the API framework-neutral,
while the visibility check prevents an old private event from becoming a route
into content the learner cannot currently access.

**Alternatives:** Using the evidence activity's map Topic as the related Topic
would change the source behavior; the category and encounter Topic can differ.
Returning legacy href strings would make Laravel routing a durable contract.
Guessing `responseType` from other fields would present a claim the new data
model did not record. These alternatives are rejected.

**Review-attempt response detail:** A completed revisit now snapshots the
source-derived response type (`reflection`, `explain`, or `transfer`) alongside
the already bounded cue list. It is nullable for activity kinds without a
private reflection. The reader can therefore describe the completed attempt
without reading journal text or consulting mutable activity configuration.

**Limitations and trigger:** This is a contract foundation only. `/competence`
remains unavailable until the actual source React page and star-layout are
lifted and all of their links have authorized Rust destinations. The required
playback-opening contract still needs to be implemented and tested before its
original controls are exposed.

## ADR-039: Reflection saving and activity completion remain separate commands

**Status:** Accepted — 6 November 2026

**Problem:** The initial Rust reflection command wrote a private response and
advanced the active route in one operation. That matched the narrow seeded
base-reflection example, but not the source workflow. In the source, a learner
saves a response first, may read authored guidance and optionally save a
separate independent response, then deliberately continues the activity. A
single command would make the latter two steps impossible and would turn a
private save into an unintended route transition.

**Decision:** `POST /learner/play-runs/{play_run_id}/activities/{activity_slug}/reflection`
now saves only a bounded private response and returns `saved`. The existing
server-owned completion command advances a reflection activity only after it
finds a response for that same principal, run, activity and source-derived
response type. The client still automatically completes the currently migrated
base-reflection surface after saving, because it has no authored after-save
guidance. A future lifted source response surface can instead show its exact
guidance and independent-check controls before calling completion.

The save command derives `reflection`, `explain`, or `transfer` from authored
configuration; a transfer requires a changed context. It keeps only selected
cues that are currently authored, and rejects an independent check unless an
`explain` or `transfer` activity has its authored prompt. Completion uses the
latest matching saved explain/transfer response for its private evidence link,
including whether it was independent; base reflection remains qualitative
private writing rather than an observable explanation claim. The generic
completion command also accepts source confidence before and after feedback
only for question/reflection runs. For a revisit, it snapshots the matching
private response type and selected cues in the immutable review attempt.

The React player now lifts the source explain/transfer sequence: response focus,
optional initial confidence, transfer context, bounded authored cues, private
save, authored guidance, optional independent response, private side-by-side
comparison, independent-check feedback and optional later confidence. An
authored review intent on a reflection now receives the source learner-only
earlier-note reader (three newest matching topic/subtopic notes), optional
before/after confidence, bounded observed cues and optional `clearer`,
`connected` or `open` outcome. These controls use the existing source
markup/classes and the browser still has no authority to choose a response
type, activity, journal record, transition or evidence claim.

**Why:** This preserves the source's learner agency and order of operations,
keeps route progression server-owned, and prevents stale or browser-invented
cues, response types, journal categories and activity targets.

**Alternatives:** Continuing to advance during the save command would collapse
the source workflow. Letting the browser nominate a reflection record or
response type would make private evidence forgeable. Creating a second
completion endpoint just for reflection would duplicate the established
server-owned activity-completion boundary. These alternatives are rejected.

**Extension:** The standalone source `review` activity type is now an explicit
Rust playback type. It uses the same bounded reflection configuration and
private persistence workflow as the source, but remains distinct in the
OpenAPI activity union, server authorization/query allowlists, review-context
lookup, completion evidence and revisit eligibility. React lifts the original
review branch for either that activity type or an authored reflection review
intent; it does not infer review from browser input.

**Limitations and trigger:** Rust authoring APIs are not yet migrated, so
fresh review activities currently enter through the reviewed greenfield content
schema rather than a substitute authoring form. When authoring moves, expose
the same typed review configuration and add its authoring/browser evidence.
The base reflection UI continues to use its original immediate
save-then-continue behavior.

## ADR-040: Historical activity replay uses a dedicated opaque run

**Status:** Accepted — 6 November 2026

**Problem:** The source Journal and Competence readers link a learner back to
an activity they previously encountered. Rust deliberately does not transport
Laravel URLs or permit a browser to select a player activity directly. Reusing
an authored route run would overwrite current route state; reusing recall or a
due revisit would change their distinct scheduling and evidence semantics.

**Decision:** Add a CSRF-protected command that resolves a currently visible,
published activity under the authenticated learner, then creates or resumes a
private opaque replay run. The player accepts only that run ID. Replay runs are
separate from route, recall and due-revisit runs; they do not change an authored
route's position or satisfy a recall/revisit queue. A completed replay marks
the source activity complete, matching Laravel's direct historical entry, but
does not create route-run evidence or follow an authored transition. Question
and reflection/review writers, plus the migrated tool/item grant and obstacle
writers, resolve the same replay run under lock; browser input never chooses a
different activity or run kind.

**Why:** This preserves the original learner affordance while retaining
server-owned authorization and keeping independent learning-state meanings
separate.

**Alternatives:** A client-built activity URL, treating replay as a route start,
or overloading recall/revisit records would weaken authorization or alter
unrelated learner state. These are rejected.

**Implementation evidence:** `POST /learner/activities/{activity_slug}/replay`
now mints the run only after principal, current publication and map-role
visibility checks. It accepts the same currently migrated player types as an
ordinary route run: practice, question, reflection/review, Markdown, tool and
item grants, item obstacles and tool obstacles. The playback reader and their
applicable writers recognize its separate `replay` kind, and the
application-level unavailable case remains intentionally indistinguishable
from an unknown activity. The
lifted source Journal Learning trail and Competence learning-pulse, review and
topic-return controls restore their original activity-opening affordances
through that command. Browser tests verify their CSRF requests and opaque
navigation. The local Compose migration was applied and verified against the
separate application PostgreSQL database. The lifted Topic Trail's recent
reflection rows, competence evidence and return control now use the same
command; broader reflection-history controls remain unavailable until their
own source data and browser evidence are added.

## ADR-041: NPC dialogue is a server-owned authored graph

**Status:** Accepted — 6 November 2026

**Problem:** The source NPC dialogue player is not a generic chat surface. Its
authored graph has a start edge, monologue, question, answer, reflection and
end nodes; transitions, answer validity, private reflection, tool grants and
route completion depend on the active node. Letting React hold that graph state
or nominate the next node would allow skipped answers, arbitrary tool grants or
completion of an activity that was never reached.

**Decision:** Store each greenfield dialogue graph in normalized application
tables: `learning_npc_dialogue_nodes` and
`learning_npc_dialogue_transitions`. A node has an opaque UUID, source node
type, bounded learner-visible content/configuration and stable order; a
transition has an optional start source, a source connector and target node.
The Rust read projection exposes only a bounded, validated learner-safe graph.
It excludes authoring layout, internal IDs unrelated to the graph, unpublished
content and unapproved media/audio settings.

Each active route play run gets a durable, principal-owned dialogue state. The
API commands use only the opaque run and current activity path, then resolve
the current node and valid authored edge under transaction lock. Continuing a
monologue, selecting an answer, saving a reflection, stepping back and entering
an end node therefore cannot be forged by client graph state. An answer choice
is valid only when it is an outgoing authored answer edge of the active question.
Reflection writes remain private and must be accepted before that node can
advance. A configured tool grant is idempotent and server-resolved from the
entered graph node; it never accepts a browser tool identifier. Generic activity
completion remains unavailable until the run reached a valid authored end.

**Why:** Normalized graph rows preserve the source's meaningful authored
structure and give later authoring/import work a clear model, without copying
Laravel's model names or serialized progress blob. The run-scoped state retains
refresh/back behavior while keeping route progression and inventory ownership
inside PostgreSQL transactions.

**Alternatives:** Sending the graph and a client-selected next node back on
each request would make React a policy engine. Saving Laravel-shaped arbitrary
progress metadata would obscure graph and ownership invariants. Treating the
dialogue as a generic text activity would discard existing questions,
reflections and grants. These alternatives are rejected.

**Initial boundary:** The first Rust slice covers published dialogue in ordinary
route runs, including monologue, question/answer, reflection, configured tool
grant, back/refresh state and authorized end/route transition. Audio and
historical replay support wait for their respective media and replay evidence;
the route must not expose a partial dialogue until this entire initial graph
contract and source player are present.

**Implementation evidence:** Axum exposes run-scoped continue, answer, back
and private-reflection commands. The source-adapted React scene reads the safe
graph projection and keeps only selection, text entry, keyboard navigation and
presentation in the browser; Rust advances the graph, grants a configured
published tool, creates the private journal reflection, and permits completion
only after an authored end node. A fresh local demo graph covers every
supported node type. Its Playwright test exercises both the command path and
the rendered scene in the local Compose stack, including the retained journal
entry.

**Current visual boundary:** The lifted scene supports the source dialogue
frame, themed background/NPC image, authored per-node scene layers, character
entrance animation, typed text reveal, speech bubble, answers, reflection, tool-added
acknowledgement and source keyboard/end behavior. The standalone frontend
image includes the original public visual assets used by this projection.
Dialogue typing audio is now restored as a deliberately bounded contract. The
new application tables model named, defaultable dialogue typing-sound sets and
their 26 lowercase-letter sound references. A node may opt in and name a set by
opaque UUID; Rust projects only the opt-in set and the fallback default to an
authorized learner. The lifted player follows the source behaviour: it plays a
matching letter sound during text reveal, otherwise selects one available sound
from the set. The initial fresh set points only to the original bundled WAV
assets, which the standalone frontend image now serves. It is not a general
media feature and does not add audio upload, authoring, or a replacement sound
settings screen. The private Rust sound-preference contract retains source
defaults until its original Personal Settings UI is lifted.

## ADR-042: Learning Desk route continuation reuses World authority

**Status:** Accepted — 6 November 2026

**Problem:** The source Learning Desk separates an unfinished route from a
completed trace and lets the learner continue it. A client-created activity
URL, or a new desk-specific route-progress endpoint, could either bypass the
existing visibility checks or create a second owner of route resumption.

**Decision:** The restored Continue learning and Recent traces sections read
the existing authenticated World snapshot, which already applies map visibility
and returns the learner's in-progress and completed route-start handles. A
completed trace is omitted when the same map/node place has an in-progress
route, preserving the source Desk's single clear next step. Selecting Continue
or Revisit invokes the existing CSRF-protected `start` command for that opaque
handle. Rust returns the current server-owned play-run identifier; React merely
navigates to the resulting player URL. The desk does not determine the
activity, reset state or construct a run identity. The established command
resumes an unfinished run and starts a fresh opaque run for a completed route,
matching the Laravel controller's `startOrResume` behavior.

**Why:** This preserves the source interaction while retaining one route
authorization/read model and one writer. It also gives the migration a small,
testable first Learning Desk section without representing the unavailable
connections, history, reflection, preference or support sections as a new
dashboard.

**Alternatives:** A new desk-specific continuation API would duplicate the
same access and resume policy. A direct browser URL based on route or activity
slugs would be forgeable and would not resume the durable current run. Both are
rejected.

**Evidence and boundary:** The local Compose Playwright journey starts the
greenfield NPC dialogue, loads `/home`, finds its source-derived Continue
learning row, presses Continue, completes the route, then finds its Recent
traces row and presses Revisit. Both routes are verified to navigate only with
a server-returned opaque run. The earlier lifted Recall Queue and Return when
useful sections are unchanged. This is not a claim of complete Desk parity:
source bookmarks/connections, check-in reflections, saved planning and private
Learning Support replies still await their own safe read contracts and direct
source UI adaptations.

## ADR-043: Learning Desk saved-place rail reuses the private bookmark reader

**Status:** Accepted — 6 November 2026

**Problem:** The source Learning Desk's right-hand rail shows a pinned saved
place, a bounded list of saved places, and links back to the learner's original
World context. Adding another Desk-specific bookmark projection would duplicate
the existing private ownership and visibility query, while a browser-built list
from public World data could expose places the learner has not saved.

**Decision:** The Desk reads the existing authenticated `/learner/bookmarks`
contract. Its existing persistence reader now returns saved places newest first,
as the source Desk does. React chooses the first saved place matching the
current in-progress route as the pin, otherwise the first returned place. The
main-area Possible connections section excludes that pin, keeps at most three
remaining saved places, and preserves the source empty guidance until there is
enough context. Both it and the bounded rail use source-derived markup. Each
link returns to the existing World with the server-authorized map/node context;
no Desk bookmark writer is added.

**Why:** One reader remains responsible for principal ownership, visibility,
published-state filtering and bounded presentation data. The frontend keeps the
original visual hierarchy and uses only opaque-safe slugs already returned by
that reader.

**Alternatives:** Deriving the rail from a public World document loses the
private bookmark boundary. A new Desk endpoint repeats the same query and
creates another contract to secure and maintain. Both are rejected.

**Evidence and boundary:** The local Compose Playwright journey saves the NPC
route node through the existing CSRF-protected bookmark command, loads `/home`,
and verifies the Pinned for later rail and its View all bookmarks destination.
This restores the rail, saved-place list and Possible connections empty state;
topic labels, check-in reflections, planning preferences and private Learning
Support replies remain separate work at this decision's boundary.

## ADR-044: Learning Desk reflections reuse the private Journal reader

**Status:** Accepted — 6 November 2026

**Problem:** The source Learning Desk shows a short private trail of recent
check-ins and lets a learner reopen the related activity. Building a Desk-only
history query would repeat the Journal's ownership, publication and
visibility policy. A direct browser URL based on an activity slug would also
let the browser bypass the established replay authorization boundary.

**Decision:** The Desk reads the existing authenticated `/learner/journal`
document and takes its four newest server-ordered check-ins. It renders the
source-derived Recent reflections section, including feeling, recorded date,
activity/place label, optional private note and selected next direction.
Selecting either activity control uses the existing CSRF-protected
`POST /learner/activities/{activity_slug}/replay` command. Rust resolves the
currently visible published activity and returns the opaque play-run identity;
React only navigates to that returned run.

**Why:** The Journal reader already scopes check-ins to the signed-in learner
and keeps the private, published-content boundary in PostgreSQL. The replay
command remains the single authorization point for historical activity access.
This restores a source interaction without adding an overlapping read model or
trusting a client-created player URL.

**Related-area context:** Journal check-ins carry at most three validated,
authored learning areas plus the published source map-topic slug. React renders
these source links only for a `related` check-in and enters the existing Star
Map with the original `topic` and `from` context preserved. An unpublished map
topic remains null and cannot become a browser link authority. Planning
preferences and Learning Support remain separate slices.

**Evidence and boundary:** The local Compose browser journey completes the
server-owned NPC dialogue, records a private check-in through the existing
post-completion command, finds its reflection on `/home`, and opens it through
an opaque replay run. This is a bounded reflection trail, not complete Desk
or Journal-history parity.

## ADR-045: Learning Desk planning choices are private application preferences

**Status:** Accepted — 6 November 2026

**Problem:** The source Continue learning section lets a learner narrow their
own in-progress routes by one authored learning purpose and optional time
guide, then explicitly remember those choices for their account. Browser-only
state loses the cross-device account behavior; storing it with passwords or
sessions would violate the accepted identity/application database boundary.

**Decision:** Add an application-database `learner_desk_planning_preferences`
row keyed only by the existing opaque application principal. The typed
same-origin `GET`/CSRF-protected `PATCH /learner/desk-planning-preference`
contract permits only the Laravel values: `any` or one of the seven authored
purposes, and `any`, 15 or 30 minutes. A missing row returns source defaults
with `is_saved: false`; an explicit save upserts the private row. The World
start projection reuses the same bounded purpose and time-guide interpretation
already used by Paths. React applies filters only to visible in-progress
routes, offers the original recovery controls, and never treats either value
as intent, progress, a deadline, or a recommendation.

**Why:** The preference belongs to learner application data, but is distinct
from activity progression and credentials. A normalized row is narrower and
more inspectable than copying Laravel's general JSON settings blob. Reusing
the Paths projection avoids divergent interpretations of authored metadata.

**Alternatives:** A local-only preference loses the original account behavior.
Putting it in the identity database mixes learning presentation with credential
and session concerns. A new recommendation endpoint would change the product
meaning. All are rejected.

**Evidence and boundary:** The local Compose Playwright journey creates an
in-progress source route, chooses `Participate`, saves it through the
CSRF-protected contract, reloads `/home`, and observes the retained selected
filter. The slice does not add scheduling, route ranking, new authored data or
Learning Support replies.

## ADR-046: Learning Desk route context is a read-only World sub-projection

**Status:** Accepted — 6 November 2026

**Problem:** The source Continue learning and Recent traces rows show more
than a route label: they retain map-place artwork, published map-topic context,
authored learning-area links, purpose, time guide, timestamps and a current
step. The current Rust Desk reused the authorized World snapshot but discarded
that presentation context, producing an incomplete approximation. Creating a
second Desk route query would duplicate the World visibility and learner-route
scope policy.

**Decision:** Extend each existing `LearnerActivityStart` with a bounded,
read-only `desk` sub-projection. It includes only the source row's current-step
title, normalized learning purpose, positive time guide, up to twenty valid
authored learning areas, and a topic only when the map's topic is published.
For an in-progress route it derives authored context from the current activity;
for a completed route it derives it from the start activity. The source
start-card fields remain unchanged, so the World drawer and the Desk do not
silently acquire different meanings for the same route start.

**Why:** The World reader already enforces visible map/node/asset/route scope
for the authenticated principal. A narrow nested projection reuses that policy
and provides the source UI with context without granting a run, exposing a
database ID, or introducing a competing Desk endpoint. React adapts the source
route-row markup and continues to use the existing CSRF-protected opaque
start command for every action.

**Alternatives:** A browser-side join with Topics or Paths would weaken
visibility and current-activity semantics. A Desk-specific query would repeat
the same authorization logic. Reusing the start activity for in-progress rows
was rejected because the source uses the current activity when one exists.

**Evidence and boundary:** Workspace tests cover the bounded authored metadata
parser; the frontend contract is generated from OpenAPI and the local Compose
browser journey verifies the Desk with a real authorized World snapshot. This
is read-only presentation parity: it does not change progression, route
selection, topic publication, data ownership or media storage.

## ADR-047: Learning Desk content search is an authenticated source-ordered reader

**Status:** Accepted — 6 November 2026

**Problem:** The source Learning Desk contains a compact content search above
its local Desk areas. It returns published topics first, followed by maps and
places the current learner may see. The existing Rust public search instead
returns map assets for the World explorer. Reusing it would omit topics, apply
the wrong result shape and blur the public/learner visibility boundary.

**Decision:** Add the typed authenticated `GET /api/v1/learner/search`
reader. It accepts the source `query`, `page` and `per_page` parameters and
preserves the source's 5-item frontend default, 24-item server maximum,
literal case-insensitive matching, deterministic topic/map/node category
order, title/identifier ordering within a category, visible-map role scope,
hidden-place exclusion and locked-place label. The result contains only a
presentation key, title/subtitle and source-equivalent destination slugs; no
database identifier is accepted by a writer. React lifts the original Desk
search markup, debounce, result-panel pagination and first-result submit
behavior, navigating only to existing typed React destinations. The legacy
standalone `/learning/search` URL stays unavailable.

The fresh schema currently has one published World. The reader selects that
sole current World deterministically (earliest published-world record) instead
of silently broadening search across future Worlds. Before more than one
published World is supported, replace that temporary locator with explicit
current-World metadata or a resolver contract; this is an extraction trigger,
not a permanent multi-World policy.

**Why:** A small authenticated reader keeps search policy in PostgreSQL, lets
the browser reuse the original component without reconstructing content or
role policy, and leaves public World asset search independent. It restores a
visible source interaction without inventing a generic search page.

**Alternatives:** Extending public asset search would expose the wrong content
model and cannot express learner map scope. Fetching topics, maps and nodes
separately in React would duplicate ordering and access policy outside the
server. Introducing a new standalone search route would change the source
information architecture. All are rejected.

**Evidence and boundary:** Application and persistence tests cover bounds,
literal wildcard escaping and cross-category pagination. The generated OpenAPI
client and browser test cover the original Desk field, typed request and
source destination. This reader neither creates learner state nor grants a
play run; private Learning Support replies remain a later contract.

## ADR-048: Learning Support requires an application capability boundary before migration

**Status:** Accepted — 6 November 2026

**Problem:** The remaining Learning Desk Support section is not an independent
list of text. In the source it is the learner-facing endpoint of a complete
message flow: a learner submits one private request through a message-prompt
activity, authorized support staff moderate it and create a private reply, and
only that learner can see the response in the activity or on the Desk. The
current Rust foundation has a single `platform_administrator` application role
and no capability model equivalent to the source `learner_messages` read/
update/delete permissions. Treating every administrator as permanent Learning
Support, or exposing a reply writer before that boundary exists, would change
the source authorization behavior.

**Decision:** Do not add an empty Desk Support reader or a browser-side
substitute. Before migrating `message_prompt`, private support replies and the
source moderation panel, extend the application role model with an explicit
server-owned capability boundary for learner-message moderation. The bootstrap
administrator may hold that capability as part of its full platform authority,
but support access must be independently assignable and checked at every
message, response, visibility and deletion command. The learner's private
message reader remains separate: it must be scoped by the requesting
application principal, published map visibility and the support audience.

**Why:** This preserves the existing distinction between a learner requesting
help, a support worker responding, and a platform administrator maintaining
the service. It also gives peer walls, shared tasks and later organizations a
reusable application authorization boundary without putting permissions or
learner data in the identity database.

**Alternatives:** Mapping message moderation permanently to
`platform_administrator` would omit a source role boundary. Replaying Laravel
role tables would contradict the greenfield persistence decision. Building the
Desk response reader first would create a visible but unreachable feature and
would encourage bypassing moderation to populate it. All are rejected.

**Implementation trigger and boundary:** The next collaboration slice begins
with the capability/role migration, then migrates the complete private support
request and reply path with source-derived activity and moderation UI, CSRF,
ownership, map-scope and cross-learner authorization tests. Peer walls,
peer-to-peer responses, helpfulness markers and shared-task moderation remain
separate follow-on capabilities; none may be represented as completed by the
private-support slice.

**Foundation implemented:** The greenfield application database now separates
assignable roles from server-owned capabilities. `learning_support` and
`platform_administrator` both grant `learner_messages_moderate`; the latter
does not make the former redundant, because a support assignment can be made
without full platform administration. The authenticated application principal
loads its effective capabilities alongside its map-audience roles, and future
message commands must use the typed capability check rather than matching a
role name. This foundation now supports the separately documented private
support slice below.

## ADR-049: Private Learning Support is a bounded two-database moderation slice

**Status:** Accepted — 6 November 2026

**Problem:** A private support request belongs to application data and must
remain visible only to its author and authorized support staff. Staff still
need enough identity context to answer a request, but the separate identity
database intentionally owns sign-in addresses while the application database
owns message records and authorization roles. Returning author data from the
learner reader, or copying profiles into message rows, would weaken either the
privacy boundary or the accepted database separation.

**Decision:** The learner path is modelled as one source-derived private
`message_prompt`: an owned active route/replay run resolves its configured
support topic; one trimmed 2–280 character request is inserted per
topic/principal; only visible replies are returned to that same learner, both
in activity playback and as a bounded twelve-item Learning Desk reader. A
hidden request still consumes the learner's one contribution, matching the
source moderation behavior without re-exposing its body.

The staff path is a separate capability-gated contract. It lists only topics
with private-support requests and pages six requests at a time, with at most
three replies per request. Every route checks
`learner_messages_moderate` through the typed application principal before its
repository is called. The adapter joins application records to the identity
database only after that check, projecting the author's opaque subject ID and
normalized email for that authorized staff response. No learner endpoint uses
this projection. A staff member can create or update only their own bounded
reply; the SQL uniqueness constraint on `(message_id, responder_principal_id)`
preserves the source's per-responder update behavior.

The same capability now guards dedicated hide/restore and deletion commands
for a private request and a private reply. Visibility commands update
`hidden_at` and the accountable application principal atomically in the
application database. Deleting a request uses the established database
cascade to delete its replies; deleting a reply affects only that reply. This
matches the source controller's deletion ownership. Learner readers omit
hidden replies and omit a hidden request body, while the request's existence
still enforces the source one-request limit. Authorized staff readers retain
hidden records so they can restore them. The source-derived private-support
portion of that control is exposed at
`/settings?panel=admin-learning-support&support=learner-messages`. The
subsequent peer-message extension is recorded separately in ADR-051 so this
private-support decision stays reviewable on its own. The browser uses the
currently known Learning Support and platform-administrator roles only to keep
the incomplete route out of ordinary learner navigation; the API capability
check remains the access-control authority.

**Why:** This retains source ownership, audience, first-request and reply
semantics while keeping credentials, password hashes and message data in their
respective databases. The narrow identity projection makes the exceptional
cross-database read auditable instead of creating a duplicate profile store or
letting the browser join two sources.

**Alternatives:** Storing email with each message would duplicate identity
profile data and make future correction/removal harder. Giving learners a
generic message listing would reveal other requests or staff identity.
Treating the staff browser as a database client would bypass the server-owned
capability boundary. All are rejected.

**Evidence and boundary:** Unit tests prove reply validation and explicit
capability denial paths. The local Compose API journey starts the original
orientation route, submits a first-only request, lists it through the staff
contract, creates then updates a staff reply, hides/restores both kinds of
record, deletes the reply and then the request, and confirms those deletions
through the staff reader. It also confirms that the learner reader withholds
hidden content while retaining the one-request rule before completing the
activity. The learner-facing request and Desk panels reuse lifted original
components. A local Compose browser test signs in an authorized worker and
opens the source-derived private-support moderation workspace. The full source
Settings shell remains unmigrated; the separate learner-facing peer prompt/wall
activity is recorded in ADR-050 and its staff moderation extension in ADR-051.

## ADR-050: Learner peer messages preserve source activity and visibility boundaries

**Status:** Accepted — 6 November 2026

**Problem:** The source peer-message flow is not a generic public discussion
board. A learner may optionally contribute once through a configured
`message_prompt`; a later configured `message_wall` shows only visible notes
for the same topic. The source then permits one response per learner/message,
never to the learner's own note, and lets only the note author choose one
visible response as helpful. Joining a topic from the browser, trusting a
message identifier from another route, or treating the wall as the
contribution form would change those rules.

**Decision:** Keep prompt, wall, contribution, response and helpfulness as
separate typed endpoints under the current opaque play run and activity slug.
Every repository operation resolves the current application principal, active
route progress, activity type, `peers` audience, configured topic and its map
asset before it can read or write. The prompt accepts one trimmed 2–280
character contribution per topic/principal and is optional at completion. The
wall returns only visible peer notes, in the source's newest-page-then-random
order, with a server maximum of twelve entries (the original client asks for
ten on desktop and three on narrow screens). It returns the three newest
visible responses and also a marked-helpful response when it would otherwise
fall outside that set. A response is unique per message/principal and may not
target the principal's own note. Helpful selection locks and validates the
selected visible response before clearing any prior marker for that note.

The React components are adapted from the source message prompt/wall rather
than reconstructed. The ordinary playback reader uses the existing secured
message-activity path for both message activity types, retaining the map/topic
join that prevents a malformed configuration from exposing a cross-map form.
The existing source check-in follows prompt completion before the player loads
the wall.

**Why:** This retains source sequencing, anonymity, contribution limits and
author-only helpfulness while keeping activity ownership, topic selection and
visibility policy on the Rust side. The shared message table supports the
already-migrated private-support slice without conflating `support` and
`peers` audiences.

**Alternatives:** A standalone peer-wall route would make a shared discussion
surface available outside its authored activity. Browser-side topic IDs or
page-wide message lookups would bypass current-run/map authorization. An
improvised staff peer view would create a visible moderation workflow before
the corresponding source filters and commands are migrated. All are rejected.

**Evidence and boundary:** The application and persistence tests enforce
input bounds and source response types; the OpenAPI-generated client checks
the request/response boundary. A local Compose browser test takes a new
learner from the source-shaped support prompt through the peer prompt, the
ordinary optional check-in and the rendered original wall, confirming the
posted note in both its wall API response and visible card. Staff moderation
of that note is recorded in ADR-051. This does not migrate arbitrary topic
browsing, legacy data or production routing.

## ADR-051: One capability-gated staff workspace moderates source learner messages

**Status:** Accepted — 6 November 2026

**Problem:** The source Learner Messages workspace moderates both private
support requests and peer-wall contributions. Leaving the existing Rust staff
surface restricted to `support` audience messages after peer-wall playback
existed would prevent an authorized worker from applying the source
hide/restore and deletion controls to peer content. Creating a separate,
newly designed peer administration view would repeat the earlier UI deviation
and split one source authorization boundary across unrelated contracts.

**Decision:** Extend the existing `learner_messages_moderate` capability and
source-adapted staff workspace rather than adding a peer-specific role or
screen. The staff topic reader now includes both `support` and `peers`
messages and exposes the source's six-message page, three-response page and
three filters: all, learner-confirmed helpful and needing learner
confirmation. An authorized worker may hide, restore or delete either kind of
message or response. Staff may still create/update a reply only for a private
support request; peer responses remain learner-to-learner activity behavior.

The application database remains authoritative for message, response,
visibility, helpfulness and accountable-moderator state. Only after the
capability check does the persistence adapter read the identity database to
show the already-accepted limited opaque-subject and email projection. It does
not manufacture profile names. The OpenAPI contract calls the shared topic
total `message_count`, rather than carrying the earlier support-only
`request_count` name into the broader reader.

**Why:** This preserves the source's single workspace and capability boundary,
reuses the proven two-database privacy model, and lets moderation immediately
affect the learner wall without exposing browser-selected audience, identity or
message ownership controls.

**Alternatives:** A separate peer moderator role would invent a distinction
absent from the source. Allowing staff to reply publicly to peer notes would
change the source interaction model. Returning full learner profiles or
copying email into application message rows would violate the accepted
identity/application database separation. All are rejected.

**Evidence and boundary:** Application tests constrain the source filter
vocabulary; the workspace, contract and generated client build together. A
local Compose browser journey creates a peer note through its original
playback, verifies it on the wall, hides it through the capability-gated staff
endpoint and confirms it disappears from the wall, restores it, then confirms
it in the source-derived staff panel. The existing private-support journey
remains covered separately. This is not full Settings, organization, authoring
or user-management migration, and does not make peer messages a public
browsing surface.

## ADR-052: Shared Task stays activity-scoped, anonymous and threshold-gated

**Status:** Accepted — 6 November 2026

**Problem:** The source Shared Task combines an activity-wide contribution
counter with learner-private submissions, explicit anonymous sharing, optional
anonymous peer review, private contributor follow-up and a per-run project
checklist. Splitting these into a public feed, generic review endpoint or
browser-managed completion would leak context or allow an incomplete activity
to advance.

**Decision:** Use separate application-database submissions, reviews,
contributor-owned follow-ups and run-scoped checklists. Each command resolves
the authenticated application principal and current normal route run before it
accepts browser values. Configuration is validated and safely projected;
sharing is opt-in, contribution/review lists are capped at five and excerpts at
500 characters. Review requires an eligible contributor and another learner's
opted-in submission, and is unique per reviewer/activity. Reviewer identity is
never serialized. A contributor alone may mark a received review helpful,
store a private follow-up, or revise once after feedback. Checklist state is
private to `(principal, play run, activity)`.

Shared Task is admitted only on an active ordinary route run. Replay, recall
and revisit routes remain excluded. Completion counts accepted submissions
against the validated threshold inside the server transaction, so a browser
request cannot forge shared progress.

**Why:** This preserves source cooperation and privacy without creating a
standalone social surface, duplicating authorization in React or turning a
private planning aid into public learner measurement.

**Alternatives:** A global contribution/review feed loses the authored
activity boundary. Client-side threshold checks can be bypassed. Returning
reviewer identities changes the anonymous source interaction. Storing the
checklist with a contribution makes a per-run planning state permanent or
shared. All are rejected.

**Evidence and boundary:** OpenAPI defines typed commands and bounded
anonymous projections; generated TypeScript builds with React. The local
Compose browser test uses two fresh identities to prove route sequencing,
anonymity, review, helpfulness, follow-up, revision, checklist and the lifted
activity frame. This does not migrate Shared Task authoring/editor UI,
organizations, generic discussion or production routing.

## ADR-053: Portal travel uses an opaque arrival run, not a target route start

**Status:** Accepted — 6 November 2026

**Problem:** The source Portal activity lets a learner leave an ordinary route
and view an authored input portal at another place. Letting React select a
node, activity or target route would permit a forged destination and could
reset or join unrelated learner progress at that place.

**Decision:** Model every authored portal as a source activity/node to target
input activity/node link. The travel command validates the caller's active
source route, source and target publication/role scope, exact link, portal
modes and server-calculated destination availability. It completes the source
activity and creates one principal-owned opaque arrival run, keyed uniquely to
the source run/activity. The browser receives only the target node slug needed
for navigation and that opaque arrival identifier. Retrying while the arrival
is active returns the same identifier. The arrival playback can complete only
its input portal; it cannot reset, resume or advance a target route.

**Why:** This preserves the original travel/arrival interaction and optional
departure check-in while keeping graph authority, availability and all progress
state on the server. It also avoids treating a visual portal as a generic
browser navigation link.

**Alternatives:** Posting a target activity or node from the browser would
trust client graph selection. Starting the target route would incorrectly
couple travel to route-progress reset/resume semantics. Both are rejected.

**Evidence and boundary:** The OpenAPI contract exposes presentation-only
destination details and one travel command. Rust tests cover the application
absence boundary; the local Compose browser/API journey verifies source start,
idempotent travel, opaque arrival playback and target completion. This does
not migrate portal authoring, arbitrary map navigation or production routing.

## ADR-054: Learner sound preferences are private application data

**Status:** Accepted — 6 November 2026

**Decision:** Store mute, effects volume and ambience volume in an
application-database record owned by the application principal. Rust exposes
only owner-scoped read/save endpoints with source-equivalent defaults and
0–100 validation. Dialogue typing audio reads the saved effects setting. The
earlier standalone account-menu modal was removed because it was not the
original Personal Settings UI. The source-adapted Sound settings slice is
available at `/settings?panel=personal&personal=sound`, including its mute,
volume and local preview controls.

**Why:** Audio comfort is personal and must neither be coupled to identity
credentials nor alter shared authored content. One small preference contract
also gives future ambience and effects a common policy instead of each activity
inventing local browser state.

**Boundary:** This does not yet migrate reusable authored sound records,
uploads or activity effect configuration. The subsequent published ambience
projection is recorded in ADR-055; item-obstacle effects remain deferred.

## ADR-055: Activity ambience is a bounded published-media playback projection

**Status:** Accepted — 6 November 2026

**Problem:** The source activity player can start one authored ambient sound
while a learner is in an activity. Sending the raw activity configuration to
the browser and letting it treat any configured URL as audio would make the
browser a media authorization and validation authority. It would also bypass
the existing learner mute/ambience preferences.

**Decision:** Add a small published `learning_sounds` store and give the
playback activity contract an explicit, bounded `sounds` collection. Rust
copies an ambience reference into the otherwise safe activity configuration
only when it is explicitly enabled and contains a valid sound UUID. It then
loads only that referenced row when it is published. The browser matches the
safe reference to this projection; it never derives an audio URL from raw
configuration. The source-derived player starts/stops the supplied sound with
its loop, optional duration and authored volume, multiplied by the learner's
saved ambience preference. Saving those preferences notifies an already-open
player immediately.

**Why:** This restores the source behavior without creating a general media
reader, letting unpublished or malformed records reach the browser, or
duplicating private comfort policy in each activity implementation.

**Alternatives:** Returning all sound records would overexpose unpublished
authoring state. Passing a raw URL in activity JSON would bypass the
published-media boundary. Treating ambience as an effect would apply the wrong
preference category. All are rejected.

**Evidence and boundary:** The OpenAPI contract makes the playback-sound
projection explicit and generates the browser type. The local Compose browser
test starts the source-shaped Portal activity, verifies the safe configuration
and published sound projection, and observes playback of the bundled local
asset. The existing Portal browser journey still passes. This is not an
authoring or upload surface, protected media delivery, object storage, or
item-obstacle effect migration.

## ADR-056: Item-obstacle sound effects retain source event semantics

**Status:** Accepted — 6 November 2026

**Problem:** The source item-obstacle activity can play different effects when
the learner first sees an unmet obstacle, fills its final slot, and then sees
the met state. A generic `sounds` object would permit unknown browser-triggered
events or expose unrelated authored media. Using the ambient category would
also ignore the source distinction between scene audio and a short effect.

**Decision:** Preserve only the source event keys `notMet`, `transition` and
`met` in a safe item-obstacle configuration. Each must be enabled and contain
a valid sound UUID before it is projected. The existing playback sound loader
then returns only referenced published rows, bounded to the activity's
ambience plus these three effects. The source-adapted item-obstacle component
plays `notMet` on its initial unmet state, then `transition` and `met` when a
valid placement changes the state to met. It uses the learner's effects-volume
and mute controls, retaining separate concurrent event layers where the source
does.

**Why:** This restores the original feedback timing while retaining server
authority over event vocabulary, media publication and URLs. The player still
does not turn an item placement request into an audio selection request.

**Alternatives:** A general browser-callable sound endpoint would create a
new media action absent from the source. Reusing the ambience field would
lose the event distinction and apply the wrong learner preference. Both are
rejected.

**Evidence and boundary:** A persistence test rejects malformed and invented
event configuration. The local Compose browser journey receives the fresh
signal-stone item, completes the existing optional check-in transition, then
places it in the source-derived obstacle and observes the bundled effect on
initial and met-state events. This does not migrate base-obstacle audio,
authoring/upload UI, protected audio delivery or object storage.

## ADR-057: Invitation registration provisions identity before application access

**Status:** Accepted — 6 November 2026

**Problem:** The source registration page is invitation-only: a valid token,
name, email, matching password and password confirmation create an account.
The new platform deliberately keeps credentials and profile data in a separate
identity database, while every signed-in learner also needs an application
principal. There can be no cross-database foreign key or transaction. The
Laravel `User` model does not implement `MustVerifyEmail`, so source
registration is not held pending email verification even though Fortify has
verification routes.

**Decision:** Lift the source `/register` form and its login cross-link. Its
typed `POST /registration` contract validates the bounded source-shaped input,
uses the maintained Argon2id password helper, and accepts only a one-use,
unexpired invitation whose SHA-256 digest is stored in the identity database.
It creates the identity profile and credential as `provisioning`, consumes the
invitation, creates the separate application principal, then activates the
identity and establishes the normal server-side session. A failure after the
identity commit compensates by removing the application principal and identity
subject and releasing the invitation. The browser receives one generic `422`
for a duplicate address, bad invitation or malformed usable registration
detail, preventing identity/token enumeration.

Every fresh invitation account receives the source baseline `learner` role,
so it is immediately a usable authenticated learner rather than a roleless
principal. Elevated role grants remain part of the future, authorization-gated
administration token workflow; the temporary local issuer cannot silently mint
an administrator.

Signed-in users may also create this same default-learner, one-use invitation
through the typed Rust contract. It validates the source's optional future
expiry and 500-character note limit, stores only the digest, and returns the
plaintext once to its creator. This deliberately preserves the source's normal
user invitation capability without exposing the incomplete source
administrator user-management surface or allowing a caller to choose roles.

The lifted source registration form also submits its existing Light/Dark choice.
Rust persists that non-secret, private preference with the application
principal—not with the password, profile or session in the identity database—
and includes it in the authenticated current-user response. The React shell
therefore restores an account's saved choice after registration or a later
login, while its existing browser storage continues to make the public shell
respond immediately. The lifted, single-section source Appearance settings
surface updates that same value through a CSRF-protected owner-scoped command.
The other Personal settings controls remain unavailable until their own source
UI and Rust contracts are ready.

An operator-only `issue-registration-token` command creates a high-entropy
token and writes it once to an explicit private file; it stores neither the
raw token nor a password in the database, logs or repository. The initial
public presentation contract has an explicit `register` theme slot rather than
silently borrowing the login theme.

**Why:** This retains the source journey and the accepted identity/application
separation without hand-rolled cryptography, credentials in application data,
or a distributed database transaction. The temporary local operational path
allows the complete fresh-account browser slice to be exercised before the
source administrator UI has its own authorization contract.

**Alternatives:** Activating identity before application provisioning risks an
account that can authenticate without application authority. Copying profile or
credential data into the application database breaks the accepted boundary.
Keeping appearance only in browser storage would lose the source account
preference; putting it in the identity database would blur credentials and
application state. Adding a generic setting API before its original UI would
invent a partial learner workflow.
Storing plaintext tokens, printing them, or adding a public token-issue route
would make an invitation secret unnecessarily durable or broadly reachable.
All are rejected.

**Limits and follow-up:** The workflow compensates ordinary failed operations,
but a process crash between independent database commits still requires a
future audited reconciliation job before a pilot. Token expiry selection,
revocation/listing, role grants and the source administrator token-management
screen remain separate identity-access work. Password recovery, MFA, passkeys,
durable account auditing and a confirmed source-aligned email-verification
policy remain
cutover gates; this is not production identity authorization.

## ADR-058: Learning Groups are member-scoped collaboration in the application database

**Status:** Accepted — 6 November 2026

**Problem:** The source World Groups control is a private collaboration flow:
only members can read or post in a group, it exposes member names and email
addresses, retains at most forty messages, supports a help-request resolution
rule, limits consecutive messages, and records member consent for staff-chat
visibility. The fresh architecture separates application records from
identity/profile data, so copying users or credential data into group tables
would violate the accepted database boundary.

**Decision:** Store groups, memberships, messages, help-request resolutions
and one-vote-per-member staff-chat consent entirely in the application
database. They reference `application_principals`, never identity credential
tables. The member reader first proves the caller is a group member in that
database and only then obtains the minimal source-required display-name/email
projection from the identity database. All group writer commands use a
transaction and lock the group row before evaluating member state. This makes
the source two-consecutive-messages-per-minute rule safe under concurrent
posts, keeps help-request resolution idempotent for another member, and
computes the source majority threshold `floor(member_count / 2) + 1`.

The versioned `/learner/groups` contract exposes bounded, source-ordered
member projections only. A group, message or action unavailable to the caller
is deliberately indistinguishable from an unavailable resource; the Rust
contract does not turn membership or message state into a cross-user lookup
oracle.

**Why:** This preserves the source collaboration behavior while respecting the
identity/application split and avoiding a hand-rolled chat or a browser-owned
authorization rule. PostgreSQL constraints additionally prevent a non-help
message or the original author from being recorded as resolved.

**Alternatives:** Storing display names/emails with group membership would
duplicate identity data and create a stale cross-database ownership problem.
Returning all group rows then filtering in React would disclose private group
membership. An external chat service would create a new authority and delivery
model not present in the source. These alternatives are rejected.

**Evidence and limits:** The local Compose migration applies the fresh schema;
transactional PostgreSQL checks prove that invalid and self-resolution rows are
rejected, and the source-derived World Groups control has an authenticated
browser journey for loading a member group and sending a message. Group
creation/member management and staff moderation remain separate
authorization-gated administration slices; no placeholder administration UI
is exposed.

## ADR-059: Learning Group administration follows the source consent boundary

**Status:** Accepted — 6 November 2026

**Problem:** The source administration panel creates and edits groups, assigns
members, and shows chat only after the group's consent policy permits staff
viewing. Its authorization also supports source access scopes (all, creator or
assigned manager), which are broader than the currently migrated Rust role
model.

**Decision:** Add a dedicated `learning_groups_manage` capability and grant it
only to the existing `platform_administrator` role. The typed `/admin/learning-groups`
contract returns the source-shaped group editor projection and the bounded
staff-visible chat preview; it is unavailable to every other role. It validates
the source form bounds, records the creating application principal, preserves
an existing member's join time and role, and uses a transaction with a group-row
lock for membership replacement. A changed membership clears consent votes;
adding a member also disables current chat visibility and records its end time,
exactly as the source does. The React panel is adapted from the original
`access-group-management-panel.tsx`, replacing only Inertia transport with the
generated OpenAPI client.

**Why:** This makes group creation and assignment usable in the replatform
without copying profile/credential data into the application database or
inventing a separate staff-chat policy. Platform administrator maps to the
source's all-scope administrator behavior, which is the only source access
scope represented by the Rust authorization model today.

**Alternatives:** Giving every group creator or member management access would
silently bypass the source permission catalogue. Exposing a look-alike form
that writes browser state only would make a misleading administration surface.
Reimplementing the full generic source role/access editor first would block a
small dependent collaboration slice behind unrelated administration work.

**Limits and follow-up:** Creator and assigned-manager scopes will be enabled
only alongside the source role-management/access-capability administration
slice. The group editor does not assign `manager` membership roles because the
source UI also preserves rather than edits them. Map editing-group assignments
and broader staff moderation remain separate authoring/support slices.

## ADR-060: Password replacement remains an identity-owned, session-safe operation

**Status:** Accepted — 6 November 2026

**Problem:** The original Personal Security panel requires the current password,
a replacement password and matching confirmation. Credential hashes must remain
in the separate identity database, yet a successful replacement must not leave
the active browser unexpectedly signed out or preserve other sessions that
were authenticated with the prior password.

**Decision:** The typed `PATCH /account/password` contract is authenticated,
same-origin CSRF protected and accepts only the three source form fields. It
checks the current password with the maintained Argon2id verifier, validates
the existing bounded password policy, and atomically replaces only the matching
credential hash in the identity database. It then refreshes the initiating
browser's server-side session with the replacement verifier. Existing sessions
are already bound to that verifier by `axum-login`; sessions carrying the
prior verifier therefore cease to authenticate on their next request. The React page is adapted from
the source Security panel and exposes only its usable password form.

**Why:** This retains the source's current-password confirmation journey while
respecting the accepted identity/application database boundary. Reusing the
existing Argon2id library and server-side session machinery avoids custom
cryptography, client-held credentials, or an application-data copy of a
password hash.

**Alternatives:** Signing every browser out after a successful password change
would be a visible regression from the source journey. Leaving every session
valid would weaken the existing password-verifier session model. A generic
profile/preferences endpoint would conflate credentials with application data.
All are rejected.

**Limits and follow-up:** The source two-factor and passkey controls remain
absent until their Rust-owned WebAuthn/TOTP contracts and recovery/audit policy
are ready; the page does not imitate unavailable controls. The current Rust
password minimum remains twelve characters, matching the existing replatform
registration policy. Password recovery, durable access-change auditing and a
full password-strength policy review remain identity cutover work.

## ADR-061: Profile core preserves the identity/application boundary

**Status:** Accepted — 6 November 2026

**Problem:** The source Profile settings panel updates a name, sign-in email,
optional public username and profile image. The replatform deliberately keeps
identity records and application records in separate databases, so treating all
four as one application row would recreate the coupling it is meant to remove.

**Decision:** The source Name and Email fields update `identity_profiles` and
`identity_subjects`; the optional ASCII alpha-dash Public username is held in a
new application-database public-profile row with a case-insensitive uniqueness
constraint. `GET/PATCH /account/profile` is owner-scoped, typed and CSRF
protected. Its persistence adapter compensates an application username update
when the subsequent identity update cannot complete, rather than duplicating
identity data. The current session is refreshed with a changed email, while
its password verifier remains unchanged.

The profile-image behavior is completed by ADR-062. The source form keeps an
upload private until the person presses Save profile; the Rust contract retains
that staging boundary rather than attaching the object immediately.

**Why:** This restores useful profile maintenance and changes the default
Settings destination back to the original Profile panel while retaining the
accepted credential/identity/application separation. The existing platform has
no Rust email-verification delivery flow, so an email edit remains usable and
does not mark the identity unauthenticatable merely by changing its address.

**Alternatives:** Keeping all profile fields in identity data would make a
public learning-space handle an authentication concern. Keeping all fields in
application data would duplicate the sign-in address. Showing an arbitrary
profile-image URL field or a disabled upload button would imitate rather than
migrate the source workflow. These are rejected.

**Limits and follow-up:** Profile deletion and the remaining Personal sections
remain separate identity/account work. The source has verification routes
available through Fortify but its `User` does not implement `MustVerifyEmail`,
so no verification-delivery journey is exposed or required for parity.

## ADR-062: Profile images use owner-scoped staging and mounted-volume serving

**Status:** Accepted — 6 November 2026

**Problem:** The original Profile form accepts a GIF, JPEG, PNG, SVG or WebP
upload, previews it immediately, and does not apply it to the profile until
the person submits the rest of the form. Storing arbitrary browser-supplied
paths or serving all bytes publicly would break the greenfield media boundary
and allow a pending upload to leak into a shared learning space.

**Decision:** `POST /account/profile/image` is authenticated and same-origin
CSRF protected. It accepts exactly one `file` field, enforces the source 5 MiB
limit, and validates bytes with the maintained `infer` library for GIF, JPEG,
PNG and WebP; a bounded UTF-8 SVG root check supplies the source SVG format.
The server ignores client filenames and claimed content types, writes the bytes
using the existing mounted-volume `MediaStore`, and records an opaque object key
and inspected content type in application-database `application_profile_images`.

The response gives the owner an opaque image id and same-origin URL. A pending
image is readable only by that owner. `PATCH /account/profile` may attach only
an image owned by that subject; a null id clears it. Once attached, an image is
available to signed-in people for the same shared-learning-space use as the
source profile avatar. Delivery sets the inspected content type, `nosniff`, a
restrictive SVG-safe content-security policy, and private cache controls. The
source-adapted React field retains upload, immediate preview, download, clear,
and the explicit Save profile boundary.

**Why:** This preserves the visible source flow without using a public storage
path as an application data model. Opaque server keys keep storage-provider
details out of contracts. Byte inspection and response hardening are stronger
than accepting an extension or browser MIME type alone, while still supporting
the formats the original picker advertises.

**Alternatives:** Attaching on upload would change the source save/cancel
meaning. Saving a browser-provided URL would bypass storage ownership and type
validation. A public anonymous object route would disclose a pending upload and
make future media policy harder to change. These are rejected.

**Limits and follow-up:** The original source does not clean an unselected file
when the form is abandoned; this slice intentionally retains that behavior, so
an explicit expiry/reconciliation job is needed before broad author media
uploads. Account deletion cascades metadata but needs the same object cleanup
worker. General media, authorization scopes beyond signed-in shared spaces,
and object-storage delivery remain separate later slices.

## ADR-063: Language selection is private application preference data

**Status:** Accepted — 6 November 2026

**Problem:** The original Personal settings panel lets a learner select from
the platform's enabled locales. The selected locale is personal application
state, not authentication information, and a selector without a real
server-owned catalogue would either invent available languages or make browser
storage the authority.

**Decision:** Store enabled locale definitions in `application_locales` and a
learner's selected locale in `learner_language_preferences`, both in the
application database. The typed, owner-scoped `GET/PATCH
/learner/language-preference` contract reads the enabled catalogue and accepts
only an enabled choice; its unsafe update is CSRF protected. The lifted source
Language panel uses that contract and retains the source current-language/save
interaction. Fresh local data has English as its sole enabled locale. That is
an honest default while translated platform and activity copy have not yet been
migrated; adding a locale to the catalogue alone does not claim translation.

**Why:** This keeps locale choice with learner-facing application data and
leaves the identity database concerned only with identities and credentials.
It makes the later translated-content work additive rather than requiring a
preference schema replacement, without creating a custom locale parser or
translation system.

**Alternatives:** A browser-only setting would be invisible to other sessions
and would not match the source's persisted setting. Seeding unimplemented
languages would expose a misleading control. Keeping locale in identity data
would violate the accepted database boundary. These are rejected.

**Limits and follow-up:** This slice stores and validates the selected locale;
it does not yet switch platform or activity copy. Translation-catalogue
migration, locale administration and any content fallback policy require their
own source-backed contracts and verification.

## ADR-064: Platform feedback is deliberate shared application data

**Status:** Accepted — 6 November 2026

**Decision:** The source `/feedback` page is restored with a CSRF-protected,
authenticated Rust submission contract. It permits only the four source
categories and a trimmed 10–4000-character message, recorded in a dedicated
application-database table associated with the submitting principal. It is
explicitly separate from private journal, activity responses and competence
evidence. The table retains review fields for the source administrator queue,
but no reviewer read or update route is exposed in this slice.

**Why:** The source describes feedback as an intentional message to the
platform team. Keeping it out of identity data preserves the accepted database
boundary, while keeping it out of private learner writing avoids an accidental
privacy-policy change.

**Limits and follow-up:** Administrator review, pagination and the optional
feedback invitation/prompt need their own capability-scoped source-backed
slice.

## ADR-065: Feedback invitations retain the source's low-pressure choice

**Status:** Accepted — 6 November 2026

**Decision:** The optional source feedback invitation is restored as a private
application-database preference, independent from the deliberately shared
feedback message itself. A signed-in learner starts enabled, can decline future
invitations, or dismiss one for fourteen days. The Personal Feedback setting
can turn a declined invitation back on. The React client reads this typed
contract only on a source-derived learner page, excludes Settings and the
feedback page, and records that it was shown in browser session storage so it
appears at most once per browser session.

**Why:** The source treats the invitation as an occasional, dismissible prompt,
not as a learning deadline or a requirement to send feedback. Persisting the
longer-lived choice gives the learner control across sessions; the small
browser-session boundary is the React equivalent of the source's server
session prop without inventing a new cross-device prompt schedule.

**Alternatives:** A browser-only opt-out would lose the learner's explicit
choice on another device. A global prompt on every page could interrupt the
feedback or Settings flow. An identity-database setting would mix application
experience preference with credentials. These alternatives are rejected.

**Limits and follow-up:** The fourteen-day delay follows the source service;
there is no new campaign system, analytics, or administrator targeting. The
client-side once-per-session marker is intentionally not a durable preference.

## ADR-066: Platform-feedback review keeps distinct read and review authority

**Status:** Accepted — 7 November 2026

**Decision:** The source Learning Support platform-feedback queue is restored
at `settings?panel=admin-learning-support&support=platform-feedback`. It has
separate `platform_feedback_view` and `platform_feedback_review` application
capabilities. The initial local migration grants both only to the existing
`platform_administrator` role, but the capability records remain independently
assignable. The read contract returns only deliberately shared platform
feedback, its source ordering (unreviewed first, newest first), an eight-item
page and the limited author name/email projection needed by an authorized
reviewer. The review operation records only its timestamp, as the source does.

**Why:** Learner-submitted platform feedback is intentionally shared with the
platform team, unlike private journal or learning evidence. The source still
distinguishes permission to read the queue from permission to mark a message
reviewed. Keeping those capability boundaries avoids silently granting either
power to all Learning Support roles, while the identity lookup stays limited to
the authorized review projection. Greenfield UUID subject identifiers replace
the source's legacy numeric user identifiers without carrying old data forward.

**Alternatives:** Reusing the learner-message moderation capability would
combine two different sources of learner data. Making the queue
platform-administrator-only in code would make the source read/update boundary
impossible to assign later. Storing reviewer-facing names and emails in the
application database would duplicate identity data. These alternatives are
rejected.

**Limits and follow-up:** The source action is only “Mark reviewed”; this slice
does not add replies, classification, deletion, analytics or a campaign
workflow. The larger combined Learning Support Settings shell remains a later
source-backed composition task.

## ADR-067: Journal review remains an explicit one-page privacy boundary

**Status:** Accepted — 7 November 2026

**Decision:** Rust now restores the source one-time journal-feedback request:
the owner may request review only for their own saved page, only while the
global journal-review policy is enabled, and only for a current source-shaped
destination. The greenfield policy defaults off. The initial destination list
contains `Journal` and the learner's existing Rust learning groups; source
organisation destinations remain unavailable because organisations have not
yet been migrated to Rust.

The application database stores the request separately from both the page and
identity credentials. The page receives no staff projection until a request
exists. Staff queue access, response authority and policy administration use
three independent capabilities (`journal_feedback_view`,
`journal_feedback_review`, and `journal_feedback_policy_manage`), initially
granted only to `platform_administrator`. Names and email are read from the
identity database only after the application-side capability check. A response
is immutable, as in the source; the learner can read it only through their
own journal page.

**Why:** Journal writing is private by default. Treating it like deliberately
shared platform feedback, exposing all pages to Learning Support, or accepting
a browser-selected group would change that privacy contract. The three
capabilities also preserve the source distinction between policy, queue access
and responding without hard-coding a role in the application.

**Limits and follow-up:** This restores the source request/reply flow and its
policy toggle, not journal export, review history, configurable presentation,
organisation destinations or a combined completed Learning Support shell. ADR-069
later restores the source default presentation reader only; administrator
configuration and media upload remain separate follow-up work.

## ADR-068: Journal export streams only the learner's source-shaped Markdown

**Status:** Accepted — 7 November 2026

**Decision:** `GET /api/v1/learner/journal/export` authenticates the current
identity, verifies that it has an application principal, and streams only that
principal's journal pages in the source order (`updated_at DESC, id DESC`).
Each page uses the existing Laravel Markdown shape: a title heading, italic
topic/subtopic category, trimmed page Markdown, a `---` separator between
pages, and one final newline. The file is an attachment named
`learning-journal.md` with `text/markdown; charset=UTF-8`, `no-store`, and
`nosniff` response headers.

The query joins the authenticated identity subject to the page owner in SQL;
there is no browser-selected principal or page identifier. Check-ins, feedback
requests, reviewer replies and other learners' writing are deliberately absent
because the source export does not include them. The lifted original Journal
header now uses this same-origin download route.

**Why:** The source permits a learner to retain their own journal in a portable
form. Fetching a paginated UI response or adding staff-review metadata would
not preserve that behavior. A response stream avoids first building an
unbounded concatenated private journal in server memory while retaining the
source body format.

**Alternatives:** A client-built export would require downloading every page to
the browser and make its privacy scope harder to review. A general export API
accepting a user ID would create a cross-learner disclosure risk. Both are
rejected.

**Limits and follow-up:** This is an owner-only export, not an archive of the
learning trail or a staff-review report. Review history and fuller check-in
timeline behavior remain separate source-derived slices.

## ADR-069: Journal uses the source-derived, platform-owned presentation default

**Status:** Accepted — 7 November 2026

**Problem:** The source Journal overlay has a platform-owned light and dark
presentation, including its paper/leather background, colors, overlay,
position, zoom and optional background assets. Leaving the lifted Rust overlay
with a hand-maintained frontend approximation would allow the visual contract
to drift. Reintroducing the source administrator editor or uploads as an
incidental part of a read-only Journal slice would cross a separate media
mutation boundary.

**Decision:** `GET /api/v1/learner/journal` now includes a typed, read-only
`theme` model. The application database reserves a nullable JSONB
`application_journal_feedback_policy.theme` column for the future
platform-owned configuration. Until that separately authorized configuration
slice exists, a missing value resolves on the server to the exact source
light/dark default. The frontend applies that server response using the
source-adapted Journal CSS variables and renders the bundled source paper
background. It also follows a live Light/Dark appearance change while the
overlay is open.

The initial reader accepts only same-origin root-relative image paths. This is
enough for the existing bundled default and deliberately does not make an
arbitrary remote URL or mounted-media path a browser contract. Optional
background assets consequently remain empty until their source upload,
serving, authorization and lifecycle behavior is migrated.

**Why:** The default restores a visible part of the source Journal without
inventing a new visual system or exposing a new writer. Keeping the future
configuration shape in the application database keeps presentation data out
of identity records and makes the next source-backed administration slice
explicit.

**Alternatives:** Hard-code the theme only in React, or migrate settings and
uploads now. The former repeats the earlier UI-drift risk and makes a future
configuration contract implicit. The latter would introduce an unreviewed
media mutation/serving workflow to a read-only parity slice. Both are rejected.

**Limits and follow-up:** This is not a Journal-theme editor, a background
asset upload endpoint, or support for external image URLs. A later
administrator/media slice must validate every setting, use the mounted-media
lifecycle and protected/public serving policy as appropriate, and add its own
authorization, browser and media-lifecycle evidence before it can write the
reserved JSONB value.

## ADR-070: Organisation reads must not perform hidden governance writes

**Status:** Accepted for the future Organisation slice — 7 November 2026

**Problem:** The source Organisation directory and detail reader call
`ensureCurrentLeadership` before serializing an Organisation. For anarchy this
can promote every member, and for random governance it can select and persist
a monthly leader. The same visible surface also depends on owner/member
membership state, join-request status, private member chat, staff moderation
and optional icon media. Treating the directory or detail route as a simple
read-only browser/API migration would silently omit or trigger these durable
state transitions.

**Decision:** Do not publish an empty or deceptively read-only Organisation
surface as a standalone slice. The future Rust Organisation vertical slice
must first model Organisation, membership, pending join request, message and
moderation state in the application database. It must make deterministic
governance reconciliation an explicit, authorized transaction or background
operation, rather than an incidental GET side effect. The browser must receive
only its scoped membership/join-request state, while member chat and pending
requests remain gated by their source roles. Icon upload and icon-report media
work are a later mounted-media sub-slice, not a prerequisite for the core
non-media workflow.

**Why:** This preserves the source's governance behavior without making a
GET request unexpectedly mutate application data. It also prevents a partial
directory from claiming that learners can create, join, communicate or govern
an Organisation when the corresponding server-owned transitions do not exist.

**Alternatives:** Ship the listing/detail screen with disabled source controls,
or retain source-style write-on-read behavior. The former is an incomplete
approximation rather than usable parity; the latter is harder to audit, retry
and secure. Both are rejected.

**Limits and follow-up:** This records a boundary and does not authorize the
Organisation writer. Implementing it requires explicit approval for the
application-data mutation phase, followed by focused contract, database,
authorization and browser evidence. Media mutations remain separately gated.

## ADR-071: Organisation core is a source-shaped application-data slice

**Status:** Accepted — 7 November 2026

**Problem:** Learner organisations combine a public directory with private
membership, leadership, join-request and chat state. The source behaviour is
already defined, but its Inertia responses are not a safe Rust API contract and
its reader performs governance work as a side effect.

**Decision:** The Rust core slice stores organisations, memberships, join
requests, messages and the per-learner membership policy in the application
database. Identity details remain in the identity database and are projected
only after the application query has selected the permitted organisation
records. The typed same-origin OpenAPI contract exposes the source directory,
detail, create/update, join request, leadership, membership and message
transitions. React retains the source index/detail layout, URL shape and
controls while replacing only Inertia visits/forms with typed API calls.

Anarchy leadership is reconciled in the transaction that changes membership.
Random governance is repaired on writes if a leader is missing or invalid; it
does not rotate from a GET. The explicit monthly rotation command is recorded
in ADR-073.

**Why:** This gives every durable transition an explicit actor, authorization
check and transaction while preserving source workflows. It keeps credentials,
password hashes and identity profiles outside application collaboration data.
The source frontend is reused rather than replaced with an approximation.

**Alternatives:** Retaining Laravel's write-on-read behaviour would make a
browser refresh mutate leadership. Storing user names alongside memberships
would duplicate identity data. A new organization UI would introduce visual
and interaction drift. These alternatives are rejected.

**Limits and follow-up:** Remaining organisation administration and policy
surfaces are separate work; completed icon moderation is recorded in ADR-074.

## ADR-072: Organisation icons use authenticated mounted-media objects

**Status:** Accepted — 7 November 2026

**Problem:** The source lets organisation leaders upload an icon and lets a
non-leader report it. The migration must preserve the visible source controls
without making locally mounted objects public or losing the exact file that a
report referred to when a leader replaces an icon.

**Decision:** The application database owns an organisation-icon metadata row
and an immutable object key in the mounted backend media volume. A leader may
replace the current icon through a multipart API route after same-origin CSRF
and membership checks. The API serves a current icon only to a signed-in
learner, with verified image type, bounded size and response hardening. The
directory/detail projections carry an authenticated API URL, and the adapted
source React icon component and leader/report controls use that URL. A report
records both the current icon row (when it remains available) and its object
key snapshot, so later replacement cannot change the moderation evidence.

**Why:** This keeps media bytes out of PostgreSQL, honours the selected mounted
volume strategy, reuses the established profile-image validation/storage path,
and preserves the report's source meaning. The local browser workflow covers
leader upload, member display and report submission.

**Alternatives:** A public static media path would expose objects outside the
application's authenticated boundary. Storing image bytes in the application
database would make routine media serving and backups needlessly heavy. Saving
only a mutable current icon reference in a report would make moderation
evidence drift after replacement. These alternatives are rejected.

**Limits and follow-up:** Administrator resolution is supplied by ADR-074. A
failed best-effort deletion of an already-replaced mounted object can leave an
orphan for a future bounded media cleanup job; it cannot invalidate the
committed replacement.

## ADR-073: Random organisation leadership rotates by explicit scheduler command

**Status:** Accepted — 7 November 2026

**Problem:** Laravel changes random-governance leadership while rendering an
organisation page after a new month begins. A read must not write in the Rust
platform, but leaving leadership unchanged until another collaboration write
would alter the source's monthly outcome.

**Decision:** `wicked-learning-api rotate-random-organization-leaders` is an
idempotent private backend command for a scheduler to invoke at least monthly.
Within one application-database transaction it locks each due random
organisation with `SKIP LOCKED`, prefers a current non-leader, makes exactly
one membership the leader, and records the rotation time. A missing or invalid
single-leader state is also repaired. The local/Coolify-shaped operator command
is documented; it performs no browser or identity-database operation.

**Why:** This preserves the source's rotation rule while giving the durable
transition an observable operator boundary, retry-safe concurrency behaviour,
and no surprising mutation from a GET request.

**Alternatives:** Retaining Laravel's read-time mutation makes browser refresh
an authorization-changing action. A client-side timer is not authoritative and
misses inactive organisations. A permanently running in-process timer creates
duplicate-replica and restart ambiguity. These alternatives are rejected.

**Limits and follow-up:** This command must be registered with a deployment
scheduler before production cutover; the current local stack demonstrates the
command but does not run a production schedule. Its database clock defines the
month boundary, matching the PostgreSQL deployment's UTC convention.

## ADR-074: Organisation-icon moderation has a separate capability and snapshot reader

**Status:** Accepted — 7 November 2026

**Problem:** A member's icon report needs a source-shaped administrator queue.
Deleting or replacing the live icon must not alter the file a moderator reviews,
and ordinary signed-in learners must not see reports or their reporter data.

**Decision:** Add the independently granted `organization_icons_moderate`
capability (initially held by the migrated platform-administrator role). Its
private queue lists pending reports with only the source-needed organization,
reporter and setter projection. A moderator sees the immutable report snapshot,
then may dismiss the report or remove the organization's current icon. Resolving
is a CSRF-protected transaction and the snapshot image is available only through
the moderator route. Replacement preserves mounted objects referenced by a
report, rather than deleting its evidence.

**Why:** This mirrors the source distinction between reporting and moderation,
keeps identity projections least-privilege, and avoids turning a historical
report into a reference to a different image.

**Alternatives:** Reusing a generic platform-admin role check would make future
delegation impossible. Serving report snapshots through the ordinary current
icon URL would erase the evidence after removal. Keeping a public static URL
would expose moderator-only context. These alternatives are rejected.

**Limits and follow-up:** The queue currently returns at most 100 pending
reports, which is suitable for the local migration slice but needs source-style
server pagination before a high-volume production cutover. General organization
policy settings remain a separate administration slice.

## ADR-075: Access-link grants are application-owned and plaintext is returned once

**Status:** Accepted — 7 November 2026

**Problem:** The source application lets an administrator issue expiring links
that grant a learner a selected tool or item, or route a new learner through
registration. The raw secret must never enter ordinary listings, logs or
database backups, while repeat and per-learner use must remain race-safe.

**Decision:** The application database stores only a SHA-256 token digest,
configured tool/item UUIDs, expiry, enablement, usage policy and redemption
audit rows. The administrative create response is the only response containing
the opaque redeem URL. Resource redemption locks the link, checks
expiry/enabled/replay policy, derives the caller's application principal
server-side and applies the configured inventory grant in the same database
transaction. Registration links redirect to the existing registration form;
their application-database link is locked while the established compensating
identity/application provisioning workflow creates the learner, then its
redemption is recorded alongside the new principal. A separate
`access_links_manage` capability initially belongs to the platform
administrator role.

**Why:** Tool/item holdings, registration-link policy and the audit trail are
application data; keeping them together preserves transactionality where it is
possible and avoids putting authorization data in the credential database. The
registration implementation extends the existing compensating workflow rather
than duplicating password or identity logic. A digest protects a leaked
application-data backup from becoming an immediately usable link list.

**Alternatives:** Storing raw tokens makes normal administrative read paths a
credential-disclosure risk. Browser-supplied item/tool identifiers would let a
redeemer forge a different grant. A generic administrator-role check would
prevent future delegation. These alternatives are rejected.

**Limits and follow-up:** A registration link presently gives the new account
the source default `learner` role. A temporary-login link instead creates a
fresh temporary learner principal and server-side session with a generated,
unknown verifier; it supports one-time or multiple use, never per-user use.
Role-selection remains part of the later access/role-management slice. The identity and
application databases cannot commit as one transaction, so compensation
removes a partially created principal, identity subject and access-link
redemption; an operational repair procedure is still needed before a
production cutover.

## ADR-076: Role catalogue precedes role administration writes

**Status:** Accepted — 7 November 2026

**Problem:** The source access-management UI lists roles by name, description,
level and system status, then permits role and user-assignment changes according
to a substantially broader resource/level/scope permission catalogue. The Rust
platform has only the capabilities required by slices already migrated. Adding
an approximate role editor or assignment UI would make authorization look
complete while silently omitting source permission rules.

**Decision:** Keep roles and their capability grants as application data, add
source-shaped catalogue metadata (`name`, optional `description`, hierarchy
`level`, and `is_system`), and expose a read-only `GET /admin/roles` contract
behind a dedicated `roles_view` capability. The initial catalogue describes
only the already-migrated platform administrator, learning-support, learner
and temporary learner roles, ordered as the source orders roles. The original
Roles panel, role writes, deletion and user role assignment remain unavailable
until the complete source permission model and all affected contracts can be
migrated together.

**Why:** This supplies exact, typed metadata for the eventual source React UI
without treating a partial capability list as an equivalent permission system.
It preserves the separation between credential data in the identity database
and authorization/application data in the application database. A separate
read capability also permits future delegation without hard-coding an
administrator role check.

**Alternatives:** Exposing an improvised role-management screen would violate
the original-UI requirement and could grant or remove access incorrectly.
Copying Laravel's entire permission model before its dependent features exist
would create unused, untested authorization surface. Returning role data to
every signed-in learner would disclose administration structure without a
source need. These alternatives are rejected.

**Limits and follow-up:** Current capability names are intentionally a bounded
projection, not a claim of full Laravel permission parity. Before enabling role
or assignment writes, migrate the source resource, level and scope catalogue,
the hierarchy checks, the affected UI controls, and contract/browser/database
tests as one authorization slice.

## ADR-077: Preserve the complete permission vocabulary before activating it

**Status:** Accepted — 7 November 2026

**Problem:** The Laravel role editor is driven by a fixed catalogue of 26
administrative resources, four ordered levels (`none`, `ro`, `ru`, `rud`) and
five scopes (`none`, `own`, `assigned`, `group`, `all`). A reduced catalogue
would make a newly saved role lose source information, while replacing every
existing Rust capability check in one unreviewable change would risk widening
authorization.

**Decision:** Store one level and scope grant for every role/resource pair in
the application database, validate each against the source vocabulary, and
return the source labels and descriptions through `GET /admin/roles`. Seed the
platform administrator with full `rud`/`all` grants and other current system
roles with conservative defaults. Existing dedicated Rust capabilities remain
the enforcement mechanism for completed vertical slices until the relevant
resource, level and scope check has been migrated and tested end-to-end.

**Why:** The original React editor can later read and save the entire matrix
without browser-owned policy or missing rows. The staged enforcement change
keeps currently working learner and administrator workflows stable while
making the eventual authorization transition explicit and auditable.

**Alternatives:** Translating only currently used capabilities into editor
rows would omit source-managed areas and make an edit destructive. Switching
all handlers to the new matrix immediately would conflate a schema migration
with the authorization migration of every feature. Both alternatives are
rejected.

**Limits and follow-up:** The `roles` resource now authorizes its own read,
create/update and deletion operations (while the earlier read capability
remains as a transition fallback). Other matrix rows are still a faithful data
projection, not an authorization claim for unported features. Hierarchy-based
assignment, account access controls, audit history and the source React
settings panels follow only after their enforcement boundaries are complete.

## ADR-078: Role writes replace the whole source permission matrix atomically

**Status:** Accepted — 7 November 2026

**Problem:** A role edit changes its name, description, hierarchy level and
every resource's permission level and scope. Saving individual browser fields
would permit a partly applied role and could make an administrator believe a
permission had changed when it had not.

**Decision:** The Rust role write contract accepts a complete source-shaped
matrix. Missing known resource entries receive the source defaults (`none`
permission and `all` scope); invalid level/scope/key/name/length values are
rejected before persistence. PostgreSQL creates or updates the role metadata
and all 26 rows in one transaction, and returns the freshly projected role.
Only `roles: ru` may create or update; only `roles: rud` may delete. A system
role produces a validation rejection rather than being deleted.

**Why:** This matches the source editor's all-resource save semantics while
avoiding partial authorization state. Keeping the key immutable after creation
protects foreign-key role assignments and mirrors the source UI. The API is
ready for the lifted source panel without adding a standalone replacement UI.

**Alternatives:** PATCHing arbitrary individual permission rows makes source
defaults and transaction boundaries unclear. Allowing system-role deletion can
leave new registrations or temporary accounts without their required baseline
role. Both alternatives are rejected.

**Limits and follow-up:** This slice owns role definitions, not assignment to
people. The source's hierarchy check, identity login disable/ban state and
access-change audit need the user-administration slice before the original
combined Access Management workspace can be exposed.

## ADR-079: Account access state stays in identity; access history stays in application data

**Status:** Accepted — 7 November 2026

**Problem:** The source user-administration workflow lets an authorized
administrator assign roles, disable a login, set a temporary ban and review a
bounded history of these changes. The new platform deliberately separates
credential-bearing identity data from application data, so treating all of
that as one database record would either duplicate credential concerns or make
authorization assignments identity-owned.

**Decision:** Login disablement and the ban expiry are identity-subject fields;
password login and session reload both reject disabled or currently banned
subjects. Application role assignments and access-change audit records stay in
the application database. Audit records refer to immutable actor and target
subject IDs and preserve changed values only—never password hashes, sessions,
or invitation plaintext. User-access writes validate the source role hierarchy
and protect administrators from changing their own account. They lock both
records, stage the application role replacement and audit entry, commit the
identity change, then commit the application change. If the latter commit
fails, the identity state is compensated to its recorded prior values.

**Why:** This preserves the source behavior while keeping authentication data
in the identity database and application authorization/audit data in the
application database. The explicit compensation path makes the absence of a
cross-database transaction a visible, tested operational concern rather than a
silent consistency assumption.

**Alternatives:** Duplicating access state in the application database would
allow disagreement with authentication. Moving role assignments or audit data
into identity would blur the database boundary and couple credentials to
application policy. A best-effort write without compensation could silently
leave a user with changed login state but no matching role/audit change. These
alternatives are rejected.

**Limits and follow-up:** Account deletion and registration-token role
selection have their own cross-database lifecycle designs. The source-adapted
Users panel now exposes the completed connected controls through typed Rust
contracts; browser smoke coverage remains available when disposable local
administrator credentials are configured.

## ADR-080: Registration invitations carry validated application-role keys

**Status:** Accepted — 7 November 2026

**Problem:** Source invitations can grant the roles that their issuer is
allowed to assign. Defaulting every new Rust invitation to `learner` would
discard an administrator's selected access and make the eventual original
Users workspace misleading.

**Decision:** An invitation stores its selected role keys alongside its
identity-owned hash, expiry and audit references. Before issuing it, the
application database verifies that every role exists and is at or below the
issuer's highest role level. Registration locks and consumes the invitation,
then uses those keys when it creates the new application principal. Existing
callers that omit roles retain the safe baseline-learner behavior. Registration
access links are governed by their separate, application-owned role-selection
contract (ADR-082).

**Why:** This preserves source hierarchy behavior without copying application
role definitions into the identity database. It also keeps identity's limited
responsibility clear: it safely holds a one-use invitation record but never
authorizes a role by itself.

**Alternatives:** Storing a role's permissions inside an invitation would make
role edits and revocation inconsistent. Looking up only the role after account
creation would risk activating an account with missing access. Both are
rejected.

**Limits and follow-up:** The source-adapted invitation controls are now
available in the Users panel. Account deletion and access-link role selection
have separate lifecycle slices because their persistence and redemption paths
differ.

## ADR-081: Account deletion is a resumable deprovisioning workflow

**Status:** Accepted — 7 November 2026

**Problem:** The source administrator can delete another account, and database
foreign keys remove or null related data. Rust's identity and application
records deliberately live in separate databases, so deleting either one first
can leave an interrupted operation without a database transaction spanning
both sides.

**Decision:** Both administrator deletion of another account and the source
owner-initiated Delete account panel use one reusable lifecycle. The latter
requires the current password in the destructive request itself, as the source
`ProfileDeleteRequest` does; it is not satisfied by the separate recent-password
confirmation window. A deletion first commits a small application-database
deprovisioning job, then changes the identity to a non-authenticating
`deleting` state. A second application transaction nulls audit references as
the source's nullable foreign keys do and deletes the application principal
(using existing cascade/null relationships). It then deletes the identity and
removes the job. The successful owner request logs out its current browser
session and returns to the source welcome surface. An administrator may never
delete their own subject through the administrative route; `users: rud` remains
required there.

**Why:** Committing the durable job before the identity state changes prevents
an untracked disabled identity if the application database fails. The
immediately non-authenticating state prevents a partly deleted account from
continuing to use a session. Reuse keeps staff and owner deletion from silently
developing different cross-database semantics.

**Alternatives:** Deleting the application principal first can strand an
otherwise authenticating identity. Deleting identity first without a repair
record can strand application data forever. A soft delete would depart from
the source's deletion semantics. These alternatives are rejected.

**Limits and follow-up:** The `reconcile-identity-deletions` backend command
repairs durable jobs after an interruption; a production deployment should run
it as a bounded worker or scheduled job. Mounted-volume profile-image metadata
cascades with the principal, but physical object cleanup remains the existing
media-lifecycle worker follow-up. The source-adapted Users panel and Personal
Delete account panel now expose their respective complete workflows through
this contract.

## ADR-082: Registration access links carry application-owned role selections

**Status:** Accepted — 7 November 2026

**Problem:** The source access-link workspace lets an administrator choose the
roles a registration link grants. The Rust replatform uses separate identity
and application databases, so the identity database must not become a second
owner of application-role policy. Earlier local Rust registration links also
predate this role-selection contract and represented the source learner
default.

**Decision:** A registration access link stores its normalized selected role
keys in the existing application-database JSON payload. Creation rejects an
empty selection and verifies every key exists and is at or below the issuer's
highest role level. The administrative read contract returns only those
assignable role keys for the source-adapted multi-select control.

Registration locks the access link, validates its payload before provisioning
an identity, creates the application principal with the selected role keys,
then records redemption and activates the identity through the existing
compensating workflow. A selected role that is removed before redemption makes
provisioning fail and compensates the identity rather than silently granting a
different role. A link with no `roles` payload field is only the backward
compatible representation of an older locally created Rust link and grants
`learner`; a present but malformed or empty role payload is rejected.

**Why:** This preserves the source workflow while keeping credentials,
password hashes and session state in the identity database, and application
roles and authorization policy in the application database. It also makes bad
or stale application payloads fail closed before they can create an orphaned
identity.

**Alternatives:** Copying role definitions into the identity database would
make authorization ownership ambiguous. Encoding permissions rather than role
keys in the link would make later role changes inconsistent. Keeping an
unconditional learner fallback for malformed new links would silently weaken an
administrator's selected policy. These alternatives are rejected.

**Limits and follow-up:** This applies only to registration access links.
Identity-owned administrator invitations retain ADR-080's separate lifecycle;
tool, item and temporary-login links do not accept role selections.

## ADR-083: Learning-group administration evaluates role scopes at the resource

**Status:** Accepted — 7 November 2026

**Problem:** The source role matrix gives group administration a permission
level and a scope. The Rust Groups panel initially treated the derived
`learning_groups_manage` capability as global authority, allowing a custom
role with an own- or assigned-group scope to read or modify unrelated groups.

**Decision:** The authenticated Rust principal retains internal permission
grants with their resource, level and scope. Group administration selects the
broadest qualifying scope across the principal's roles, following the source
scope order: `own`, `assigned`, `group`, `all`. A group reader sees all groups
only with `all`; otherwise it sees groups it created and, for `assigned` or
broader scopes, groups where it is a `manager` member. Updates apply the same
resource-scoped check while holding the group row lock. Membership changes use
the independently granted `group_members` resource and its scope.

**Why:** This restores the source authorization model while preserving a small
backend-owned principal shape. The browser still receives only the typed group
projection, never raw permission grants or an instruction to enforce policy.
Locking before a mutation prevents a concurrent membership or creator change
from widening the decision after it was checked.

**Alternatives:** Treating every migration capability as all-scope would be
simple but incorrect for configurable roles. Requiring a platform
administrator for every group action would erase source delegation. Giving the
browser a scope map would invite client-side authorization drift. These
alternatives are rejected.

**Limits and follow-up:** This is the first scope-sensitive consumer of the
migrated role matrix. Other resource families must apply their own source
scope semantics when their administration slices are migrated; a generic
cross-domain scope engine would hide those ownership facts too early.

## ADR-084: TOTP enrollment is an identity-only staged factor

**Status:** Accepted — 7 November 2026

**Decision:** The Rust TOTP slice will use maintained `totp-rs` 6.0.0 with
the standard six-digit, thirty-second SHA-1 interoperable authenticator
profile. An enrollment secret is generated and displayed only while the
authenticated owner completes setup; the identity database stores it encrypted
at rest, never in application data, a session payload, URL or log. The factor
becomes eligible at login only after a valid confirmation code. Each recovery
code has an Argon2id verifier for atomic one-use login consumption and a
separate AES-256-GCM encrypted display copy in the identity database. That
copy is released only to the authenticated, recently password-confirmed owner
through non-cacheable responses, preserving the source recovery-code manager.
Disabling or replacing a factor requires the same sensitive-action flow;
its source-shaped application audit is queued in the identity transaction and
delivered through the reliability boundary in ADR-087.

**Why:** This preserves the source's authenticator-app, recovery-code view and
recovery-code replacement journeys while reusing maintained TOTP and
password-hash primitives. Staged enrollment prevents an interrupted QR scan
from locking an account. The encrypted display copy has a larger identity-data
read exposure than one-way verifiers alone, but is required for behavioral
parity and is limited to the same identity boundary and owner-confirmed
non-cacheable path.

**Implementation status:** The Rust API now starts an authenticated,
CSRF-protected pending enrollment at `POST /api/v1/account/two-factor/setup`.
It returns the provisioning secret only in a `Cache-Control: no-store` response
and stores an AES-256-GCM-encrypted pending secret in the identity database.
`POST /api/v1/account/two-factor/confirm` accepts a fresh valid code within
fifteen minutes, atomically promotes the pending secret, replaces recovery-code
verifiers and encrypted display copies, and returns ten new recovery codes in
another non-cacheable response. `GET /api/v1/account/two-factor` reports the
confirmed-factor state; recent-password-protected recovery-code read/replacement
and factor-disable commands complete the source account-management lifecycle.
The source-derived Personal Security UI now presents QR/manual setup,
verification, view/regenerate recovery codes and disable controls. The
source-derived React login challenge accepts either an authenticator-app code
or one recovery code after the server stages a valid password login.

**Limits and follow-up:** The passkey lifecycle is now covered separately by
ADR-088. Neither factor alone satisfies the broader identity cutover gate.

## ADR-085: TOTP sign-in uses a short-lived pre-authentication session

**Status:** Accepted — 7 November 2026

**Decision:** After a valid password for an account with a confirmed TOTP
factor, Rust will rotate the anonymous session identifier and store only a
short-lived pending subject identifier plus the current password-verifier
version in the server-side session. It will not call the normal login operation
until a six-digit TOTP code or one unused recovery code succeeds. Challenge
attempts use the source-aligned five-attempt-per-minute limit. A confirmed TOTP
step is consumed atomically through `last_accepted_step`, so the same current
or skew-window code cannot complete multiple challenges.

**Why:** This preserves the source's guest-before-challenge behavior without
putting credentials or factor secrets in browser storage. Binding the challenge
to the password verifier invalidates it when the password changes, while the
database step marker closes the replay gap left by a standalone TOTP check.

**Alternatives:** Signing the user in before the challenge would make a
second-factor prompt cosmetic. A client-held challenge token would expose more
authentication state and be harder to revoke. Accepting valid time codes
without a consumed-step record would allow same-window replay. These
alternatives are rejected.

**Implementation status:** Password login now creates this rotated pending
session for a confirmed factor and returns an explicit typed challenge state
while preserving the ordinary session response for other accounts. The React
login screen routes that state to the source-derived `/two-factor-challenge`
screen. Its typed completion command accepts exactly one six-digit
authenticator-app code or bounded recovery code. TOTP verification locks the
factor and advances its accepted time step; recovery-code verification locks
and consumes exactly one Argon2id verifier before the normal server-side
session is authenticated.

**Limits and follow-up:** The security settings lifecycle remains incomplete:
factor status, recovery-code replacement, factor disable/replacement and its
sensitive-action checks are not exposed. Audit events remain a separate
cross-database reliability slice.

## ADR-086: Sensitive identity actions require a recent password confirmation

**Status:** Accepted — 7 November 2026

**Decision:** Rust stores a successful password confirmation only in the
server-side browser session, bound to the current password verifier and valid
for the source three-hour window. The browser may read the boolean status and
submit its password through typed, same-origin CSRF-protected contracts; it
never receives a confirmation token or password verifier. Changing the
password invalidates the confirmation because the stored verifier no longer
matches. TOTP enrollment and confirmation require this boundary before they
can modify a factor.

**Why:** Laravel applies its `password.confirm` middleware to every two-factor
management route. A reusable session-bound check preserves that security and
interaction boundary without creating a browser-held sensitive-action token,
and it will also serve the source passkey lifecycle.

**Implementation status:** The source-derived `/confirm-password` screen now
uses the original authentication presentation and its password or passkey
confirmation alternatives, returning safely to a local requested path or
Personal Security. An anonymous visit returns through the normal login
journey. Personal Security checks this status before rendering, matching the
source route's password-confirmation boundary and returning to the same
Security path after a successful confirmation.

**Limits and follow-up:** The settings route, TOTP status,
disable/replacement and recovery-code lifecycle remain unavailable until their
complete contracts are implemented. The later passkey slice must add its source
confirmation alternative to this reusable session-bound boundary.

## ADR-087: Security-factor audit delivery uses an identity outbox

**Status:** Accepted — 7 November 2026

**Problem:** Source two-factor lifecycle changes appear in the administrator's
application-owned access history. Rust commits factor secrets and verifiers in
the identity database, while that history remains correctly application-owned;
a direct best-effort second write could silently lose an audit record whenever
the application database is unavailable.

**Decision:** The same identity transaction that confirms or disables a TOTP
factor writes a credential-free outbox record with a stable UUID, source action
and before/after security-factor labels. The account owner remains both actor
and target, as in the source audit. A local bounded delivery worker moves
pending records to `application_access_change_events`. It uses the outbox UUID
as the application event ID and `ON CONFLICT DO NOTHING`, then marks the
identity record delivered only after application commit. Startup and a
thirty-second retry loop recover from either database being temporarily
unavailable. The application event never includes TOTP secrets, recovery codes,
verifiers, session values or credential metadata.

**Why:** This preserves the source visible audit trail without blurring the
two-database ownership boundary. Idempotent delivery handles a process crash
between application commit and identity acknowledgement without duplicate
history rows.

**Alternatives:** A cross-database transaction is not available for the two
separate PostgreSQL databases. Writing directly to application data after a
factor mutation risks a permanent missing event. Storing the history in
identity data violates the accepted boundary. These alternatives are rejected.

**Limits and follow-up:** Passkey registration/deletion now enqueue the same
kind of non-secret events under ADR-088. The outbox is for security-factor
history only; it is not a generic event bus.

## ADR-088: Passkeys use server-held WebAuthn ceremonies and identity-owned public credentials

**Status:** Accepted — 7 November 2026

**Problem:** Laravel supports passwordless discoverable passkeys, account
confirmation with an enrolled passkey, and account-managed registration and
removal. The Rust replacement must preserve those flows without inventing
WebAuthn parsing, placing a ceremony challenge in browser storage, or putting
credential material in application data.

**Decision:** Use maintained `webauthn-rs` 0.6.2 for every server-side
WebAuthn ceremony and maintained `@simplewebauthn/browser` 14.0.0 for browser
option decoding and `navigator.credentials` calls. The Rust workspace and
backend build image use Rust 1.89, the minimum supported compiler for that
reviewed WebAuthn release. Identity owns a fresh
`identity_passkeys` table containing only a subject-scoped owner label, public
credential ID, public credential state and created/last-used timestamps.
The application database receives only source-shaped non-secret registration
or removal history through ADR-087's idempotent identity outbox.

The relying-party ID is derived from the configured public-origin hostname;
changing that hostname is an intentional credential-boundary change and
requires passkey re-enrollment. The API keeps every registration,
discoverable-login and account-confirmation ceremony in the existing
server-side session for at most sixty seconds. Registration excludes existing
credential IDs and requests resident/discoverable credentials plus user
verification, matching the Laravel source. The browser receives only public
options and submits a browser-produced WebAuthn response; no password,
private key, credential verifier or raw ceremony state is part of the API
contract or application data.

**Why:** `webauthn-rs` supplies standards-aware ceremony verification,
signature-counter updates and discoverable-credential handling, while
SimpleWebAuthn handles WebAuthn's browser JSON conversions. This avoids two
hand-rolled security-critical implementations and keeps Rust's identity and
application boundaries intact. The typed OpenAPI boundary deliberately models
the stable envelope and treats browser response details as maintained-library
data, rather than duplicating the WebAuthn specification in application DTOs.

**Alternatives:** A custom WebAuthn codec/verifier is rejected because it would
reimplement a security protocol. Storing state in the React client or in a
signed browser token is rejected because it weakens replay protection. An
external OIDC passkey provider remains a future extension under ADR-003, not a
replacement for the Rust-owned initial identity boundary.

**Implementation status:** `POST /session/passkey/options` and
`POST /session/passkey` provide the source passwordless sign-in journey.
Recent confirmation has corresponding account passkey endpoints, and recent
password confirmation gates account list, registration and removal. The lifted
original React passkey controls appear on Login, Confirm Password and Personal
Security. Passwordless login, confirmation and factor changes are rate-limited
to the source-aligned ten requests per minute; credential use updates only the
identity-owned public state. The public list intentionally omits an
authenticator-brand badge unless the backend has a safe verified label rather
than guessing from browser/device data.

**Limits and follow-up:** This is a local greenfield proof of concept, not a
production identity cutover. Password reset and remembered sessions are now
addressed by ADR-089 and ADR-090; the remaining identity cutover and
independent-review requirements remain separate gates. Full browser WebAuthn
ceremony tests require a virtual authenticator in
the local test harness; the current focused browser test covers the lifted UI
structure and API contract, while Rust tests cover timeout and secret-free
factor-history invariants. The current shared Tower limiter keys passkey
requests by trusted client IP; Laravel's limiter also incorporates a credential
identifier or session identifier. The Rust rule is therefore deliberately
stricter for clients sharing an IP, but not exact key-level parity. Replacing it
requires a request-aware, body-safe limiter and a focused security review.

## ADR-089: Password recovery uses identity-owned one-time tokens and configured SMTP

**Status:** Accepted — 7 November 2026

**Problem:** The source Forgot Password and Reset Password pages are a complete
account-recovery journey. A Rust substitute that merely rendered their forms,
put a reset token in browser storage, or stored a token with application data
would be visually familiar but would not recover an account safely.

**Decision:** The Rust identity database owns one active password-recovery
record per subject. The token is generated with the maintained UUID random
source, stored only as an Argon2id verifier, expires after the source
sixty-minute window, and is deleted in the same identity transaction that
replaces the password verifier. Requests are serialized on the identity and
preserve Laravel's sixty-second broker throttle. The API sends the plaintext
token only in a source-shaped `/reset-password/{token}?email=...` email link
through maintained `lettre` SMTP transport; it never includes the token in an
API response, application database row, session, audit event or log. The
local Compose stack uses a disposable Mailpit SMTP inbox so the actual delivery
and reset path can be rehearsed. Shared environments must configure a normal
SMTP relay, sender identity and STARTTLS before enabling the same flow.

**Why:** This matches the source broker's one active token, expiry, throttle,
email delivery and post-reset return-to-login behavior while retaining the
accepted identity/application split. Replacing the password verifier preserves
the existing server-side session invariant: any session bound to the old
verifier stops authenticating on its next request.

**Alternatives:** A browser-held reset token, a custom SMTP implementation, a
plaintext token table, or a development-only fake email control are rejected.
They either weaken recovery secrecy, recreate maintained protocol code, cross
the database boundary, or expose an incomplete source workflow as available.

**Implementation status:** `POST /password/forgot` and `POST /password/reset`
are typed same-origin CSRF-protected contracts. The lifted original Login,
Forgot Password and Reset Password React surfaces use those contracts without
changing their source labels, fields, route family or return-to-login journey.
The local Mailpit inbox is exposed only on the configurable local port 8026;
it is not a production service.

**Limits and follow-up:** SMTP delivery is synchronous, matching the source's
immediate password-broker notification path. A production cutover requires an
operational delivery/retry policy and an independent security review. Remembered
sessions are addressed by ADR-090; the source-disabled email-verification
policy is recorded in ADR-057.

## ADR-090: Remembered login uses a persistent server-side session

**Status:** Accepted — 7 November 2026

**Problem:** The original Login page offers a `Remember me` control. Laravel
implements it with a separate encrypted recaller cookie that lasts 576,000
minutes (400 days), while the Rust platform already has a maintained,
identity-database-backed session store.

**Decision:** The typed password-login contract accepts an optional `remember`
boolean, defaulting to false. A normal password login remains a browser-session
cookie. A remembered password login stores the already server-side, opaque
session for a fixed 400-day deadline and sends the same HTTP-only, same-site
session cookie with that deadline. The intent survives the source two-factor
challenge and takes effect only after a successful factor proof. Logout deletes
the session, and the existing password-verifier binding invalidates remembered
sessions when a password is changed or reset.

**Why:** `tower-sessions` and its PostgreSQL store already manage opaque session
identifiers, expiry and cookie attributes. Extending that maintained facility
preserves the source-visible browser-restart behavior and exact duration
without putting a second bearer secret, identity data or password-derived value
in a custom browser cookie or application database. A narrow session adapter
reapplies the stored absolute deadline before later session writes, retaining
that fixed deadline rather than extending it.

**Alternatives:** Recreating Laravel's separate recaller-token scheme would add
a second authentication artifact and custom rotation/revocation policy for no
user-visible benefit. Making every session persistent would ignore the source
checkbox. A sliding expiry would also differ from Laravel's fixed recaller
cookie lifetime. These alternatives are rejected.

**Implementation status:** The lifted original login form restores the
checkbox, label, tab order and typed request field. The normal and two-factor
password journeys use the same server-owned expiry policy; passkey, temporary
access and registration sessions remain browser sessions unless a source
control explicitly requests otherwise.

**Limits and follow-up:** Laravel can create a fresh web session from its
separate recaller cookie after a web-session expiry. Rust retains an equivalent
durable server-side session instead, which is deliberately an implementation
substitution rather than a new user workflow. Independent identity review,
session/device-management controls and the source-disabled email-verification
policy remain broader cutover work.

## ADR-091: World Builder authorization uses explicit map ownership and editor assignments

**Status:** Accepted — 7 November 2026

**Problem:** The source World Builder does not grant every author access to
every map. Its `all`, `own` and assigned-editor permission scopes determine
which map graphs may be read or changed. The initial Rust World schema was a
learner-facing projection and had no durable facts to enforce that boundary.

**Decision:** Each Rust `learning_maps` row may record its creating application
principal. A separate `learning_map_editing_groups` relation records explicit
learning-group editor assignments. The forthcoming authoring read/write
repositories must apply role permission level and scope against these facts:
`all` sees all permitted maps, `own` only creator-owned maps, and `assigned`
only maps assigned through a group the principal belongs to. Learner-visible
map access is never treated as edit authority.

**Why:** This preserves the source authorization distinction before an
authoring graph endpoint or editor becomes reachable, while keeping identity
subjects outside application content rows.

**Alternatives:** Returning every map to any role with a World Builder
permission, or deriving authoring access from learner visibility, would expose
unrelated authored work. Both are rejected.

**Implementation status:** `GET /api/v1/admin/world-builder` now uses these
facts for the source-shaped, read-only authoring graph. It alters neither
existing learner reads nor any authoring writer.

**Limits and follow-up:** The endpoint is only the overview read contract. It
does not implement the source editor's selected-map/node reads,
create/update/import/export workflow, review queue or unlock diagnostics.

## ADR-092: World Builder overview keeps authoring reads separate from learner World reads

**Status:** Accepted — 7 November 2026

**Problem:** The Rust learner World snapshot filters published content by a
learner's viewing role and includes private learner state. The Laravel World
Builder graph instead includes authoring drafts, is scoped by map-edit policy,
and supplies portal/authoring details. Reusing the learner projection would
either hide valid draft work or leak learner-private state and could let
learner visibility stand in for editor authority.

**Decision:** Add a dedicated read-only `GET /api/v1/admin/world-builder`
contract and `AdminWorldGraph` projection. Opening it requires any source
World Builder read grant (`world_maps`, `world_nodes`, `world_activities`, or
`world_map_access`). Its persistence query then applies the narrower source
`scopeEditableMaps()` rule: `all` includes every map; `own` includes maps
created by the principal; `assigned`/`group` includes direct editing-group
membership; and direct editing-group membership remains sufficient even when a
role has no update grant. The response may contain drafts and source-shaped
portal details, but no learner progress, inventory or browser-owned policy.

**Why:** This preserves the source's two distinct authorization questions and
allows the original World Builder React components to be lifted incrementally
on a stable typed API contract.

**Alternatives:** Extending `/learner/world` would blur learner and author
data/authorization. Returning all maps to every user who may open the panel
would violate source scope. Building a bespoke partial editor before its
remaining contracts would violate the original-UI requirement. These are
rejected.

**Limits and follow-up:** The greenfield schema currently has no migrated AI
review-status model or full node-reachability diagnostic model, so their
source-shaped overview counts/diagnostics are deliberately zero/empty. The
selected-map configuration endpoint separately requires source `world_maps`
update authority and returns authored map assets, map presentation, current
delete eligibility, access groups, manageable learning groups, role/topic
options, and reusable items/tools. Those support lists are resolved only after
map authorization; manageable groups retain the source update-scope and
manager-membership rule. Neither read is exposed through a new frontend screen
until the existing World Builder screen can consume its complete necessary
data. The selected-node endpoint now separately requires `world_activities`
update authority and returns the source editor's graph, activity/transition,
eligible preferred-start and ordered-start data. Its portal candidate list is
the source's concrete *exit activities* from every map in the same World—not
the overview's node candidates nor merely the caller's other editable maps.
It also returns reusable item/tool/sound, message-topic, concept/topic and
source-catalog support reads. Dedicated greenfield authoring columns and
catalog tables hold these facts rather than learner-playback records. AI review
templates, review history and review-queue commands remain unavailable, so the
existing World Builder React route is still deliberately not exposed.

**Follow-up command boundary:** The first selected-node mutation persists only
the activity graph's special `start`/`end` coordinates. It rounds the source's
numeric position input, locks the scoped node while updating its authoring-only
layout JSON, and uses the same activity-update scope and CSRF boundary as the
read. It does not imply that route starts, activity positions, transitions or
any learner-facing behavior may be updated yet.

**Route-start follow-up:** The next command pair owns only membership between a
selected node and its eligible activity starts. It is idempotent, rejects exit
portals and activities outside the node's map asset, locks the node while
changing the relation, and resynchronizes its compatibility preferred-start
field in the same transaction. This preserves the existing editor and learner
route invariant without exposing route presentation, ordering, transition or
activity-content mutations prematurely.

## Phase 1 gate

Phase 1 passed on 1 November 2026. The user accepted the monorepo, same-origin
`/api`, OpenAPI contract, read-only-first foundation, Rust-owned identity, two
greenfield databases, mounted media volume and local-system proof of concept.

The phase-2 local foundation was verified with the separate frontend, backend,
application PostgreSQL and identity PostgreSQL services. It does not deploy to
production, switch production routing, import legacy data or enable user-facing
writes. Fresh schema and bootstrap details remain reviewable implementation
artifacts, not a reason to delay this bounded foundation.
