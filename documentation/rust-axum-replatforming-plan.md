# Rust/Axum Replatforming Plan

## Status and purpose

This is a proposed implementation plan for replacing the Laravel/Inertia
application with separately deployable React/TypeScript and Rust/Axum
applications. It is a planning artifact, not an approved implementation, and
does not change the current Laravel application's architecture or behavior.

The aim is behavioral continuity, not a line-for-line framework translation.
The learner-facing privacy, accessibility, orientation and agency boundaries in
[Product Direction](product.md) remain acceptance criteria throughout the
rework.

## What the current repository shows

The current application is a Laravel 13, Inertia 3 and React 19 monolith. Its
production deployment uses PostgreSQL, database-backed sessions and cache, a
database queue configuration, local public storage for uploads, and one
container that also builds Vite assets. See [Architecture Notes](architecture.md)
and [Deployment](deployment.md).

Static source inspection on 1 November 2026 found:

| Area              | Evidence                                                                                                                                     | Migration consequence                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Domain data       | 80 Eloquent models and 167 Laravel migrations                                                                                                | Use the current implementation as behavior/domain evidence; design fresh Rust-owned schemas because no legacy data migration is required. |
| HTTP surface      | 87 `GET`, 104 `POST`, 2 `PUT`, 63 `PATCH`, and 29 `DELETE` declarations across the route files                                               | Inventory by user journey and API contract, not only by controller.                                                                       |
| Frontend          | 66 route-page source files; 128 frontend files import Inertia or use its router/forms                                                        | React components can be retained, but routing, data loading, mutation, error and flash-message behavior must be deliberately replaced.    |
| Learning behavior | `app/Learning` contains 80 actions, 50 queries and 40 serializers                                                                            | These existing boundaries are the best behavior inventory for Rust use cases and response DTOs.                                           |
| Authentication    | Fortify sessions, email verification, password reset, two-factor authentication and passkeys                                                 | Authentication must be a dedicated workstream and cutover gate, not incidental middleware.                                                |
| Core graph        | World -> Map -> MapAsset -> internal compatibility Node -> Activity routes/transitions                                                       | Preserve learner/author behavior, but decide whether a new model needs the Laravel-only Node compatibility relation.                      |
| Rich workflows    | Progress, recall, reflections, journals, shared tasks, organizations, moderation, authoring history, import/export, uploads and AI authoring | Migrate complete vertical slices, with exactly one writer for each capability at any time.                                                |

The phase-0 report records the executable Laravel baseline and source inventory.
It is historical baseline evidence, not a constraint on the new greenfield
foundation.

## Recommended target shape

Use a modular monorepo initially. It gives the independently deployable
frontend and backend atomic contract changes and a single migration/runbook
home. Splitting into two repositories can be reconsidered only after the
contracts, release process and team ownership are stable.

```text
Browser
  |
  +-- React + TypeScript SPA (independent Vite build)
  |       - presentation, local interaction state, accessibility
  |       - generated typed API client; no domain authorization decisions
  |
  +-- same-origin reverse proxy
           |
           +-- Rust/Axum API
                   - authentication and authorization
                   - application use cases and domain rules
                   - JSON API, uploads/downloads, audit events
                   - OpenAPI document and health/readiness endpoints
                   |
                   +-- identity PostgreSQL database
                   +-- application PostgreSQL database
                   +-- object/file storage for media
                   +-- optional worker process for durable background work
```

Prefer same-origin delivery (for example, the SPA at `/` and API at `/api`) at
first. It keeps the applications independently deployable while avoiding a
credentialed cross-origin browser boundary. If separate origins are required,
explicitly allow only known frontend origins and test CORS, cookies and CSRF as
one security boundary.

### Backend architecture

Use a Rust workspace with a small dependency direction:

```text
backend/
  crates/
    api/             Axum routes, extractors, HTTP DTOs, middleware
    application/     use cases and transaction boundaries
    domain/          rules, value objects, policies, domain errors
    persistence/     PostgreSQL repositories and SQLx row mappings
    infrastructure/  storage, mail, AI-provider and clock adapters
  migrations/
    identity/         forward-only identity-database SQL migrations
    application/      forward-only application-database SQL migrations
  tests/             API, database, contract and migration tests
frontend/
  src/               current React components/features, decoupled from Inertia
contracts/
  openapi/           versioned API specification and compatibility fixtures
infra/               images, proxy configuration and deployment manifests
```

The `domain` crate must not depend on Axum, SQLx, HTTP response types or React
payload names. The `api` crate validates and translates HTTP input, invokes one
application use case, and maps expected failures to a stable problem response.
The persistence layer maps database rows to domain/application structures;
database rows must never become the public API by accident.

Organize modules around existing behavior, not generic technical layers:

| Rust module          | Current concepts to inventory and preserve first                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `identity_access`    | users, preferences, roles/permissions, registration tokens, access links, access-change audit, verification and recovery |
| `world_content`      | worlds, maps, MapAssets, compatibility nodes, activities, starts, transitions, portals, activity templates and versions  |
| `learner_state`      | discovery, bookmarks, route/activity progress, answers, recall, reflections, review attempts and evidence                |
| `collaboration`      | learner messages, groups, shared-task submissions/reviews and organizations/moderation                                   |
| `authoring`          | graph editing, import/export, revisions, topics, concepts, source records and translations                               |
| `media_presentation` | reusable media metadata, map/item/tool/sound media, platform presentation and protected serving                          |
| `platform_admin`     | information pages, feedback, language and platform settings                                                              |
| `ai`                 | provider credentials, templates, authoring runs, bounded companion and review flows                                      |

This is a modular monolith, not a microservice plan. Do not introduce network
calls between these modules. A single Axum service and transaction boundary is
the least risky replacement for the existing monolith; future service
extraction requires a demonstrated operational or scaling need.

### Foundation layout and workspace transition

The first executable proof of concept intentionally began as one small binary
crate under `backend/src`. It validated the Compose topology, generated
contracts, separate databases, Rust-owned sessions, CSRF, mounted media and
read-only endpoints before there were demonstrated application/domain seams.
This limited exception is recorded in ADR-014; it must not become the permanent
layout. Before the World content slice expands beyond its migration foundation,
move the backend to the workspace and dependency direction above. Any later
structural exception requires a recorded ADR with a concrete extraction trigger.

### Technology choices to validate in a proof of concept

These are recommendations, not dependency approvals. Pin exact versions only
after the proof of concept and security review.

- Axum with Tokio and Tower/Tower HTTP for typed routing, middleware, timeouts,
  request IDs and tracing. Axum composes routes with shared typed state and
  Tower middleware; middleware ordering must be tested because it is
  significant. [Axum router and state](https://docs.rs/axum/latest/axum/struct.Router.html),
  [Axum middleware](https://docs.rs/axum/latest/axum/middleware/index.html)
- SQLx with PostgreSQL for explicit async SQL, typed mappings and SQL
  migrations. Configure pool limits from the PostgreSQL connection budget and
  make migration execution a one-off deployment job, not a task each replica
  races to run. SQLx supports embedded migration sets and statically checked
  queries. [SQLx](https://docs.rs/sqlx/latest/sqlx/),
  [SQLx migrations](https://docs.rs/sqlx/latest/sqlx/macro.migrate.html)
- OpenAPI as the versioned source for browser contracts, with generated
  TypeScript request/response types and a checked-in compatibility fixture.
  `utoipa-axum` is a candidate because it can collect annotated Axum handlers
  and produce an OpenAPI document; assess generated output and ergonomics in
  the proof of concept. [utoipa-axum](https://docs.rs/utoipa-axum/latest/utoipa_axum/)
- `tracing` plus request IDs, structured logs and metrics. Set the request ID
  before request tracing and propagate it to responses. [Tower HTTP request
  IDs](https://docs.rs/tower-http/latest/tower_http/request_id/index.html)
- `axum-login`, `tower-sessions` and `tower-sessions-sqlx-store` for
  server-side identity-database sessions and Axum authentication integration.
  The application still owns its authorization policy. [tower-sessions](https://docs.rs/tower-sessions/latest/tower_sessions/),
  [tower-sessions SQLx store](https://docs.rs/crate/tower-sessions-sqlx-store/latest),
  [axum-login](https://docs.rs/axum-login/latest/axum_login/)
- RustCrypto `argon2` for Argon2id password hashes, `webauthn-rs` for
  server-side WebAuthn/passkey ceremonies, and a maintained TOTP crate after a
  proof-of-concept compatibility review. [Argon2](https://docs.rs/argon2/latest/argon2/),
  [webauthn-rs](https://docs.rs/webauthn-rs/latest/webauthn_rs/),
  [totp-rs](https://docs.rs/totp-rs/latest/totp_rs/)

Adopt a library-first policy. Use maintained libraries for generic facilities
such as database access, migrations, authentication primitives, sessions,
password hashing, passkeys, TOTP, mail, media storage, OpenAPI, HTTP middleware
and observability. Write narrow adapters only where the application needs its
own policy or data mapping. Do not recreate Eloquent with a custom ORM or write
a PostgreSQL driver: begin with explicit SQLx queries and repository methods so
joins, authorization scopes, pagination and bounded payloads stay visible.

## Non-negotiable architecture rules

1. **The API contract is the frontend/backend boundary.** The SPA never calls
   database-shaped endpoints or reconstructs server policy from configuration.
2. **One capability has one active writer.** Never dual-write learner progress,
   content changes, uploads or authorization changes from Laravel and Rust.
3. **Use new identifiers deliberately.** The greenfield identity subject is an
   opaque UUID; application identifiers, slugs, timestamps, JSON configuration
   and foreign keys must be designed and documented rather than inherited by
   accident from Laravel.
4. **No compatibility decoding of Laravel sessions in Rust.** Choose a clean
   authentication cutover or an identity-provider bridge; Laravel session
   serialization is not a durable inter-service contract.
5. **No silent fallback to a more permissive policy.** An unimplemented Rust
   authorization check must deny access and be visible in logs/tests.
6. **No unreviewed database design.** The new identity and application schemas
   require reviewed domain models, forward-only SQL migrations and real
   PostgreSQL tests before a capability is released.
7. **No framework-generated browser navigation contract.** Replace Inertia,
   Wayfinder and Laravel form redirects with intentional React Router
   navigation, query caching/loading behavior and typed API errors.

## API and frontend contract

Design versioned JSON resources and commands by user task. Do not mechanically
rename every current web route under `/api`.

### Contract conventions to decide before the first production endpoint

- Base path and versioning, initially `/api/v1`.
- Opaque identifier representation, ISO-8601 UTC timestamps, nullable-field
  behavior, enum values and decimal handling.
- Pagination envelope, cursor or page parameters, stable sorting and collection
  bounds. Preserve current pagination/scoping rather than returning complete
  maps or journals.
- A consistent error response such as RFC 9457-style problem details with a
  machine-readable code, field errors, correlation ID and no internal details.
- Idempotency keys for retryable mutations that grant tools/items, complete
  activities, apply content plans or create payments-like irreversible state.
- ETags or explicit version fields for authoring updates and restores so a
  stale editor cannot silently overwrite another author.
- Upload initiation/finalization and protected download contracts, including
  maximum bytes, allowed content types, authorization and cache behavior.
- A documented deprecation rule: add fields compatibly, release generated
  client types, measure callers, then retire an endpoint only after its
  announced removal date.

Create an endpoint inventory spreadsheet or machine-readable register before
implementation. Each row needs: existing route/controller/action, user
journey, actor and permission, input validation, affected tables/media,
transaction boundary, response shape, error cases, rate limit, existing tests,
target endpoint and rollout owner.

Start with these vertical API families:

| Family                | First target endpoints                                                     | Important invariants                                                                                        |
| --------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Session and shell     | `GET /me`, login/logout/verification status, public presentation           | the client receives only safe current-user permissions and presentation data                                |
| Read-only exploration | world/map, search, paths, bookmarks, topics                                | access scope, reveal/unlock rules and bounded payload/query behavior remain server-owned                    |
| Activity playback     | route state, enter/check-in, answer, reflection, transition, restart/reset | run keys, transition eligibility, inventory grants and learner-private data cannot be forged by the browser |
| Learner records       | journal, recall, evidence and exports                                      | user ownership and bounded private history are preserved                                                    |
| Authoring             | maps/assets/activities/graphs/versions/templates                           | granular permission and optimistic-concurrency behavior are explicit                                        |
| Media                 | upload, reference selection, protected/public delivery                     | no path traversal, orphaning or unauthorized download                                                       |
| Collaboration/admin   | organizations, moderation, access links, roles and settings                | authorization is checked at each resource and state transition                                              |
| AI                    | provider settings, reviewed plans, bounded companion turn                  | secrets stay server-side; AI cannot mutate content or navigate without a reviewed server action             |

### Frontend extraction sequence

1. Create an independent Vite React app and retain existing TypeScript,
   Tailwind, Radix and feature/component source where it does not import
   Inertia, Wayfinder or Laravel-generated routes.
2. Introduce an API client abstraction and generated contract types. Place
   fetch, credentials, CSRF, retry, timeout and error translation in one
   reviewed client, not individual components.
3. Replace each Inertia page with a React route only when its API family is
   available. Replace `usePage`, Inertia partial reloads, flash props,
   `router.*`, `useForm`, redirects and route helpers deliberately.
   The existing React page, feature and shared-component source is the visual
   and interaction reference: lift and adapt it around the new client rather
   than replacing it with an approximation. Do not add substitute navigation,
   cards, copy, colors or interaction patterns merely to make an incomplete
   API slice appear complete. If a referenced component cannot yet run without
   Laravel, keep that route unavailable until its needed contract exists.
4. Preserve URL, deep-link and browser-history semantics. Build a URL mapping
   table for existing learner, settings and public URLs; route old URLs through
   the proxy or React Router with permanent redirects where appropriate.
5. Retain server authority for all navigation choices, progress resolution,
   permissions and activity outcome logic. The React client may render an
   offered transition but must not calculate one.
6. Add browser-level coverage before switching a slice: normal path,
   unauthorized path, validation error, back/refresh, narrow viewport and
   keyboard/focus behavior.

### Frontend visual-fidelity requirement

The replatforming must preserve the original learner-facing UI rather than
create a new interpretation of it. The existing React pages, components,
Tailwind classes, design tokens, icons and accessibility behavior under
`resources/js` and `resources/css` are the visual source of truth until the
product explicitly approves a redesign.

- Prefer lifting the existing component markup and styles into `frontend/`.
  Replace only Laravel/Inertia-specific glue such as `usePage`, Inertia links,
  forms, router calls and generated route helpers with React Router and the
  typed Rust API client.
- Use the existing maintained frontend libraries where they are already part of
  the original UI; do not recreate their controls or approximate their styling
  with new bespoke CSS when the original component can be decoupled.
- When a Rust API is not available yet, retain the original page structure and
  interaction affordances where safe, with an explicit unavailable/loading
  state. Do not replace the screen with a newly designed alternative merely to
  make it appear complete.
- Before accepting a migrated page, compare it with the Laravel version at
  desktop and narrow viewports. Check layout, navigation, focus/keyboard
  behavior, empty/loading/error states and visible copy. Store focused browser
  coverage for the migrated route.

The standalone learner shell and exploration styling introduced during the
foundation are provisional proof-of-concept work. They are not visual-migration
acceptance and must be replaced or brought into close alignment with the
corresponding original React UI before the frontend slice is considered done.
The standalone Welcome page is the first fidelity migration: it reuses the
original layout, content structure, Tailwind utilities and Lucide icons while
substituting React Router and the existing Rust session state for Inertia.

### Active frontend provenance audit — 5 November 2026

The active Rust frontend was checked component-by-component against the named
Laravel React sources. The current code must retain this mapping; a new route
or control is not an acceptable stand-in merely because it can call a Rust
endpoint.

**Meaning of the classifications:** the standalone Vite application cannot
import a Laravel/Inertia page unchanged: those files depend on Inertia props,
Wayfinder route helpers, and Laravel-only client modules. “Source-adapted”
therefore means the original React component structure, Tailwind utilities,
icons, copy and interaction model have been lifted into `frontend/`, with only
that transport glue replaced by React Router and the typed API client. It does
not mean that a similarly styled new screen is acceptable. A smaller Rust
surface may omit a source control whose required contract is not ready; it may
not replace it with a newly invented workflow.

| Rust surface                 | Laravel React reference                                                                                                                                                     | Current boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome (`/`)                | `pages/welcome.tsx`, `components/appearance-tabs.tsx`, `hooks/use-appearance.tsx`, `theme/presentation.ts`                                                                  | Source-adapted markup, wheel/pager interaction, footer links and Light/Dark selector. The anonymous preference persists under the source browser-storage key and follows the visitor across public routes. `GET /public/presentation` supplies the server-owned welcome pages, backgrounds, palette and base theme instead of duplicated frontend defaults.                                                                                                                                                                                                                                                                                           |
| Login, registration and personal preferences (`/login`, `/register`, `/settings`, `/settings?panel=personal&personal=appearance`, `/settings?panel=personal&personal=language`, `/settings?panel=personal&personal=feedback`, `/settings?panel=personal&personal=sound`, `/settings?panel=personal&personal=security`) | `pages/auth/login.tsx`, `pages/auth/register.tsx`, `pages/settings/personal.tsx`, `components/platform-feedback-prompt.tsx`, `features/settings/profile-settings-panel.tsx`, `features/settings/appearance-settings-panel.tsx`, `features/settings/language-settings-panel.tsx`, `features/settings/sound-settings-panel.tsx`, `features/settings/security-settings-panel.tsx`, `layouts/auth/auth-simple-layout.tsx`, `components/appearance-tabs.tsx`, `hooks/use-appearance.tsx`, `theme/platform-theme.ts` | Source-adapted sign-in, invitation registration and Personal Profile/Appearance/Language/Feedback/Sound/Security forms/layouts, with Inertia submits replaced by typed Rust requests. Registration consumes a one-use identity-database invitation, provisions the separate application principal with the baseline learner role, saves the source Light/Dark choice as private application data and establishes a session. Profile preserves its name, sign-in email and optional public username fields across the identity/application boundary; profile-image upload now uses the completed mounted-volume media lifecycle. The lifted appearance, language and sound controls update only owner-scoped application preferences; Language reads the enabled application locales and persists the selected locale, while the default local catalogue intentionally contains English only until translation content is migrated. Feedback retains the source's occasional invitation, fourteen-day dismissal and durable decline/re-enable choice, without a campaign or analytics system. Sound retains the source mute, effects/ambience-volume and local-preview behavior. Security now preserves the current-password, replacement-password and confirmation flow through the identity-database credential boundary; it keeps the initiating server-side session current while verifier-bound older sessions expire. Password recovery, remembered sessions, passkeys, MFA, the other Personal-settings controls and the source administrator invitation UI remain unavailable rather than being imitated. |
| Information and source pages | `features/platform-info/platform-info-page.tsx`, `pages/source.tsx`, `features/platform-info/markdown-renderer.tsx`                                                         | Lifted page hierarchy, source layout and markdown renderer. The same public-presentation model supplies their palette and base welcome theme; their published text and source links remain separate bounded reads. The former floating source-code launcher was removed because it has no equivalent on the original information pages.                                                                                                                                                                                                                                                                                                                                            |
| World/map/search/node drawer | `pages/world.tsx`, `features/world/world-map.tsx`, `world-search.tsx`, `node-detail-drawer.tsx`, `activity-panel.tsx`, `map-asset-visual.tsx`, `components/app-side-action-bar.tsx`, `components/learner-navigation-header.tsx` | Source-adapted around the bounded public/learner contracts. Map assets, hit testing, desktop and narrow-screen search-panel structure, drawer geometry/swipe, original bookmark toggle, owned item/tool belt, equipped-tool map reveal/unlock, supported route-start cards and every currently available original learner-navigation destination retain their original structures. The lifted source theme resolver selects dark/light map, asset and route-start presentation from the server model. Source `tool_grant`, item-grant, item-obstacle, base-obstacle and NPC-dialogue configured tool-grant playback now follow server-owned acquisition, consumption and transition paths. Node-drawer obstacle/item use and member-only Groups now have their own contracts; source group creation and assignment is available to the migrated platform-administrator scope. Remaining World parity is tracked per unavailable authoring/access slice rather than by a substitute UI. |
| Personal bookmark map        | `pages/bookmarks.tsx`, `features/world/world-map.tsx`, `map-asset-visual.tsx`                                                                                               | Source-adapted personal-map, selected-place, return-to-source-map and removal flow. The same lifted dark/light map and asset theme resolution applies. Rust returns only the principal's bookmarks that remain visible, with their original map context and presentation asset.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Topics directory and detail  | `features/topics/topic-directory.tsx`, `features/topics/topic-detail.tsx`, `components/learner-navigation-header.tsx`, `components/learner-paginated-items.tsx`           | Source-adapted authenticated directory, search, bounded pagination, default Trail, keyboard tab strip, Routes filters/start action, Maps and Overview/subtopics. The selected topic’s header remains present in every section, beneath the shared lifted learner header with working Rust destinations, Journal and sign-out controls. Rust keeps path eligibility, topic context and opaque run issuance server-owned. Topic Trail competence drill-down, recent-reflection, competence evidence and return controls are restored: the first preserves source topic context in the Star Map, while activity controls use the shared CSRF-protected opaque replay command. Broader reflection-history controls remain omitted until their own data contracts and evidence exist. The standalone source `/paths` reader uses the same typed Paths contract, route-start command and shared header.                                                                                                                                         |
| Competence star map          | `pages/competence/index.tsx`, `pages/competence/competence-star-layout.ts`, `components/learner-navigation-header.tsx`, `components/learner-paginated-items.tsx`          | Source-adapted private Star Map, deterministic original SVG layout, shared learner header, map guide, selected-light reading, evidence ledger, learning-pulse timeline and bounded review history. Rust provides only the signed-in learner's qualitative evidence. The header retains only source destinations whose Rust routes exist, plus the existing private Journal and sign-out controls; unavailable source destinations are omitted. Topic context links use the existing authenticated topic reader. Revisit/check-in/review cards restore their source activity controls by obtaining a CSRF-protected authorized opaque replay run; the read model still never exposes a client-constructed activity URL. |
| Playback                     | `pages/learning/node-play.tsx`, `features/world/activity-panel.tsx`, `features/world/standard-activities.tsx`, `features/world/activity-ambient-sound.tsx`, `features/world/portal-scene.tsx`, `features/world/markdown-activity.tsx`, `features/world/tool-grant-activity.tsx`, `features/world/item-grant-activity.tsx`, `features/world/item-obstacle-activity.tsx`, `features/world/obstacle-activity.tsx`, `features/world/message-activities.tsx`, `features/world/learning-check-in.tsx` | Source-adapted open-practice, question, base-reflection, Portal, Markdown page graph, tool-grant, item-grant, item-obstacle, base obstacle, peer-message prompt and peer-message wall frames, followed on ordinary route runs by the lifted optional source check-in pause. The source Activity Frame's pre-activity learning focus, related learning-area links and `From beginning` route reset now use the same bounded server projection/authorized reset command; focus is no longer delayed until after completion, and a restart cannot be used for portal, revisit, recall or replay runs. Rust owns answer evaluation, reflection persistence, server-authorized portal travel, safe bounded authored Markdown pages, configured-tool ownership, configured-item probability rolls/holdings, item-obstacle slot consumption/locks and source `notMet`/`transition`/`met` effect events, owned configured-tool obstacle resolution, peer-message topic binding/visibility and completed-activity transitions; it exposes only bounded authored check-in context, and accepts a check-in only after server-side completion. Reflection persistence now follows the source save-then-complete boundary: the migrated base surface saves then immediately uses the server-owned completion command, while the typed Rust contract keeps source-derived transfer context, authored cues and independent-check eligibility for the later exact explain/transfer/review UI lift. Revisit runs deliberately return to World rather than recording a second ordinary check-in. Question feedback now includes the source confidence reflection, an up-to-three private earlier-attempt summary, optional post-feedback confidence, and the source keep/remove-recall control. Reloading an active question restores only that run's latest evaluated answer and its bounded earlier-attempt context; a fresh run does not inherit it. Recall attempts are separate one-question runs: they never advance a route or create evidence. Published activity ambience and item-obstacle effects follow the source player and saved learner comfort controls through bounded sound projections; base-obstacle effects and remaining unsupported activity types remain separate contracts and are not silently represented as complete; staff peer-message moderation is recorded with the source staff workspace below. |
| Private journal              | `components/learner-account-controls.tsx`, `components/learner-paginated-items.tsx`, `features/journal/journal-overlay.tsx`, `pages/settings/admin-panel.tsx`, `pages/settings/journal.tsx`, `features/platform-info/markdown-renderer.tsx` | Source-adapted learner-owned overlay, reached from the original journal control. Rust scopes and paginates private page markdown and durable learning context, and supports the source add/edit/view/save/delete controls. The bounded source Learning trail now shows recent check-ins, preserves its source competence destination and reopens an activity only through a CSRF-protected opaque replay run. Due revisit invitations use the lifted source sidebar panel, one-at-a-time pagination and `Open activity`/`Later`/`Hide` controls; opening first obtains a server-owned opaque revisit run. The source one-time review request is now available for a saved page when the source policy is enabled; requests remain private unless deliberately shared, then authorized staff may give one immutable response. Destinations currently cover Journal and migrated learning groups; organisation destinations await the organisation slice. The original Export control downloads only the learner's own pages in source-compatible Markdown; it excludes check-ins and review metadata. The source-default light/dark paper presentation is served by Rust and follows the active appearance while the overlay is open. Fuller check-in history/timeline and administrator-configurable presentation/media assets remain unavailable. |

### Private Learning Support slice — 6 November 2026

The earlier `/home` migration row below predates this slice; its statement that
private support responses are absent is superseded. A source-adapted private
support request panel now appears for the supported `message_prompt` activity,
and a learner's own visible replies appear in the lifted Learning Desk area.
The typed Rust contract enforces a single learner request per topic, scoped
route/replay ownership, published map visibility and a request-before-complete
rule. A separate capability-gated staff contract can list bounded private
requests and create/update the current worker's reply, with a narrow
identity-store email projection only after authorization. See ADR-049 for the
cross-database rationale and the exact boundary.

This is not full Settings parity. The source-derived Learner Messages
workspace is now available to locally authorized Learning Support staff at
`/settings?panel=admin-learning-support&support=learner-messages`. It retains
the source topic navigation, helpful/unconfirmed filters, private reply editor,
hide/restore and deletion controls for private-support and peer messages. A
staff reply remains deliberately limited to private support; peer responses
remain learner activity. The capability-gated Rust contract preserves the
source rule that hidden material is withheld from learner readers while a
hidden request still consumes its single contribution. Deleting a request
deletes its replies, matching the source's ownership semantics.

### Peer message prompt and wall slice — 6 November 2026

The learner-facing peer path now lifts the original `MessagePromptActivity`
and `MessageWallActivity`: an optional, one-per-topic peer contribution leads
through the usual source check-in to a bounded, randomly ordered page of
visible peer notes. A learner may add one visible response to another
learner's note, and the original note author may mark one visible response
helpful. The Rust contract keeps the current route activity, configured topic,
map asset, audience, response eligibility, visibility and helpfulness state
server-owned; React receives only its source-shaped presentation model.

The peer wall and the source-derived staff workspace now share the same
capability-gated moderation contract. Staff can filter peer notes by the
source helpfulness states, hide/restore/delete peer messages or responses, and
immediately affect what learners can read on the wall; staff cannot add public
peer replies. The local Compose browser journey verifies contribution, the
ordinary check-in transition, the rendered wall and the hide/restore effect;
see ADR-050 and ADR-051 for detailed behavior and limits.

### Shared Task slice — 6 November 2026

The learner route now includes the original Shared Task activity structure:
contribution, bounded anonymous examples, optional anonymous peer review and a
private project checklist remain separate in-panel areas. Rust owns the active
route boundary, configuration validation, submission policy, explicit sharing
choice, five-entry display bounds, anonymous review eligibility, helpfulness,
contributor-only follow-up, one revision after received feedback and the
shared contribution threshold. The active playback contract restores the
caller's private checklist after a reload without projecting it to other
learners. Completion is rechecked server-side against the activity-wide
accepted threshold; the browser cannot bypass it. Replay, recall and revisit
runs deliberately do not offer Shared Task writes. A local Compose browser
journey uses two fresh local identities to verify contribution, anonymity,
review, helpfulness, follow-up, revision, checklist persistence and the
source-adapted React frame.

The peer-wall completion path also now retains the configured topic/map
authorization before following an authored next transition, allowing the
source-shaped demonstration route to reach Shared Task without creating an
unbounded exit route.

### Portal travel slice — 6 November 2026

The original Portal scene, assets, typing bubble, arrival behavior and reduced
motion handling now run through a typed Rust contract. An output portal can
only travel through an authored source-to-input link. Rust rechecks the active
source run, map publication and role scope, authored link, target input portal
and destination availability before completing the departure activity. It then
returns an opaque, server-owned arrival run rather than a browser-selected
destination route. The source optional check-in remains visible before React
navigates to that arrival scene; completing the input portal records the target
activity and returns to World without resetting or advancing an unrelated
destination route. A retry returns the same active arrival token safely.

This is the learner playback/travel boundary only. Portal authoring and a
general map-link editor remain separate work; the fresh local content exists
solely to exercise the source-shaped vertical slice.

### Learner sound-preference slice — 6 November 2026

The original account-menu sound controls now save the learner's private mute,
effects-volume and ambience-volume choices through Rust. Dialogue typing audio
uses the saved effects setting. Published source-configured activity ambience
now also uses the saved ambience setting through the bounded playback-sound
projection described below. Reusable sound uploads, authoring and item-obstacle
effects remain separate media work; they must not be approximated with
browser-selected URLs.

### Published activity ambience slice — 6 November 2026

The player now lifts the source `ActivityAmbientSound` behavior. A safe
activity configuration may name one enabled ambience record, and Rust projects
that record only when it is published. The browser then plays that known URL
while the activity is open, honours loop/play-duration/author volume and
immediately reacts to the learner's saved mute and ambience-volume settings.
The fresh Portal demonstration content supplies a local `quiet-pulse` example
solely to prove the complete authored-config-to-browser path.

The broader media boundary has deliberately not moved: there is no sound
upload, sound-library/editor UI, arbitrary URL playback, protected audio,
object storage, or base-obstacle effect playback in this slice.

### Item-obstacle sound-effect slice — 6 November 2026

The lifted item-obstacle scene now restores the original three source effect
events: initial unmet state, transition to a met state, and met-state feedback.
Its safe configuration accepts only those names and valid published sound IDs;
the browser receives no other configured sound reference. Effects obey the
learner's private effects-volume and mute settings. Fresh local demonstration
content links the existing item-grant and item-obstacle contracts so the full
receive, place and effect path remains testable without legacy data.

### NPC dialogue slice — 6 November 2026

Published `npc_dialogue` activities now join the supported ordinary route-run
start cards and playback surfaces. The implementation lifts the original
dialogue frame and server-owns its authored graph, answers, back state,
private reflection, configured tool grant and end-only completion. The local
Compose browser test covers the rendered flow and its persisted journal entry.

This does not make the wider World work complete: node-drawer NPC tool grants
remain unavailable. A historical NPC dialogue replay now uses the same
server-authorized opaque replay-run boundary as the other supported activity
types: it begins at the authored dialogue start, accepts only authored answers
and cannot advance route progress.
The scene now renders source-authored asset layers and character entrance
motion from the existing safe graph configuration; the frontend image carries
the original public visual assets needed by these scenes. The source dialogue
typing-audio behaviour is also restored through a bounded sound-set contract:
an enabled node chooses an authored set or its default, and the player uses the
matching letter WAV while revealing text. The initial set uses only existing
bundled public assets. General sound media, upload/authoring and learner sound
preferences remain separate work and are not implied by this slice.

Transport-only loading, unavailable and authorization-error branches may be
introduced where the original page received server props synchronously. They
must use the surrounding lifted page surface and must not become a replacement
product UI. This audit records source provenance, not completion: every row
still needs the contract, browser and behavior-parity evidence required by its
slice.

### Follow-up UI audit — 5 November 2026

The reachable standalone frontend was rechecked after the removal of the early
proof-of-concept navigation. No public `Explore` page, public `Search` page,
generic dashboard, or substitute route shell remains. The original application
does not expose those as public destinations: map search belongs within the
World surface, and the current frontend retains it there through the lifted
`features/world/world-search.tsx` structure, including its narrow-screen
panel.

The audit found no visible page that should be removed for being an invented
screen. The remaining adaptations are limited to replacing Laravel transport
glue with the typed Rust client and omitting original controls whose complete
contract is not available yet:

This is a source-provenance finding, not a claim that every source feature is
already migrated. In particular, World navigation, bookmark maps, activity
playback and Journal expose only the original substructures for which the Rust
contract exists. Their absent source controls remain absent until their
corresponding contract and server-owned behavior are available.

| Reachable area                        | Source-derived elements retained                                                                                                                                                                  | Intentionally absent rather than imitated                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public welcome, login, registration and information | Original page hierarchy, Tailwind classes, icons, pager, appearance control, footer and source/info layouts, with server-owned logo/pages/palette/base theme; the source login/registration cross-links and invitation fields are lifted | Password recovery, remembered login, passkeys, MFA, administrator invitation/presentation editing and the full source cursor set |
| World                                 | Original map renderer, alpha-aware interaction, asset visual, map search, node drawer, bookmark control, route-start cards, journal trigger, account-menu shape with its source Settings destination, owned inventory/tool-belt with map-node use, configured NPC dialogue tool grants, and the original floating Groups control. Groups retain the source member-only reader, bounded source message history, help-request/other-member resolution and member-majority staff-chat consent commands through Rust-owned contracts. | Notifications and unavailable Personal-settings entries, node-drawer obstacle item use, and other unsupported World behavior |
| Bookmarks, playback and journal       | Original personal-map, activity-frame, question/reflection, optional post-activity check-in (including its hide/show conclusion behavior), markdown, journal editor/list/export, one-time source journal-review request/reply, bounded check-in Learning trail with its competence/activity controls and due-revisit invitation structures | Source controls for unavailable data such as Journal review history and fuller check-in history/timeline |

An omitted control is not permission to add a newly designed replacement. A
later slice must first provide its Rust contract, then lift its corresponding
source component and verify the result at desktop and narrow viewports.

### World parity boundary

The current `/world` React route uses `GET /api/v1/learner/world` for a
signed-in session and the public contract for an anonymous visitor. The
authenticated contract provides a server-owned snapshot of visible maps plus
the current principal's bookmark, activity-progress, route-progress, owned
items and owned tools. It applies server-evaluated availability before it
offers a route, and the lifted source tool belt can submit an equipped owned
tool to the single source-derived map-node reveal/unlock command. It renders
saved-place and completed-activity signals, and now renders only
server-authorized `open_practice`, question, base-reflection, Markdown,
NPC-dialogue, tool-grant, item-grant, item-obstacle and base-obstacle start cards for a
signed-in learner. Each lifted original start/reset control calls a Rust command with its
authored start UUID; the browser then navigates to the matching server-owned
play run. Anonymous visitors receive no start control. A disabled imitation of
the original controls is not acceptable. The route intentionally does not yet
support node-drawer obstacle/item use, node-drawer NPC tool grants, group data, audio configuration,
or the full serializer state consumed by Laravel's
`LearningWorldSerializer` and its `WorldMap`, `NodeDetailDrawer` and
`ActivityPanel` components. The original `NodeDetailDrawer` geometry, close
control, scroll ownership and touch-swipe behavior, plus the supported
start-card presentation, are lifted onto the interim route. It must therefore
not be described as a completed World migration.

Before treating the route as visually or functionally migrated, define the
corresponding Rust read contract from that serializer, preserve its bounded and
authorized server-owned state, then lift the existing React components and
replace only their Inertia/Laravel glue. Do not extend the provisional map with
new substitute controls or styling to mask missing behavior.

The application schema now distinguishes a route from a node-specific activity
start, matching the existing `LearningActivityStart` behavior. Route progress
is keyed to the authored activity start, so a route can later be offered from
more than one node without merging those learners' runs.

The local learner-state phase is approved. `POST` start/resume and reset
commands now resolve an authorized start and generate a server-owned play run
(ADR-017). `GET /api/v1/learner/play-runs/{play_run_id}` supplies the
authorized current supported activity document. The generic completion command
advances only the active server-owned simple activity (including the bounded
Markdown page graph); specialised tool/item grant and obstacle commands first
enforce their source-defined ownership, probability, slot or tool-resolution
rules. The question answer command evaluates selected option keys and records
the private attempt while preserving the active run so the learner can read the
source feedback and retry independently. Only the subsequent generic completion
command finalizes the latest server-validated question attempt and resolves its
authored branch. At finalization it may accept only the source's bounded
post-feedback confidence value; it never accepts a browser-supplied outcome,
attempt number, selected option, or transition. The answer response contains
at most three older attempts belonging to the same learner and authored
question, using authored option labels rather than database identifiers. This
is an immediate feedback/history aid, not the later recall queue or a broad
learner record export. The active-playback read projects the latest answer only
from its exact server-owned run, so refresh restores pending feedback without
carrying prior-route state into a fresh run. React uses those contracts on
the legacy player URL family with lifted activity frames: after an in-progress
transition it re-reads the same run, and after a terminal transition it returns
to the focused World location. It does not derive or submit a transition
target. This remains isolated to the local Rust Compose database; Laravel and
production ownership are unchanged.

The supported local playback writers also append a normalized private evidence
snapshot when an authored activity config declares competence topics. The
server derives topic contribution, intent, outcome and attempt context from the
authorized activity/run transaction; React does not submit or display evidence.
The fresh Orientation activities exercise this boundary. The lifted source
competence map now consumes its qualitative aggregation and private source UI;
cross-user evidence is deliberately not part of that learner-facing surface.

Loading an authorized active play run also mirrors the source activity-entry
topic history: the backend atomically replaces that learner's private last
topic set and increments private topic-to-topic pairs only when the set has
changed. A visit remains separate from completion evidence and this history is
not returned by any playback contract. It is consumed only by the authenticated
source-derived competence map, where it is shown as private qualitative
learning-pulse context rather than a score.

`GET /api/v1/learner/competence` provides the authenticated contract for the
lifted source competence map. It derives the source qualitative ratios, tiers,
recent descriptions, evidence-type labels, twelve most-recent private evidence
entries per topic, and bounded private transition pairs. It returns no score,
reflection text, hidden metadata, or activity URL that could bypass Rust's
start/run authorization. React consumes it at `/competence`; its source
learning-pulse, review-history and topic-return controls obtain an authorized
opaque replay run with a separate CSRF-protected command rather than receiving
a client-buildable activity URL.

### Reference behavior and implementation autonomy

The Laravel application and its React frontend are the behavioral reference for
this replatforming. This is a backend/platform replacement, not a product
redesign. Existing route behavior, business rules, authorization, learning
state transitions, edge cases, React components, layouts, styles and automated
tests establish the expected result unless a later product decision explicitly
changes it.

When behavior is uncertain, investigate the existing controllers, actions,
models, serializers, database relations, React code, tests and current project
documentation before requesting a decision. The migration may use greenfield
Rust schemas and idiomatic Rust libraries; it must not inherit Laravel's
internal architecture merely for compatibility.

Implementation agents are expected to choose ordinary technical details
autonomously: workspace/module organization, maintained libraries, persistence
patterns, internal abstractions, refactoring and focused verification. Record a
significant architectural choice in this plan or an ADR when it changes a
durable boundary, including the problem, selected approach, reason, meaningful
alternatives/trade-offs and limitations. Do not create decision records for
routine local implementation details.

Ask for manual direction only where the reference conflicts or cannot answer a
real product question, where a proposed result changes user-visible behavior,
or where protected resources, production infrastructure, existing data or new
authority are involved. An implementation challenge alone is not a reason to
stop migration work.

### Current frontend URL migration register

This register makes the frontend extraction sequence concrete for the fresh
Rust deployment. It records React Router behavior only; it neither changes the
Laravel application's routes nor configures production redirects. Because the
new platform has fresh schemas and identifiers, this is not a promise that old
private or identifier-based links will resolve in a deployed cutover.

| Laravel URL or family                                                     | React route                   | Current status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | ----------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                       | `/`                           | Available           | A standalone React welcome screen provides public orientation and routes into exploration or local sign-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/register?registration_token={token}`                                   | Same path                     | Available           | The source-shaped invitation registration form accepts an optional prefilled token but does not require token-bearing links. The one-use token is hashed in the identity database; successful registration creates a fresh learner session and stores the selected Light/Dark account preference as private application data. A signed-in user may issue the source-equivalent baseline-learner invitation through the typed contract, with optional expiry and note; it returns plaintext once. The source administrator user-management UI, invitation listing and elevated role grants remain unavailable. |
| `/about`, `/imprint`, `/data-protection`, `/source`                       | Same path                     | Available           | Public presentation/source endpoints provide their content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/world`                                                                  | `/world`                      | Available           | Public exploration plus signed-in, server-authorized start/reset controls for supported `open_practice`, question, reflection/review, Markdown, tool-grant, item-grant, item-obstacle and base-obstacle starts. The signed-in source-derived floating Groups control reads only the learner's own bounded group page, sends member messages/help requests, permits only another member to resolve a help request, and records one source-majority staff-chat consent vote. Broader World behavior remains incomplete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/learning/search?query={term}`                                           | —                             | Not available       | Search is retained inside the lifted `/world` surface; no substitute standalone search page is exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/learning/nodes/{node}/play?run={uuid}`                                  | Same path                     | Available           | Signed-in playback for server-owned `open_practice`, question, base/explain/transfer reflection and standalone `review`, Markdown, tool-grant, item-grant, item-obstacle and base-obstacle runs, plus private one-question recall, due revisit and historical replay runs. After an ordinary route activity completes, the lifted optional source check-in accepts the learner's optional feeling, note and later-direction; choosing no values performs no write. Question options are read from a learner-safe projection; the Rust writer evaluates selected keys and records private attempts without advancing the run, so source feedback and independent retries remain available. The feedback surface supplies the original confidence and keep/remove-recall controls. A recall run derives its question from the learner-owned queue, schedules the source interval after answer, and completes without route progression, evidence or a check-in. A historical replay instead marks the activity complete as the source direct-entry path does, but cannot advance a route, create route-run evidence, or satisfy a recall/revisit queue. The generic completion command then finalizes ordinary route attempts and resolves their authored branch. Markdown follows its safe bounded authored page graph before using that generic server-owned completion command. A tool-grant command derives the active activity and its configured public tool reference server-side, makes ownership idempotent, and completion rechecks ownership before it advances. An item-grant command derives the active activity, probability and configured public item references server-side, persists one random roll per opaque play run, and only that result can complete the activity; a new run can roll and increment holdings again. Item/base obstacles retain their configured consumption or owned-tool resolution rules. Reflection first writes only to private journal/reflection records, then explicitly completes its active run. The lifted source explain/transfer presentation includes response focus, optional initial/later confidence, changed context, bounded authored cues, after-save guidance, optional independent response and private response comparison. Both an authored review intent and the standalone `review` type supply the original bounded earlier-note reader, optional confidence, authored cue and learner-outcome controls. The response provides authorized node/map/route orientation labels and bounded authored check-in context used by the lifted original learning-context panel; the node path segment preserves the source URL family, while the opaque run UUID remains the only API authority. Revisit, recall and replay runs intentionally omit this ordinary check-in pause. |
| `/journal`                                                                | Journal overlay from `/world` | Partially available | Signed-in learners can read, search, create, edit and delete their own paginated private journal pages in the lifted overlay. The original bounded Learning trail reads recent private check-ins, preserves its source map destination and reopens an activity only through a CSRF-protected server-owned opaque replay run. Due private revisit invitations use the original Journal panel and can open a server-owned opaque revisit run or be deferred/hidden. The original owner-only Markdown Export and source-default light/dark paper presentation are available. Review history, fuller check-in/timeline workflows, administrator presentation configuration and Journal media assets remain unavailable.                                                                                                                                                                                                                                                                |
| `/bookmarks`                                                              | `/bookmarks`                  | Available           | Signed-in learners can open the source-derived personal bookmark map, inspect a saved place's original map context, return to it in World and remove it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/topics`, `/topics/{topic}`                                              | Same path                     | Partially available | Signed-in learners can use the lifted source directory and all four source detail sections: Trail, Routes, Maps and Overview. Routes use the existing CSRF-protected server-owned start command and opaque run URL. The source Trail’s competence drill-down preserves the source topic as its Star Map return context; its recent-reflection, competence-evidence and return controls reopen an activity only through the shared CSRF-protected opaque replay command. Broader reflection-history replay and direct Journal navigation remain intentionally absent until their own Rust contracts exist.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/home`                                                                   | `/home`                       | Partially available | The lifted source Learning Desk search, Recall Queue, Return when useful, Continue learning, Recent traces, Recent reflections, Pinned for later/Saved places rail and Possible connections section, beneath the shared learner header, list only source-authorized information. The search retains its source debounce, five-result panel, first-result submit and pagination; its authenticated contract orders published topics, then current-World maps, then visible places without reusing the public asset search or exposing a standalone search page. The other sections list only private questions the learner explicitly kept, due private returns the learner chose, visible in-progress routes, recent completed routes, the learner's four most recent visible private check-ins, and the learner's visible private bookmarks. Continue and recent route rows retain their source map-place art, map/topic/location links, bounded authored learning-area links, purpose, time guide, dates and placement explanation. An in-progress row uses its current activity's authored context; a completed row uses its start activity, matching the source serializer. The original local area navigation shows only available sections, retains the selected section in the `area` URL parameter, and moves focus to its heading after an intentional switch. Its local per-account/browser Focus view hides the secondary pinned rail without changing learner state. Completed entries sharing a visible active place are suppressed, preserving one clear next step. The rail selects an active bookmarked place when present, otherwise the newest saved place, and retains original World context links. Possible connections excludes the pin, presents up to three remaining saved places, and retains its source empty guidance when a learner needs more context. Route actions reuse the established World read model and CSRF-protected route-start command: it resumes an unfinished opaque run or creates a new opaque run for a completed route. A reflection opens only through the shared CSRF-protected historical-replay command, which returns an opaque server-owned run. Related check-ins retain up to three validated authored learning-area links and their published map-topic return context. The original optional purpose/time filters narrow only visible in-progress routes; an explicit CSRF-protected save stores their private application preference across sessions without creating a recommendation or deadline. Recall questions open through an opaque recall run and may be deferred one day or removed; returns open only through a server-owned opaque revisit run and may be deferred or hidden. Private support responses remain absent until their own Rust contract exists. |
| `/paths`                                                                  | `/paths`                      | Partially available | Signed-in learners can use the lifted source Paths page and shared learner header, filter the server-owned eligible routes by learning purpose or available time, page through the bounded results, and enter a route through the existing CSRF-protected opaque-run command. The source’s direct Inertia link is deliberately mapped to that already-established typed command; it does not expose a client-forged destination. |
| `/competence?topic={slug}&from={slug}`                                    | Same path                     | Partially available | Signed-in learners can use the lifted source Star Map, its guide, qualitative selected-topic reader, private evidence ledger, learning pulse and bounded review history. The original `topic` selection and `from` return-context query semantics reuse the existing authorized topic reader, including the source “not on your map yet” explanation. Topic context links use the existing source-derived topic route. Learning-pulse, review-history and selected-topic return controls reopen their activity only through the same CSRF-protected opaque replay command; the read contract still carries no client-supplied activity destination. |
| `/settings`, `/settings?panel=personal&personal=appearance`, `/settings?panel=personal&personal=language`, `/settings?panel=personal&personal=feedback`, `/settings?panel=personal&personal=sound` and `/settings?panel=personal&personal=security` | Same paths | Available | The source-adapted Personal Profile, Appearance, Language, Feedback and Sound settings surfaces persist the signed-in learner's identity-owned name/email, application-owned public username, staged profile image, Light/Dark, enabled application locale, feedback-invitation choice, mute, effects-volume and ambience-volume preferences through their respective data boundaries. Language has only English enabled locally until translated platform/activity content is migrated; it does not claim an unavailable translated experience. Feedback is opt-in by default and may be declined/re-enabled without changing the separate shared feedback-message record. Security replaces only the authenticated user's credential verifier through the identity-data boundary. Other Personal, administration and authoring settings remain unavailable. |
| `/settings?panel=admin-access&access=groups` | Same path | Partially available | A source-adapted Groups panel is available only to the migrated platform-administrator all-scope role. It creates/edits groups, assigns application users, and shows only source-consented staff-visible group chat. Creator/assigned-manager scopes await the source role-management slice. |
| `/settings?panel=admin-access&access=users` | Same path | Backend contract only | `GET /admin/users` now returns source-relevant identity-profile/status and application-role summaries plus the latest 25 invitation audit summaries, only to the dedicated administrator capability. It deliberately omits credential verifiers, sessions, invitation plaintext and learner data. The original Users panel, user-access writes and role-management controls remain unavailable until their complete source contracts are migrated; no substitute UI is exposed. |
| `/settings?panel=admin-access&access=roles` | Same path | Backend contract only | `GET /admin/roles` now exposes the source-shaped role catalogue, hierarchy, complete resource/level/scope permission matrix and currently migrated capability grants only to the separate role-read capability. Role creation, editing, deletion and the original Roles panel remain unavailable until this data model also owns authorization for every affected feature; no substitute UI is exposed. |
| `/feedback` | Same path | Available | Signed-in learners can use the source-adapted deliberate platform-feedback form. Rust accepts only the source category values and a bounded 10–4000-character message, then records it separately from private journal, activity and competence data. |
| `/settings?panel=admin-learning-support&support=platform-feedback` | Same path | Available | The source-adapted Platform Feedback review queue is available only to application principals with its separate view/review capabilities (initially the migrated platform-administrator role). It pages deliberately shared messages with unreviewed entries first, shows only the needed author identity projection, and preserves the source’s sole action: mark a message reviewed. |
| `/organizations`, `/organizations/{slug}`, organization membership, join-request, message and icon routes | Rust application database / typed React contract | Available | The source-shaped directory, leader-owned text/deletion and icon upload, membership, join approval, governance transitions, member chat and member icon reporting are migrated with contract, database and local browser evidence. Due random leadership rotates through the documented idempotent backend scheduler command, never on a browser read. The source-shaped moderator queue can view a reported-icon snapshot, dismiss a report, or remove the organization’s current icon through its separate capability. |
| `/learning/groups/*` | Floating World control and `/settings?panel=admin-access&access=groups` | Available | The source-derived member group-chat control and bounded platform-administrator group workspace are implemented through typed Rust contracts. |
| `/settings?panel=admin-access&access=links`, `/access-links/{token}` | Same paths | Partially available | Administrators with the separate access-link capability can create, enable/disable and inspect bounded hashed tool/item grant, registration and temporary-login links. Registration creates the default learner account through the documented compensating identity/application workflow; temporary login creates and signs in a fresh temporary learner with a server-generated unknown verifier. Resource links remain redeemable only by a signed-in learner. Usage, expiry and replay policy are enforced server-side. Source role-selection remains unavailable until its dedicated access-management slice is migrated. |
| Remaining authoring/settings/admin routes | — | Not available | These belong to later authoring and administration slices with their own authorization tests. |
| `/access-links/{token}`, `/protected-media/*`                             | —                             | Not available       | Security-sensitive access-link and media-serving contracts are deliberately deferred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

The older `/home` row's private-support note is superseded by the Learning
Support slice above: learners can read their own visible private replies in
the lifted Desk area. Likewise, the otherwise unavailable Settings family now
has only the source-derived Learner Messages moderation workspace and the
platform-administrator Groups workspace at
`/settings?panel=admin-access&access=groups`; this is not a claim that the
general Settings, organization, authoring or administration surfaces are
migrated.

The current public asset and route-preview URLs are newly designed React URLs
under `/world/{world}/maps/{map}/assets/{asset}`. They have no legacy-ID
redirect because the platform is greenfield and does not migrate Laravel data.

## Authentication, authorization and browser security

This is a go/no-go workstream. The current app includes passkeys and two-factor
authentication; reproducing login alone is insufficient.

### Accepted identity boundary

Rust owns identity in the initial target. An external OIDC provider such as
Keycloak remains a future extension, not an initial dependency. This does not
mean building authentication primitives from scratch: compose maintained crates
for Argon2id, WebAuthn/passkeys, TOTP, sessions and Axum integration, then
implement only the Wicked Learning-specific identity and authorization policy.

Identity data lives in a separate PostgreSQL identity database. It owns users,
credentials, passkeys, MFA/recovery material, sessions and verification/reset
tokens. The application database owns a non-secret application principal keyed
by the identity service's immutable opaque UUID subject. There are no
cross-database foreign keys; registration, deletion and subject provisioning
must use idempotent workflows, reconciliation and outbox/compensating actions.

Before user cutover, build a production-like proof of concept for passwords,
verification/recovery, TOTP, passkeys, session rotation/revocation, CSRF and
rate limits, then obtain independent security review. Test whether Laravel
passkey records are safely portable; require re-enrollment if they are not.

Regardless of the choice:

- Keep authentication material out of `localStorage`, `sessionStorage` and URL
  parameters. Use secure, `HttpOnly` cookie sessions or the provider's
  recommended browser flow. [OWASP HTML5 security guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- For cookie-authenticated mutations, enforce CSRF protection, verify trusted
  origins and keep `GET`, `HEAD` and `OPTIONS` free of state changes. SameSite
  is defense in depth, not the only protection. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- Port the complete permission matrix, map edit scopes, verified-account
  requirement, account status/ban handling, registration-token and access-link
  limits before enabling protected routes.
- Regenerate the session identifier on privilege change/login, rate-limit
  authentication, recovery and sensitive mutation endpoints, and write
  structured security/audit events without credentials or learner content.
- Test unauthorized, cross-user, disabled/unverified, expired-token and
  permission-revocation cases for every migrated protected capability.

## Data, migration and media strategy

### Phase-one database position

Use two greenfield PostgreSQL databases: a separate identity database for users
and all authentication-sensitive material, and an application database for
Wicked Learning state. Each has distinct credentials, pools, migration history
and backup/restore procedures. They may share a PostgreSQL server initially,
but not a database.

The Laravel schema, models and migrations are behavior/domain evidence only.
Define fresh Rust-owned schemas and forward-only SQLx migrations; do not replay
Laravel migrations, preserve old IDs or import legacy rows. The initial
application bootstrap creates the minimum administrator, roles and empty world
needed for the new platform.

Before implementation, produce reviewed domain models, entity-relationship
diagrams and SQL migrations for both databases. The identity database issues an
immutable opaque UUID subject. The application database stores that subject in
an application-principal record and never stores credential hashes, passkeys,
MFA/recovery material or sessions.

PostgreSQL cannot enforce foreign keys across databases. Registration and
deletion therefore use idempotent provisioning plus an outbox or compensating
action, and reconciliation checks rather than distributed transactions. Test
these failure paths with real PostgreSQL instances.

### Media

The new platform starts with no legacy uploads to transfer. Use the current
public/protected serving behavior as a requirements reference, then initialize
a fresh media store behind `MediaStore`. Its initial adapter is a mounted
volume; managed object storage remains a future feature. Application rules must
not care which adapter is active.

The Rust implementation must preserve or improve the current upload limits,
authorization and media-reference integrity. Validate bytes as well as claimed
content type, generate server-owned names, restrict size/type, store outside a
web root or behind a controlled handler, and test deletion/replacement and
authorization. [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

## Step-by-step execution plan

Each phase ends with an explicit gate. Do not start the next production
migration phase merely because code compiles.

### 0. Establish an executable baseline

1. Install the repository's locked PHP and Node dependencies in the normal
   development environment; record language/runtime/package versions and the
   command output needed to reproduce the baseline.
2. Run the current narrow and complete test suites, static checks and frontend
   type/lint/build checks. Resolve or explicitly record baseline failures before
   attributing anything to Rust.
3. Create a behavior catalogue from feature tests, controller actions,
   serializers, request validators and frontend routes. Mark every entry as
   public, learner, author, moderator or platform administrator.
4. Record critical user journeys with screenshots and browser traces: account
   recovery/login, map exploration, activity playback/refresh, question and
   branch transition, journal, authoring a map activity, import/export,
   media replacement, role change and access-link redemption.
5. Measure baseline endpoint latency, PostgreSQL query count, serialized bytes
   and browser interaction timing for map load, route playback and authoring
   graph load. Define the test data volume and hardware/environment used.

**Gate:** the team can reproduce the existing application, name every active
capability and test owner, and has a source-level behavior, route, data-model
and media inventory. No legacy-data restore is required.

### 1. Make irreversible decisions explicitly

1. Approve ADRs for identity boundary, same-origin versus cross-origin
   deployment, session/CSRF design, long-term media storage, database ownership,
   OpenAPI versioning, background worker/queue approach, mail provider, secrets
   management and observability.
2. Define SLOs and data-loss/recovery objectives. At minimum: API availability,
   health/readiness criteria, backup frequency, restore target, request timeout,
   upload size and background-job retry/dead-letter policy.
3. Define a release/rollback policy: per-slice feature flag, reverse-proxy
   routing switch, database migration rollback limits, backup verification and
   named rollback operator.
4. Decide the first thin vertical slice. Prefer a read-only public or
   authenticated shell endpoint plus one non-sensitive learner read; do not start
   with activity writes or bulk authoring.

**Gate:** every security/data/deployment choice has a written owner, acceptance
test and fallback; no unresolved choice requires a hidden implementation guess.

### 2. Build the independent foundation without user cutover

1. Add the monorepo layout, Rust workspace, independent React build and
   contract directory. Leave Laravel as production owner.
2. Build Axum configuration parsing, startup validation, health and readiness
   endpoints, structured logging, request IDs, panic/error handling, timeout/body
   limits and exact CORS policy.
3. Connect to fresh identity and application PostgreSQL test databases with
   bounded SQLx pool settings. Add explicit migrations, repositories and
   transaction helpers; do not run arbitrary migrations on application startup.
4. Generate OpenAPI and TypeScript client artifacts in CI. Fail CI if generated
   artifacts drift or incompatible contract changes lack an intentional version
   change.
5. Build a React API client that has no Laravel cookie, Inertia or Wayfinder
   assumption. Add a test-only mock server based on contract fixtures.
6. Containerize frontend and API separately; configure a development proxy and
   the production reverse proxy so the browser sees the intended same-origin API
   shape.

**Gate:** a local or deployed non-production Rust service is observable, can
use fresh identity and application databases, its generated client is consumed
by a standalone React screen, and it has no production writes.

### 3. Establish contracts and parity harnesses

1. For the chosen slice, write the OpenAPI request/response/error schema before
   the handler. Include authorization and pagination behavior in examples.
2. Build contract tests from accepted product requirements and fixtures. Do not
   treat Laravel response fields or identifiers as the new API contract unless
   the behavior requires them.
3. Port relevant Laravel feature tests into API-level Rust integration tests as
   behavioral evidence. Preserve counterexamples: cross-user access, invalid
   transition, stale/malformed configuration and validation failures.
4. Add database integration tests against a real PostgreSQL instance, including
   transaction rollback/isolation and constraint errors; mocks alone cannot prove
   query correctness or migration safety.
5. Add React component/browser tests using generated client fixtures for loading,
   empty, validation-error and permission-denied states.

**Gate:** the complete read-only slice satisfies its product, security and
accessibility requirements, and query/byte budgets are within approved limits.

### 4. Implement read-only vertical slices

1. Move public presentation and static information pages, then authenticated
   `/me`/navigation shell.
2. Move read-only map/world, search, Paths, topics and bookmark listing views
   with their existing authorization and bounded loading rules.
3. Compare the implementation with approved behavior fixtures, access rules,
   payload budgets and browser acceptance checks; do not log learner content.
4. Release the React route behind a feature flag only when it has a tested
   rollback to the new platform's previous release.

**Gate:** browser acceptance and non-production monitoring demonstrate that the
slice meets its requirements, with a tested rollback.

### 5. Cut over writes with explicit ownership

1. Establish the selected identity/session solution and secure bootstrap flow
   only after login, verification, recovery, MFA/passkey and authorization
   acceptance tests pass.
2. Migrate low-risk personal mutations (preferences and bookmarks) first, with
   idempotency and audit coverage.
3. Migrate activity entry/check-in, answers, reflections, route progression,
   recall and inventory grants as one coherent learner-state boundary. Keep all
   transition resolution and reward/inventory mutation inside one Rust database
   transaction.
4. Migrate journals, messages, shared tasks, organizations and moderation in
   separate vertical slices with cross-user authorization tests.
5. Each capability has one Rust writer and an explicit transaction boundary.

**Gate:** every capability has one Rust writer, database constraints and
invariants are tested, and rollback does not require replaying ambiguous writes.

### 6. Migrate authoring, transfer and media

1. Implement authoring reads and graph serializers before mutations. Decide the
   greenfield MapAsset/Node model from learner and author behavior, revision
   needs and scoped editor permissions; do not retain a compatibility record
   without a current domain reason.
2. Port create/update/reorder/restore operations with optimistic concurrency,
   transactions and detailed validation errors. Test revision/restore and graph
   integrity using production-like packages.
3. Port import/export as a dedicated security and integrity project. Validate
   package manifests, media references, object limits, duplicate mappings,
   transaction boundaries and rollback on partial failure.
4. Implement upload, selection, replacement, preview, protected serving and
   deletion as a complete fresh-media lifecycle. Test references and orphan
   detection from the first stored object.
5. Finally migrate platform administration and AI settings/actions. Preserve
   the existing constraint that AI output is reviewable and cannot directly
   navigate or mutate learning content.

**Gate:** representative export/import and media lifecycle tests pass on fresh
data; no Laravel-specific storage or serializer path is in the active
Rust/frontend flow.

### 7. Complete the replacement deliberately

1. Verify every endpoint, scheduled/background process, mail flow, protected
   media route, login/recovery URL and public deep link has a Rust/API or frontend
   successor and operational owner.
2. Run a final restore drill from backup using only the Rust deployment.
3. Archive the Laravel implementation as behavior-reference source only.
4. Remove PHP/Laravel dependencies, Docker stages, secrets and deployment jobs
   only after the replacement is accepted and the rollback window closes.

**Gate:** the React app and Rust service alone meet functional, security,
performance, backup/restore and observability acceptance criteria.

## Required verification matrix

Every migrated slice must provide the following evidence before its feature
flag is enabled broadly:

| Concern            | Required evidence                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Contract           | OpenAPI diff, generated TypeScript client, valid/invalid request and stable error tests                      |
| Authorization      | anonymous, authenticated, wrong-user, unverified/disabled and missing-permission tests                       |
| Domain behavior    | unit tests for rules plus PostgreSQL-backed integration tests for use case and transaction effects           |
| Browser experience | Playwright or equivalent test for navigation, validation, refresh/back, keyboard and narrow/desktop viewport |
| Data               | reviewed entity model, fresh-migration tests, database constraints and bootstrap/restore drill               |
| Media              | upload/replace/delete/download authorization and fresh-store orphan/reference tests                          |
| Performance        | measured response duration, query count and payload size compared to phase-0 baseline                        |
| Operations         | health/readiness, structured logs with correlation ID, metrics, alert and rollback exercise                  |
| Security           | threat-model update, session/CSRF/CORS tests, rate limits and secret-redaction check                         |

## Risks to manage

| Risk                                                      | Prevention and response                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Rewriting business rules from routes alone loses behavior | derive use cases from actions, services, serializers and feature tests; migrate a full journey at a time         |
| Identity/application provisioning inconsistency           | immutable subject IDs, idempotent provisioning, outbox/compensating actions and reconciliation                   |
| Authentication regression or passkey lockout              | identity ADR and proof of concept first; staged user pilot; keep tested recovery and rollback paths              |
| Frontend becomes a policy engine                          | generated DTOs only; backend returns eligible actions/transitions; authorization tests assert denial server-side |
| Graph/progress race conditions                            | transactions, row/version locking where needed, idempotency keys and concurrent integration tests                |
| Media becomes publicly exposed or orphaned                | explicit media adapter, authorization tests, storage inventory/reconciliation and controlled delivery            |
| API payload/query regressions                             | preserve serializer bounds, add query/size budgets and benchmark production-like fixtures                        |
| Unvalidated replacement scope becomes too broad           | thin read-only slice first, feature flags, acceptance gates and tested release rollback                          |
| AI migration expands authority                            | port current scoped/reviewable contracts; do not add autonomous write/navigation capability                      |

## Definition of completion

The rework is complete only when all of the following are true:

- React/TypeScript frontend and Rust/Axum backend are independently buildable,
  deployable and observable.
- Every active learner, author, administrator and public workflow has an
  API-backed successor with documented contract and automated coverage.
- Rust is the sole writer for all identity, application and media lifecycle
  paths; Laravel is no longer serving application traffic.
- Fresh identity and application databases have a tested bootstrap and
  backup/restore runbook. No legacy data or media migration is required.
- Authentication, passkey/MFA or approved identity replacement, authorization,
  CSRF/CORS, rate limiting and audit behavior pass security acceptance tests.
- The existing product boundaries around learner privacy, accessibility,
  orientation and AI agency are verified in browser and API tests.
- Performance baselines have not regressed beyond approved budgets, and alerts
  plus rollback procedures have been exercised.

## First concrete deliverables

Before writing production Rust domain code, create and approve these artifacts:

1. Endpoint/use-case inventory with owners and migration order.
2. Reviewed greenfield identity and application schema, entity-relationship
   diagrams, SQLx migrations and secure bootstrap plan.
3. Baseline test, browser journey and performance report.
4. ADRs for identity, deployment origin, session/CSRF, database migration,
   media and contract versioning.
5. Threat model focused on authentication, learner-private data, uploads,
   import/export and AI provider credentials.
6. Thin-slice OpenAPI contract, generated React client and Rust proof of
   concept with no production writes.

Only after those deliverables and gates are accepted should implementation of
the replatforming begin.
