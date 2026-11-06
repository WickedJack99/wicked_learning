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
settings screen. Until source sound preferences are migrated, it uses the
source default of unmuted effects at full volume; that bounded limitation is
explicit rather than silently inventing a new preference model.

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

## Phase 1 gate

Phase 1 passed on 1 November 2026. The user accepted the monorepo, same-origin
`/api`, OpenAPI contract, read-only-first foundation, Rust-owned identity, two
greenfield databases, mounted media volume and local-system proof of concept.

The phase-2 local foundation was verified with the separate frontend, backend,
application PostgreSQL and identity PostgreSQL services. It does not deploy to
production, switch production routing, import legacy data or enable user-facing
writes. Fresh schema and bootstrap details remain reviewable implementation
artifacts, not a reason to delay this bounded foundation.
