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

**Status:** Accepted — 3 November 2026

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

**Why:** This is the safe read foundation for lifting the original journal
overlay without pretending that editing, export, expert access, learning
check-ins or revisit invitations have migrated.

**Alternatives:** A generic journal endpoint keyed by browser-supplied page or
principal IDs would weaken ownership. Adding disabled edit/review controls
would misrepresent unavailable workflows. Both are rejected.

**Limitations and trigger:** The basic page writer is separately defined in
ADR-024. Export, feedback requests, check-ins and revisit invitations still
need their own source UI and authorization evidence.

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

**Limitations and trigger:** The original optional topic link is not exposed
until the authenticated topics reader is migrated. Learning Desk's separate
bookmark rail and the remaining learner navigation need their own
source-derived contracts.

## ADR-027: Topics directory is a private contract foundation, not a partial route

**Status:** Accepted — 5 November 2026

**Problem:** The source topic directory is authenticated, paginated and
searchable, but every listed topic navigates to the source topic-detail flow.
Publishing a Rust `/topics` page before that flow exists would create links to
an invented reader, a generic card page, or a non-functional destination.

**Decision:** Create the greenfield topic-area/topic schema and authenticated
`GET /learner/topics` contract first, plus the source detail page's separate
authenticated Overview and Maps reads, while keeping the browser `/topics`
route unavailable. The directory returns only published root topics in a
source-ordered area, applies literal bounded search and six-item pagination in
PostgreSQL, and derives each map count from maps the authenticated principal
may currently view. Overview returns a published topic header and bounded
published subtopics; Maps returns only maps currently visible to the
authenticated principal. The browser does not receive topic IDs, unpublished
records, arbitrary map access, or a client-filtered collection.

The next browser slice must add the source topic-detail reader and preserve
the directory's original links before exposing `/topics`. It must not replace
those links with an unrelated list, disabled control, or a changed default
section merely because only one detail panel is ready.

**Why:** This makes the data, authorization and URL boundary reviewable now
without presenting an incomplete workflow as migrated. It also preserves the
original separation between topic discovery and the learner-specific detail
trail.

**Alternatives:** Returning all topics to React for filtering would expose
unpublished or inaccessible context and lose source pagination semantics.
Publishing a directory whose links lead to a simplified topic summary would
make an unfinished substitute part of the product. Both are rejected.

**Limitations and trigger:** This does not migrate the topic-detail browser
surface, its default Trail, competence, Paths, learner progress or
topic-map browsing. The contracts are local authenticated backend foundations
until every source-defined section required by the browser flow has matching
reads and browser evidence.

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
foundation. PostgreSQL applies publication, map-role visibility, static
available-node, empty-space, portal-input, topic, intent and time-guide
predicates before pagination. It returns at most six source-ordered starts,
their server-owned World destinations, authored presentation, valid
competence-topic metadata and only the caller's route progress. Intent defaults
match the source activity-type rules when configuration is absent; only 15- and
30-minute filters are retained. Unknown source query values normalize to no
filter as the Laravel controller does.

**Why:** This retains server authority for availability and creates one bounded
reader that both the future `/paths` page and topic Routes panel can consume.
It avoids browser-side joins of map access, node state, start presentation and
private progress.

**Alternatives:** A browser-filtered World snapshot would disclose more content
than the source Paths reader needs and make eligibility client-controlled.
Publishing a card-list `/paths` page now would be a substitute for the source
Paths workflow. Both are rejected.

**Limitations and trigger:** The endpoint intentionally does not claim dynamic
schedule, reveal or unlock parity; rows using those source capabilities must
remain unavailable until their learner-state model and authorization evidence
exist in Rust. The React `/paths` route and the topic Routes tab remain absent
until the source controls can start a server-authorized run and every source
eligibility input is represented.

## Phase 1 gate

Phase 1 passed on 1 November 2026. The user accepted the monorepo, same-origin
`/api`, OpenAPI contract, read-only-first foundation, Rust-owned identity, two
greenfield databases, mounted media volume and local-system proof of concept.

The phase-2 local foundation was verified with the separate frontend, backend,
application PostgreSQL and identity PostgreSQL services. It does not deploy to
production, switch production routing, import legacy data or enable user-facing
writes. Fresh schema and bootstrap details remain reviewable implementation
artifacts, not a reason to delay this bounded foundation.
