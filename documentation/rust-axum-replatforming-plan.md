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
That limited exception has now been retired: `backend/Cargo.toml` defines the
`api`, `application`, `domain`, `persistence` and `infrastructure` workspace
crates and the migrated behavior uses their directed boundaries. ADR-014
records both the original rationale and completed extraction. Any later
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
| Login, registration and personal preferences (`/login`, `/register`, `/settings`, `/settings?panel=personal&personal=appearance`, `/settings?panel=personal&personal=language`, `/settings?panel=personal&personal=feedback`, `/settings?panel=personal&personal=sound`, `/settings?panel=personal&personal=security`, `/settings?panel=personal&personal=delete-account`) | `pages/auth/login.tsx`, `pages/auth/register.tsx`, `pages/settings/personal.tsx`, `components/delete-user.tsx`, `components/platform-feedback-prompt.tsx`, `features/settings/profile-settings-panel.tsx`, `features/settings/appearance-settings-panel.tsx`, `features/settings/language-settings-panel.tsx`, `features/settings/sound-settings-panel.tsx`, `layouts/auth/auth-simple-layout.tsx`, `components/appearance-tabs.tsx`, `hooks/use-appearance.tsx`, `theme/platform-theme.ts` | Source-adapted sign-in, invitation registration and Personal Profile/Appearance/Language/Feedback/Sound/Security/Delete-account forms/layouts, with Inertia submits replaced by typed Rust requests. The source Personal workspace's complete eight-section navigation is shared across every migrated Personal route, including its descriptions, danger treatment and keyboard tab controls; URL navigation replaces only the source's in-page Inertia selection. Registration consumes a one-use identity-database invitation, provisions the separate application principal with its hierarchy-validated selected roles, saves the source Light/Dark choice as private application data and establishes a session. Profile preserves its name, sign-in email and optional public username fields across the identity/application boundary; profile-image upload now uses the completed mounted-volume media lifecycle. The lifted appearance, language and sound controls update only owner-scoped application preferences. Language reads enabled application locales, persists the selected locale, and loads the selected locale's fixed platform-copy catalog through a learner-scoped endpoint. Language administration can create and enable locales and import/export the bounded platform catalog; activity translations are a separate active-run-only read that can replace learner-facing copy but never graph, scoring, media or access data. Feedback retains the source's occasional invitation, fourteen-day dismissal and durable decline/re-enable choice, without a campaign or analytics system. Sound retains the source mute, effects/ambience-volume and local-preview behavior. Security now preserves the current-password, replacement-password and confirmation flow through the identity-data boundary; it keeps the initiating server-side session current while verifier-bound older sessions expire. The source-derived TOTP and passkey lifecycles retain their source sign-in, recent-confirmation, enrollment/list/removal and non-secret audit paths. The source Delete account modal requires the current password in the destructive request, destroys the application/identity pair through the shared resumable lifecycle, ends the current session and returns to the original welcome surface. Password recovery and source 400-day remembered sessions are complete; the other Personal-settings controls remain unavailable rather than being imitated. |
| Information and source pages | `features/platform-info/platform-info-page.tsx`, `pages/source.tsx`, `pages/settings/presentation.tsx`, `features/platform-info/markdown-renderer.tsx`                      | Lifted page hierarchy, source layout and markdown renderer. The same public-presentation model supplies their palette, base welcome theme and ordered configured information pages; their published text and source links remain separate bounded reads. Administrators with source `presentation.ru` can manage up to 24 source-shaped information pages (slug, title, Markdown and dark/light backgrounds), while the three direct source routes retain their fixed-content editor. Additional configured pages resolve at `/info/{slug}`; public readers remain anonymous bounded projections. The former floating source-code launcher was removed because it has no equivalent on the original information pages. |
| World/map/search/node drawer | `pages/world.tsx`, `features/world/world-map.tsx`, `world-search.tsx`, `node-detail-drawer.tsx`, `activity-panel.tsx`, `map-asset-visual.tsx`, `components/app-side-action-bar.tsx`, `components/learner-navigation-header.tsx` | Source-adapted around the bounded public/learner contracts. Map assets, hit testing, desktop and narrow-screen search-panel structure, drawer geometry/swipe, original bookmark toggle, owned item/tool belt, equipped-tool map reveal/unlock, supported route-start cards and every currently available original learner-navigation destination retain their original structures. The lifted source theme resolver selects dark/light map, asset and route-start presentation from the server model. Source `tool_grant`, item-grant, item-obstacle, base-obstacle and NPC-dialogue configured tool-grant playback now follow server-owned acquisition, consumption and transition paths. Node-drawer obstacle/item use and member-only Groups now have their own contracts; source group creation and assignment is available to the migrated platform-administrator scope. Remaining World parity is tracked per unavailable authoring/access slice rather than by a substitute UI. |
| Personal bookmark map        | `pages/bookmarks.tsx`, `features/world/world-map.tsx`, `map-asset-visual.tsx`                                                                                               | Source-adapted personal-map, selected-place, return-to-source-map and removal flow. The same lifted dark/light map and asset theme resolution applies. Rust returns only the principal's bookmarks that remain visible, with their original map context and presentation asset.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Topics directory and detail  | `features/topics/topic-directory.tsx`, `features/topics/topic-detail.tsx`, `components/learner-navigation-header.tsx`, `components/learner-paginated-items.tsx`           | Source-adapted authenticated directory, search, bounded pagination, default Trail, keyboard tab strip, Routes filters/start action, Maps and Overview/subtopics. The selected topic’s header remains present in every section, beneath the shared lifted learner header with working Rust destinations, Journal and sign-out controls. Rust keeps path eligibility, topic context and opaque run issuance server-owned. Topic Trail competence drill-down, recent-reflection, competence evidence and return controls are restored: the first preserves source topic context in the Star Map, while activity controls use the shared CSRF-protected opaque replay command. Broader reflection-history controls remain omitted until their own data contracts and evidence exist. The standalone source `/paths` reader uses the same typed Paths contract, route-start command and shared header.                                                                                                                                         |
| Competence star map          | `pages/competence/index.tsx`, `pages/competence/competence-star-layout.ts`, `components/learner-navigation-header.tsx`, `components/learner-paginated-items.tsx`          | Source-adapted private Star Map, deterministic original SVG layout, shared learner header, map guide, selected-light reading, evidence ledger, learning-pulse timeline and bounded review history. Rust provides only the signed-in learner's qualitative evidence. The header retains only source destinations whose Rust routes exist, plus the existing private Journal and sign-out controls; unavailable source destinations are omitted. Topic context links use the existing authenticated topic reader. Revisit/check-in/review cards restore their source activity controls by obtaining a CSRF-protected authorized opaque replay run; the read model still never exposes a client-constructed activity URL. |
| Playback                     | `pages/learning/node-play.tsx`, `features/world/activity-panel.tsx`, `features/world/standard-activities.tsx`, `features/world/activity-ambient-sound.tsx`, `features/world/portal-scene.tsx`, `features/world/markdown-activity.tsx`, `features/world/tool-grant-activity.tsx`, `features/world/item-grant-activity.tsx`, `features/world/item-obstacle-activity.tsx`, `features/world/obstacle-activity.tsx`, `features/world/message-activities.tsx`, `features/world/learning-check-in.tsx` | Source-adapted open-practice, question, base-reflection, Portal, Markdown page graph, tool-grant, item-grant, item-obstacle, base obstacle, peer-message prompt and peer-message wall frames, followed on ordinary route runs by the lifted optional source check-in pause. The World projection and ordinary route-start command share the same supported-activity allowlist, so a published Message Prompt or Message Wall configured as a MapAsset start is visible to an authorized learner and opens its existing source-derived player. The source Activity Frame's pre-activity learning focus, related learning-area links and `From beginning` route reset now use the same bounded server projection/authorized reset command; focus is no longer delayed until after completion, and a restart cannot be used for portal, revisit, recall or replay runs. Rust owns answer evaluation, reflection persistence, server-authorized portal travel, safe bounded authored Markdown pages, configured-tool ownership, configured-item probability rolls/holdings, item-obstacle slot consumption/locks and source `notMet`/`transition`/`met` effect events, owned configured-tool obstacle resolution, peer-message topic binding/visibility and completed-activity transitions; it exposes only bounded authored check-in context, and accepts a check-in only after server-side completion. Reflection persistence now follows the source save-then-complete boundary: the migrated base surface saves then immediately uses the server-owned completion command, while the typed Rust contract keeps source-derived transfer context, authored cues and independent-check eligibility for the later exact explain/transfer/review UI lift. Revisit runs deliberately return to World rather than recording a second ordinary check-in. Question feedback now includes the source confidence reflection, an up-to-three private earlier-attempt summary, optional post-feedback confidence, and the source keep/remove-recall control. Reloading an active question restores only that run's latest evaluated answer and its bounded earlier-attempt context; a fresh run does not inherit it. Recall attempts are separate one-question runs: they never advance a route or create evidence. Published activity ambience and item-obstacle effects follow the source player and saved learner comfort controls through bounded sound projections; base-obstacle effects and remaining unsupported activity types remain separate contracts and are not silently represented as complete; staff peer-message moderation is recorded with the source staff workspace below. |
| Private journal              | `components/learner-account-controls.tsx`, `components/learner-paginated-items.tsx`, `features/journal/journal-overlay.tsx`, `pages/settings/admin-panel.tsx`, `pages/settings/journal.tsx`, `features/platform-info/markdown-renderer.tsx` | Source-adapted learner-owned overlay, reached from the original journal control. Rust scopes and paginates private page markdown and durable learning context, and supports the source add/edit/view/save/delete controls. The bounded source Learning trail now shows recent check-ins, preserves its source competence destination and reopens an activity only through a CSRF-protected opaque replay run. Due revisit invitations use the lifted source sidebar panel, one-at-a-time pagination and `Open activity`/`Later`/`Hide` controls; opening first obtains a server-owned opaque revisit run. The source one-time review request is now available for a saved page when the source policy is enabled; requests remain private unless deliberately shared, then authorized staff may give one immutable response. Destinations currently cover Journal and migrated learning groups; organisation destinations await the organisation slice. The original Export control downloads only the learner's own pages in source-compatible Markdown; it excludes check-ins and review metadata. The source-default light/dark paper presentation is served by Rust and follows the active appearance while the overlay is open. Authorized Learning Support staff can now use the lifted source Journal policy/background editor, including dark/light image placement, up to twelve decorative assets per mode, direct upload or reusable-visual selection and preview. The saved Rust references prevent deletion of selected media and learner projection serves them only to authenticated Journal readers. Its bounded Learning trail keeps the source's recent four-entry presentation while the shared private check-in reader retains the source's 30-entry history for the competence pulse. |

The source World Builder's map Access permissions control is now lifted for
principals with its distinct `world_map_access` update scope. Its typed Rust
command replaces only the complete map viewer-group list after validating
current application-role keys; it does not conflate learner visibility with
map content editing or editor-group assignment. See ADR-098.

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
the lifted source Settings top bar, primary/sidebar and account navigation,
the nested source topic navigation, its bounded Needs attention digest,
helpful/unconfirmed filters, private reply editor, hide/restore and deletion
controls for private-support and peer messages. A staff reply remains
deliberately limited to private support; peer responses remain learner
activity. The capability-gated Rust contract preserves the source rule that
hidden material is withheld from learner readers while a hidden request still
consumes its single contribution. Deleting a request deletes its replies,
matching the source's ownership semantics.

The adjacent Support Signals read contract at `support=support-signals`
resolves all/group/self visibility in the application database before it joins
only visible learners' identity labels, and returns evidence aggregates, group
context and active manual node overrides. It now also carries the
source-shaped summary counts and at most twelve anonymous unresolved
shared-task review aggregates for the caller's already-scoped learners. The
aggregate deliberately excludes learner writing and identities; the later
three-section source UI lift now consumes it without adding a new staff-data
authority. The Support Signals, Learner Messages, Platform Feedback, Journal
Feedback, Organization Icons, Competence Topics, Concept Library and Journal
settings workspaces all retain the extracted source Settings shell and the
same source Learning Support section navigator. The shared top bar consumes
the app's single typed current-user projection for its source-shaped account
control instead of issuing a separate identity read per workspace, so moving between available
child workspaces does not discard the parent source hierarchy. The source
Organization Icons queue, Competence Topics and Concept Library forms, and
Journal policy/background editor continue using their existing typed Rust
read/write contracts; only their former standalone page frames were removed.
The Support Signals child
retains its Collective Overview chart, Individual Support reader/manual-node
access, and Peer Support queue. On a narrow viewport that source section
navigator becomes a compact selector so the active nested view remains inside
the Settings viewport. Only Inertia's
page data/router post seams are replaced with the typed Rust read,
CSRF-protected manual-unlock command and React URL state. It deliberately
excludes journal text, private reflections, confidence and rankings;
peer-message resolution remains in the dedicated moderation workspace above.

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

The Portal writer now also preserves the source Entry/Exit direction, optional
same-World Exit target, dark/light backgrounds and swirl, up to twenty layered
visuals, arrival behavior, typing bubble and presentation colors. Its typed
Rust command scopes node/activity mutations to `world_activities.ru`, checks
the stale timestamp, writes the server-owned Portal link only for an Entry
Portal with a valid Exit target, records activity history, and keeps every
selected or uploaded reusable visual referenced. The lifted World Builder form
uses the existing reusable-visual picker/upload path and learner Portal scene
for its preview. Global map-link storage and API now preserve the source's
distinct node-to-node links, including their nullable activity endpoints; the
source-adapted editing controls remain deferred until the remaining backend
authoring contracts are complete.

### Learner sound-preference slice — 6 November 2026

The original account-menu sound controls now save the learner's private mute,
effects-volume and ambience-volume choices through Rust. Dialogue typing audio
uses the saved effects setting. Published source-configured activity ambience
now also uses the saved ambience setting through the bounded playback-sound
projection described below. Reusable sound uploads and authoring were separate
media work at this point; the managed successor is recorded in the later
reusable sound-media lifecycle slice. Item-obstacle effects still use only
server-resolved published sound identifiers and must never accept
browser-selected URLs.

### Published activity ambience slice — 6 November 2026

The player now lifts the source `ActivityAmbientSound` behavior. A safe
activity configuration may name one enabled ambience record, and Rust projects
that record only when it is published. The browser then plays that known URL
while the activity is open, honours loop/play-duration/author volume and
immediately reacts to the learner's saved mute and ambience-volume settings.
The fresh Portal demonstration content supplies a local `quiet-pulse` example
solely to prove the complete authored-config-to-browser path.

This slice did not itself introduce sound uploads or arbitrary browser URLs;
the later reusable sound-media lifecycle slice adds managed upload, the
source-adapted library, protected author preview and published-sound delivery.
Base-obstacle effect playback remains separate work.

### Reusable sound-media lifecycle slice — 8 November 2026

The source `settings/assets/sounds.tsx` now has a Rust/React successor at
`/settings?panel=admin-assets-world-objects&asset=sounds`. `sounds.ro` lists/searches the
source-shaped sound metadata; `sounds.ru` may store one 20 MiB-or-smaller
AAC/FLAC/M4A/MP3/OGG/WAV/WebM upload and create or update a sound; and
`sounds.rud` deletes it. The upload is a managed reusable-media asset rather
than a browser-supplied URL. A transaction records the `learning_sound` audio
reference, preserves static bundled sound URLs, reclaims detached managed media
on replacement/deletion, and gives authors a `sounds.ro`-guarded preview path.
Anonymous delivery is limited to a managed asset that is still referenced by a
published sound. The generic visual-library endpoints remain image-only, so
their permission cannot bypass sound authorization. The typed OpenAPI contract,
focused Rust tests, generated client, and credential-gated local browser proof
cover upload, create, public delivery and deletion; the latter uses disposable
development data.

### Activity scene-ambience authoring slice — 8 November 2026

The source `ActivityAmbientSoundFields` and reusable-sound picker now have a
Rust/React successor in the World Builder. An author can enable, select,
preview, pause, stop or clear one reusable sound for any editable activity.
The typed command accepts only the selected sound UUID and explicit enabled
state, checks the scoped activity and optimistic timestamp before resolving the
sound, records the pre-change activity version, and resets the activity review
state. It deliberately does not accept a browser URL, volume, loop or duration:
those remain reusable-sound metadata that the bounded learner projection owns.
Sound upload and library management are now provided by the managed reusable
sound-media lifecycle slice above.

### MapAsset interaction-sound slice — 8 November 2026

The source MapAsset editor's four interaction effects now travel from the
World Builder to the learner map: pointer enter, click/tap, pointer leave and
confirmed tool unlock. Authors select a managed reusable sound by UUID, never a
browser URL. Rust validates the fixed trigger vocabulary, checks each selected
published sound only after it has authorized the map writer, and projects only
resolved public sound URLs to a visible learner map. The lifted editor retains
the source controls and preview; learner playback honours the private mute and
effects-volume preferences. The unlock effect waits for the server-confirmed
unlock result rather than treating a tool click as success.

### World Builder map-duplication slice — 8 November 2026

The source `DuplicateMapDialog` now has a Rust/React successor on the selected
World Builder map. `POST /api/v1/admin/world-builder/maps/{map_id}/duplicate`
uses the same scoped map-editor authority as an edit, rather than granting a
general map-create capability. One database transaction gives the copy fresh
map, MapAsset, node, route, activity, message-topic, start and dialogue-graph
identities; remaps in-map node, message-topic, dialogue-event, preferred-start,
transition and internal-portal references; retains an outbound portal's
existing destination; and recreates normalized visual-media reference rows.
It preserves authored presentation/access fields and resets copied activities
to `needs_review` with no recorded review. Learner state, review runs, history
versions and map-editor-group assignments are intentionally excluded. The
source-style dialog makes that boundary visible, and its local browser proof
creates a disposable map/MapAsset, duplicates it, confirms fresh map/asset/node
identities with preserved geometry, then deletes both maps.

### World Builder map JSON-export slice — 8 November 2026

The selected-map dialog now exposes the source-shaped `Export map` download.
`GET /api/v1/admin/world-builder/maps/{map_id}/export` applies the same
`world_maps.ru` and all/own/assigned/direct-editor scope as the existing map
writers, then returns a JSON attachment rather than changing data. The manifest
records the Rust-owned map graph: presentation/access configuration, MapAssets,
compatibility nodes, starts, routes and activities, activity and dialogue
transitions, asset message topics, outgoing portal targets, and recursively
listed media URLs. It explicitly excludes learner records, history versions,
review runs and editor assignments. A credential-gated local browser proof
creates an isolated map and MapAsset, downloads and validates that attachment,
then deletes the disposable map. Package media and import/preflight parity are
still separate transfer slices.

### World Builder map-export structural-preflight slice — 8 November 2026

The selected-map dialog now also lifts the source validation entry point. It
accepts one bounded JSON manifest and returns a readiness report without
creating or changing content. Rust validates the versioned manifest shape,
bounded collection sizes, slugs, node/activity links, MapAsset node references,
portal sources and declared media-reference values; malformed graphs remain
visible before a later importer can write anything. The report is
CSRF-protected like the source upload workflow, and the browser proof downloads
an export, uploads that exact file for validation, observes the ready result,
then removes the disposable map. Destination workspace/media availability and
package/archive preflight remain part of the subsequent import slice.

### World Builder map JSON-import slice — 8 November 2026

`POST /api/v1/admin/world-builder/map-exports/import` now accepts a
CSRF-protected, bounded JSON manifest plus destination title and optional slug.
It repeats structural validation in the application boundary, then commits one
fresh draft map transaction only when the source workspace matches the current
World and declared topic, portal and managed-media dependencies resolve there.
The persistence command recreates MapAssets, nodes/routes, starts, activities,
activity and dialogue transitions, message topics and portal links with fresh
identifiers; it remaps only declared internal reference fields and resets
activities to review. The manifest cannot transfer destination access rules,
learner state, authoring history, review data or editor assignments. A source
adapted header dialog requires the existing preflight before enabling Import.
The credential-gated browser proof exports a disposable map, validates it,
deletes the source, imports the downloaded file as a new map and removes that
result. The same dialog now accepts the bounded portable ZIP form, which carries
only declared managed media through the verified transfer boundary.

### World Builder world JSON-export slice — 8 November 2026

The World Builder header now exposes the source-shaped `Export world` download.
`GET /api/v1/admin/world-builder/world/export` returns the current World plus
only maps in the authenticated author's narrower source map-editing scope; each
embedded map is the existing `wicked-learning-map` manifest and the bundle
deduplicates its media URL references. It is a read-only authoring projection
that excludes learner state, histories, reviews and editing-group assignments.
The credential-gated browser flow exports a disposable map and verifies that
the world bundle contains that map before continuing the existing import and
cleanup proof. World packages with declared managed media now use the same
bounded portable transfer boundary.

### World Builder world JSON-import slice — 8 November 2026

`POST /api/v1/admin/world-builder/world-exports/preflight` checks a bounded
JSON world bundle before the source-adapted `Import world` dialog enables its
CSRF-protected import. `POST /api/v1/admin/world-builder/world-exports/import`
revalidates the bundle, requires its workspace slug to match the current World,
and opens one transaction. It creates every destination map with a fresh,
collision-safe slug and populated authored graph before resolving portal links,
using the complete source-to-destination slug mapping for included maps. The
transaction either writes every map and portal or rolls back. Destination
access remains the server default; learner state, review/history records,
permissions and editor assignments are excluded. JSON stays reference-only,
while ZIP archives carry only declared managed media through the bounded
portable transfer boundary.

### World Builder standalone MapAsset JSON-transfer slice — 8 November 2026

The MapAsset editor now exposes the source-shaped `Export MapAsset` attachment,
and the existing MapAsset surface exposes an `Import` dialog for the editable
destination map. `GET /api/v1/admin/world-builder/assets/{asset_id}/export`
applies the same `world_maps.ru` all/own/assigned/direct-editor scope as the
asset writer. It emits one versioned `wicked-learning-map-asset` JSON manifest:
the MapAsset, its optional compatibility Node, route/start/activity/dialogue
graph, message topics and declared media URLs. Portal links, learner records,
permissions, review/history data and media bytes are deliberately excluded.

The preflight and import endpoints revalidate the bounded manifest. Import
requires the target map's editor scope and matching current-World slug, creates
fresh asset/node/route/activity/topic/dialogue identifiers transactionally,
moves a colliding node position right, and remaps only declared node and
message-topic references. JSON references must resolve in the destination
workspace; ZIP packages carry only declared managed media and create fresh
destination objects.

### World Builder World-details history slice — 8 November 2026

The World Builder header now lifts the source `Edit world details` dialog only
after the corresponding Rust write contract is present. `PATCH
/api/v1/admin/world-builder/world/details` requires the distinct global
`world_map_access.ru` grant, locks the current World, rejects a stale
`updated_at` value, stores the pre-change title/description as an immutable
revision, and then changes only those two fields. `GET
/api/v1/admin/world-builder/world/versions` provides the bounded newest-first
history page; its CSRF-protected restore endpoint first snapshots the current
details and then restores the selected same-World revision. The source-adapted
dialog retains the unchanged canonical slug, pagination, confirmation and
restoration wording. Its local browser proof writes disposable details,
observes the prior immutable version, restores it, and leaves the visible World
details unchanged.

### World Builder map-visuals slice — 8 November 2026

`PATCH /api/v1/admin/world-builder/maps/{map_id}/visuals` now migrates the
Laravel Map Configuration visuals as a complete map-scoped authoring slice.
It accepts only the source dark/light theme vocabulary: map, title-panel,
MapAsset-side-panel and control colors, a background image, and bounded
positioned decorative layers. The writer retains unrelated legacy configuration
while merging recognized fields, replaces the submitted layer list atomically,
and uses the source `world_maps.ru` all/own/assigned/direct-editor check.

The lifted World Builder dialog retains the source section navigation, dark and
light mode editors, image upload/reusable-media selection, X/Y/size/opacity
layer controls and visual preview. Map-owned reusable-media references are
synchronized on save, copied when a map is duplicated, removed when it is
deleted, and delivered to learners only for a published role-visible map. The
local browser proof saves a background and layer from the media library, reads
the persisted configuration, then proves map deletion releases both references.

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
bundled public assets. The later dialogue typing-sound-set media slice preserves
the source A–Z set editor with managed WAV staging, complete-set and
single-letter replacement, source tags/default behavior, normalized media
references and authenticated learner delivery. Bundled URLs deliberately remain
valid until an author replaces the corresponding letter.

The World Builder now also owns the matching source-adapted NPC dialogue graph
editor. It creates a dedicated dialogue activity and default end node, preserves
independent graph layout and transitions, exposes source node types and scene
settings, resolves tool slugs and typing-sound sets server-side, and permits
same-world answer hide/unlock events only. Real end-node outputs are projected
into the surrounding activity graph by opaque end-node ID, so an author cannot
connect a stale placeholder exit. Node, transition and layout mutations record
bounded activity-history snapshots and synchronize reusable-media references.
The local browser flow covers activity creation, dialogue-node save, authored
graph transitions and the resulting outer exit connector.

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
| Public welcome, login, registration and information | Original page hierarchy, Tailwind classes, icons, pager, appearance control, footer and source/info layouts, with server-owned logo/pages/palette/base theme; the source login/registration cross-links, invitation fields, passkey alternative, 400-day Remember me behavior and complete password-recovery request/reset journey are lifted. Authorized administrators now have the source-adapted core presentation workspace for its logo, mode-specific auth/public backgrounds and welcome-page sequence, the three fixed information-page Markdown editors, and upstream/modified source links, including reusable-media upload/selection and anonymous delivery only while referenced. The source cursor workspace now preserves its named add/remove/reassign controls, image upload/selection, hotspot, size, fallback and click-point preview; public rendering resolves the stored visual through the anonymous media route only while referenced. Its public-palette workspace preserves the seven source public color/opacity fields, dark/light mode, reset controls and public/login previews through the same presentation writer. Local Compose supplies a Mailpit SMTP inbox for a real recovery-email rehearsal; shared environments use configured SMTP. | The source-disabled email-verification journey and administrator invitation editing |
| World                                 | Original map renderer, alpha-aware interaction, asset visual, map search, node drawer, bookmark control, route-start cards, journal trigger, account-menu shape with its source Settings destination, owned inventory/tool-belt with map-node use, configured NPC dialogue tool grants, and the original floating Groups control. Groups retain the source member-only reader, bounded source message history, help-request/other-member resolution and member-majority staff-chat consent commands through Rust-owned contracts. | Notifications and unavailable Personal-settings entries, and other unsupported World behavior |
| Bookmarks, playback and journal       | Original personal-map, activity-frame, question/reflection, optional post-activity check-in (including its hide/show conclusion behavior), markdown, journal editor/list/export, one-time source journal-review request/reply, bounded check-in Learning trail with its competence/activity controls and due-revisit invitation structures | Source controls whose required data contract is not yet available |

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
the original controls is not acceptable. The route now also retains the source
equipped-tool interaction, member-only Groups control, map-asset interaction
sounds and the supported NPC-dialogue tool-grant path. The original
`NodeDetailDrawer` geometry, close control, scroll ownership and touch-swipe
behavior, plus the supported start-card presentation, are lifted onto the
standalone route. It must therefore still not be described as a completed World
migration: source controls remain absent until their complete Rust contract and
authorization evidence exist.

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
| `/register?registration_token={token}`                                   | Same path                     | Available           | The source-shaped invitation registration form accepts an optional prefilled token but does not require token-bearing links. The one-use token is hashed in the identity database; successful registration creates an application principal using the invitation's hierarchy-validated role keys, establishes a fresh session and stores the selected Light/Dark account preference as private application data. The source-adapted Users workspace lets an authorized issuer create invitations only for roles at or below their hierarchy level, with optional expiry and note; plaintext returns once, while its bounded invitation summaries never expose a raw token. The same workspace provides the source-shaped user access management lifecycle. |
| `/about`, `/imprint`, `/data-protection`, `/source`                       | Same path                     | Available           | Public presentation/source endpoints provide their content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `/world`                                                                  | `/world`                      | Available           | Public exploration plus signed-in, server-authorized start/reset controls for supported `open_practice`, question, reflection/review, Markdown, tool-grant, item-grant, item-obstacle, base-obstacle, NPC-dialogue, shared-task, Portal and Message Prompt/Wall starts. The signed-in source-derived floating Groups control reads only the learner's own bounded group page, sends member messages/help requests, permits only another member to resolve a help request, and records one source-majority staff-chat consent vote. Broader World behavior remains incomplete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `/learning/search?query={term}`                                           | —                             | Not available       | Search is retained inside the lifted `/world` surface; no substitute standalone search page is exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/learning/nodes/{node}/play?run={uuid}`                                  | Same path                     | Available           | Signed-in playback for server-owned `open_practice`, question, base/explain/transfer reflection and standalone `review`, Markdown, tool-grant, item-grant, item-obstacle and base-obstacle runs, plus private one-question recall, due revisit and historical replay runs. After an ordinary route activity completes, the lifted optional source check-in accepts the learner's optional feeling, note and later-direction; choosing no values performs no write. Question options are read from a learner-safe projection; the Rust writer evaluates selected keys and records private attempts without advancing the run, so source feedback and independent retries remain available. The feedback surface supplies the original confidence and keep/remove-recall controls. A recall run derives its question from the learner-owned queue, schedules the source interval after answer, and completes without route progression, evidence or a check-in. A historical replay instead marks the activity complete as the source direct-entry path does, but cannot advance a route, create route-run evidence, or satisfy a recall/revisit queue. The generic completion command then finalizes ordinary route attempts and resolves their authored branch. Markdown follows its safe bounded authored page graph before using that generic server-owned completion command. A tool-grant command derives the active activity and its configured public tool reference server-side, makes ownership idempotent, and completion rechecks ownership before it advances. An item-grant command derives the active activity, probability and configured public item references server-side, persists one random roll per opaque play run, and only that result can complete the activity; a new run can roll and increment holdings again. Item/base obstacles retain their configured consumption or owned-tool resolution rules. Reflection first writes only to private journal/reflection records, then explicitly completes its active run. The lifted source explain/transfer presentation includes response focus, optional initial/later confidence, changed context, bounded authored cues, after-save guidance, optional independent response and private response comparison. Both an authored review intent and the standalone `review` type supply the original bounded earlier-note reader, optional confidence, authored cue and learner-outcome controls. The response provides authorized node/map/route orientation labels and bounded authored check-in context used by the lifted original learning-context panel; the node path segment preserves the source URL family, while the opaque run UUID remains the only API authority. Revisit, recall and replay runs intentionally omit this ordinary check-in pause. |
| `/journal`                                                                | `/journal` → `/home?journal=1` | Partially available | The authenticated source redirect opens the lifted Journal overlay on the Learning Desk. Signed-in learners can read, search, create, edit and delete their own paginated private journal pages in that overlay. The original bounded Learning trail reads recent private check-ins, preserves its source map destination and reopens an activity only through a CSRF-protected opaque replay run. Due private revisit invitations use the original Journal panel and can open a server-owned opaque revisit run or be deferred/hidden. The original owner-only Markdown Export and source-default light/dark paper presentation are available. Authorized Learning Support staff can configure that presentation through the lifted Journal settings page; uploaded and selected reusable visuals are protected by saved references and projected through the authenticated learner-media route. |
| `/bookmarks`                                                              | `/bookmarks`                  | Available           | Signed-in learners can open the source-derived personal bookmark map beneath the shared fixed learner-surface header, inspect a saved place's original map and published-topic context, return to its topic or World location, and remove it. Rust omits the topic link when the map has no published topic. Its fixed loading, map, empty-state and panel copy resolves through the platform catalog; map, node and topic names remain server-owned content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/topics`, `/topics/{topic}`                                              | Same path                     | Partially available | Signed-in learners can use the lifted source directory and all four source detail sections: Trail, Routes, Maps and Overview. The directory returns its server-authorized `content_topics.ru` capability only as the source-shaped manage-topics affordance; the admin route independently enforces that same permission. Directory, detail navigation, Trail competence/learning-area/reflection copy, Route filters/empty states, Maps/Overview copy, and pagination controls resolve through the Rust platform catalog. Routes use the existing CSRF-protected server-owned start command and opaque run URL. The source Trail’s competence drill-down preserves the source topic as its Star Map return context; its recent-reflection, competence-evidence and return controls reopen an activity only through the shared CSRF-protected opaque replay command. Its reflection comparison retains the source Journal link, which follows the authenticated standalone `/journal` redirect.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `/home`                                                                   | `/home`                       | Partially available | The lifted source Learning Desk search, Recall Queue, Return when useful, Continue learning, Recent traces, Recent reflections, Pinned for later/Saved places rail and Possible connections section, beneath the shared learner header, list only source-authorized information. The search retains its source debounce, five-result panel, first-result submit and pagination; its authenticated contract orders published topics, then current-World maps, then visible places without reusing the public asset search or exposing a standalone search page. The other sections list only private questions the learner explicitly kept, due private returns the learner chose, visible in-progress routes, recent completed routes, the learner's four most recent visible private check-ins, and the learner's visible private bookmarks. Continue and recent route rows retain their source map-place art, map/topic/location links, bounded authored learning-area links, purpose, time guide, dates and placement explanation. An in-progress row uses its current activity's authored context; a completed row uses its start activity, matching the source serializer. The original local area navigation shows only available sections, retains the selected section in the `area` URL parameter, and moves focus to its heading after an intentional switch. Its local per-account/browser Focus view hides the secondary pinned rail without changing learner state. Completed entries sharing a visible active place are suppressed, preserving one clear next step. The rail selects an active bookmarked place when present, otherwise the newest saved place, and retains original World context links. Possible connections excludes the pin, presents up to three remaining saved places, and retains its source empty guidance when a learner needs more context. Route actions reuse the established World read model and CSRF-protected route-start command: it resumes an unfinished opaque run or creates a new opaque run for a completed route. A reflection opens only through the shared CSRF-protected historical-replay command, which returns an opaque replay run. Related check-ins retain up to three validated authored learning-area links and their published map-topic return context. The original optional purpose/time filters narrow only visible in-progress routes; an explicit CSRF-protected save stores their private application preference across sessions without creating a recommendation or deadline. Recall questions open through an opaque recall run and may be deferred one day or removed; returns open only through a server-owned opaque revisit run and may be deferred or hidden. Private staff replies to a learner's message-prompt support request appear only through the learner's owned, visible support-response projection. |
| `/paths`                                                                  | `/paths`                      | Partially available | Signed-in learners can use the lifted source Paths page and shared learner header, filter the server-owned eligible routes by learning purpose or available time, page through the bounded results, and enter a route through the existing CSRF-protected opaque-run command. Its fixed platform copy and shared route-card labels resolve through the Rust platform catalog, and the shared learner selector exposes every administrator-enabled locale while broader fixed-copy consumption is migrated surface by surface. The source’s direct Inertia link is deliberately mapped to that already-established typed command; it does not expose a client-forged destination. |
| `/competence?topic={slug}&from={slug}`                                    | Same path                     | Partially available | Signed-in learners can use the lifted source Star Map, its guide, qualitative selected-topic reader, private evidence ledger, learning pulse and bounded review history. The original `topic` selection and `from` return-context query semantics reuse the existing authorized topic reader, including the source “not on your map yet” explanation. Topic context links use the existing source-derived topic route. Learning-pulse, review-history and selected-topic return controls reopen their activity only through the same CSRF-protected opaque replay command; the read contract still carries no client-supplied activity destination. |
| `/settings`, `/settings?panel=information`, `/settings/about`, `/settings/imprint`, `/settings/data-protection`, `/settings?panel=personal&personal=appearance`, `/settings?panel=personal&personal=language`, `/settings?panel=personal&personal=feedback`, `/settings?panel=personal&personal=sound`, `/settings?panel=personal&personal=security`, `/settings?panel=personal&personal=delete-account`, `/settings/profile`, `/settings/language`, `/settings/appearance`, `/settings/security`, `/settings/color-palette`, `/settings/assets`, `/settings/assets/media`, `/settings/assets/items`, `/settings/assets/tools`, `/settings/assets/sounds`, `/settings/presentation`, `/settings/languages`, `/settings/journal`, `/settings/ai`, `/settings/admin-panel`, `/settings/groups`, `/settings/worlds` and `/settings/worlds/maps/{map}/(edit|configure)` | Same paths | Available | The source-adapted Personal Profile, Appearance, Language, Feedback and Sound settings surfaces use the source's common eight-section Personal navigation rather than route-specific substitute sidebars; it preserves section order, explanatory copy, destructive styling and keyboard navigation while React URL selection replaces only the original in-page selection mechanism. Laravel's direct Profile, Language, Appearance, Color palette, asset-library, presentation, language-administration, Journal, AI, admin-panel, group and World Builder routes retain their source redirects to the canonical panels; the source admin-panel query keeps the Learning Support workspace's existing learner-message default. Valid source map edit/configure URLs preserve the scoped Rust map UUID and select the matching nodes/configure view. The separately rendered Security URL remains direct and preserves its password-confirmation return path. The source About & legal corner destination preserves its intentionally empty route group; its information pages remain their direct authenticated routes. They persist the signed-in learner's identity-owned name/email, application-owned public username, staged profile image, Light/Dark, enabled application locale, feedback-invitation choice, mute, effects-volume and ambience-volume preferences through their respective data boundaries. The selected enabled locale now loads its bounded platform-copy catalog, while active owned play runs can load filtered activity copy; both preserve fixed English fallbacks and cannot affect graph, answer correctness, media, scoring or access policy. Feedback is opt-in by default and may be declined/re-enabled without changing the separate shared feedback-message record. Security replaces only the authenticated user's credential verifier through the identity-data boundary, and preserves the source recent-password boundary before the screen opens. The source-derived TOTP lifecycle supports QR/manual authenticator setup, six-digit confirmation, login challenge with authenticator or recovery code, remaining recovery-code view/replacement and factor disable. Recovery values have one-use Argon2id verifiers and separately encrypted identity-only display copies; responses are non-cacheable. The source passkey lifecycle supports discoverable passwordless login, recent-confirmation, resident-key registration, owner-scoped list/removal and an identity-only public-credential store. The source Delete account panel preserves its warning, confirmation modal and direct current-password check; it deletes the current principal and identity through the shared resumable workflow, ends the session and returns to the welcome surface. The authenticated About, Imprint and Data protection routes preserve the source settings article and presentation-scoped Markdown editor; a reader without that capability stays read-only. Authenticated password and factor changes are delivered idempotently to the source-shaped application access history through an identity transactional outbox. Other Personal, administration and authoring settings remain unavailable. |
| `/settings?panel=admin-access&access=groups` | Same path | Available | The source-adapted Groups panel remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. It respects the migrated role permission matrix: an authorized role may see or manage all groups, only groups it created, or its assigned manager groups, according to the relevant `groups` and `group_members` scopes. It creates/edits groups, assigns application users, and shows only source-consented staff-visible chat. |
| `/settings?panel=admin-access&access=users` | Same path | Available | The source-adapted Users panel remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. It uses the typed `GET /admin/users` projection: identity-profile/status and application-role summaries, server-calculated assignable roles, bounded invitation summaries and bounded access history without credential verifiers, sessions, invitation plaintext or learner data. Its server-owned update/delete flags preserve the source read-only versus editable state. `PATCH /admin/users/{subject_id}/access` preserves role-hierarchy validation, login disablement, temporary bans, self-lockout protection and access audit through the separate identity/application databases. `DELETE /admin/users/{subject_id}` preserves source self-protection and deprovisions the identity/application pair through a resumable deletion workflow. |
| `/settings?panel=admin-access&access=roles` | Same path | Available | The source-adapted Roles panel remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. It uses `GET`/`POST`/`PATCH`/`DELETE /admin/roles` to preserve the source-shaped role catalogue, hierarchy and complete resource/level/scope permission matrix. Server-owned update/delete flags preserve read-only behavior; source `roles` levels authorize read, create/update and deletion, and system roles cannot be deleted. |
| `/feedback` | Same path | Available | Signed-in learners can use the source-adapted deliberate platform-feedback form. Rust accepts only the source category values and a bounded 10–4000-character message, then records it separately from private journal, activity and competence data. |
| `/settings?panel=admin-learning-support&support=learner-messages` | Same path | Available | The capability-gated source Learner Messages workspace uses the lifted Settings top bar, primary/sidebar and account navigation, shared source Learning Support section navigator, nested topic navigation and Needs attention digest. Its typed Rust endpoints preserve the bounded six-message/three-response pages, source filters, private-support reply restriction and staff hide/restore/delete operations for private-support and peer messages. |
| `/settings?panel=admin-learning-support&support=platform-feedback` | Same path | Available | The source-adapted Platform Feedback review queue retains the shared source Learning Support navigator and is available only to application principals with its separate view/review capabilities (initially the migrated platform-administrator role). It pages deliberately shared messages with unreviewed entries first, shows only the needed author identity projection, and preserves the source’s sole action: mark a message reviewed. |
| `/settings?panel=admin-learning-support&support=organization-icons`, `/settings?panel=admin-learning-support&support=competence-topics`, `/settings?panel=admin-learning-support&support=learning-concepts`, `/settings?panel=admin-learning-support&support=journal` | Same paths | Available | Organization-icon moderation, Competence Topics, Concept Library and Journal settings retain their typed Rust moderation/catalog/policy workflows inside the shared lifted Settings and Learning Support shell. The source nested navigator remains available across desktop and narrow layouts rather than replacing each child with a standalone administration page. Rust keeps separate `organization_moderation`, `competence_topics`, `learning_concepts` and journal-policy authorization server-owned; catalog/policy changes never rewrite existing activity or learner-evidence snapshots. |
| `/organizations`, `/organizations/{slug}`, organization membership, join-request, message and icon routes | Rust application database / typed React contract | Available | The source-shaped directory, leader-owned text/deletion and icon upload, membership, join approval, governance transitions, member chat and member icon reporting are migrated with contract, database and local browser evidence. Due random leadership rotates through the documented idempotent backend scheduler command, never on a browser read. The source-shaped moderator queue can view a reported-icon snapshot, dismiss a report, or remove the organization’s current icon through its separate capability. |
| `/learning/groups/*` | Floating World control and `/settings?panel=admin-access&access=groups` | Available | The source-derived member group-chat control and bounded platform-administrator group workspace are implemented through typed Rust contracts. |
| `/settings?panel=admin-access&access=links`, `/access-links/{token}` | Same paths | Available | The source-adapted Access links workspace remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. Administrators with the separate access-link capability can create, enable/disable and inspect bounded hashed tool/item grant, registration and temporary-login links. Registration links expose only roles the issuer may assign and create the selected application-role set through the documented compensating identity/application workflow; locally created links from before this contract retain the historical learner fallback. Temporary login creates and signs in a fresh temporary learner with a server-generated unknown verifier. Resource links remain redeemable only by a signed-in learner. Usage, expiry and replay policy are enforced server-side. |
| `/admin/topics` | Same path | Available | The source-adapted Topic Structure workspace preserves its area/topic disclosure, forms, insertion/reordering controls and responsive layout. Typed Rust requests replace only the original Inertia transport; `content_topics` read/create/update authorization and source-shaped validation remain server-owned. |
| `/settings?panel=admin-assets-world-objects` | Same path | Available | The source Settings shell now keeps its six responsive nested sections together: Visuals, Sounds, Dialogue typing, Tools, Items and Cursor images. The source-adapted reusable Visual Library provides bounded search/tag filtering, upload, metadata, replacement, private preview/download and unreferenced deletion through `assets` and `media_paths` permission checks. Its companion source-adapted Sound Library at `asset=sounds` preserves searchable sound selection, icon/volume/duration/loop metadata, managed upload, play/pause/stop preview and sound deletion through the separate `sounds` permissions. The Dialogue typing section preserves its source A–Z sound-set workspace. Audio has opaque storage, normalized reference integrity, author-only preview and anonymous delivery only while a published saved sound still references it; replacing/deleting its final reference reclaims the audio record and bytes. Its source-adapted Cursor images section retains the five source role definitions, optional add/delete/reassignment, image upload/selection, hotspot/size/fallback controls and click-point preview. Saving through `presentation.ru` synchronizes cursor media references transactionally; the anonymous presentation projection rewrites only those active references to the public media route. Reusable activity-template snapshots register managed media URLs as normalized active and immutable-revision references, so a replacement keeps a stable asset identity and deletion cannot strand a saved template or restore point. MapAssets, node visual themes, route visuals, Markdown, Portal, NPC dialogue, Item Grant, Tool Grant, Item Obstacle and Base Obstacle use the same source-adapted picker and synchronize managed visual references on save, import/duplication and cascade deletion. Learner delivery authorizes each managed visual only through its active, published and visible reference; no generic raw protected-media path is exposed. |
| `/settings?panel=admin-translations` | Backend catalog, delivery and scoped learner consumption foundation | Partially available | Authorized `languages` administrators can create disabled locale definitions, rename, enable or disable them through the source-compatible atomic update, export canonical English or a locale’s JSON catalog, and import a bounded two-MiB JSON catalog with optimistic source-version protection. The source-adapted standalone administration workspace consumes that typed Rust contract and preserves the catalog list, create, rename, enable/disable, export and import flows. Enabling a locale immediately adds it to the owner-scoped learner selector; disabling it keeps its catalog editable while excluding it from new selections. The importer persists platform strings and a strict activity learner-copy projection only; graph structure, answer correctness, media, and policy data cannot be written through it. The standalone React app source-adapts the Laravel platform-translation hook: its shared provider reads the enabled private locale's flat platform catalog, refreshes after a language-preference save, and leaves fixed-copy fallbacks intact if a request is unavailable. The lifted learner header and player consume that catalog. The player separately reads filtered activity copy only for its current, owned, active and still-visible route run, then applies only catalog-approved title/introduction, bounded activity configuration strings, Markdown-page copy, question prompt/options and NPC-dialogue node copy; it cannot alter graph structure, answer correctness, media, identifiers or policy. It is never an arbitrary activity reader. Broader fixed-copy consumption remains a surface-by-surface migration task. |
| `/settings?panel=admin-public-pages`, `/settings?panel=admin-color-palettes`, `/settings?panel=admin-translations` | Same paths | Partially available | Public presentation, Color palette and Languages remain inside the shared lifted Settings and Presentation & Localization navigator across desktop and narrow layouts. The source-adapted Public presentation workspace preserves its settings shell, branding control, dark/light authentication and public background controls, welcome-page copy/actions, ordered information-page management (up to 24 source-shaped slug/title/Markdown/dark-light-background entries), upstream and up-to-twelve ordered modified-source links, image upload and reusable-visual selection. The three direct About/Imprint/Data protection routes retain their separate fixed-content editor. Rust authorizes each reader/writer through the source `presentation` permission; saved reusable references protect selected visuals from deletion and an anonymous image is served only while the public presentation references it. Cursor images are available from the source Assets & World Objects section, and the Color palettes workspace preserves the seven public palette fields with dark/light color/opacity controls and public/login previews. |
| Remaining authoring/settings/admin routes | — | Not available | These belong to later authoring and administration slices with their own authorization tests. |
| `/protected-media/*`                                                      | —                             | Intentionally not carried | The Laravel raw map-media URL family is not a greenfield Rust endpoint. Its required behavior is replaced by managed reusable-asset upload, selection, normalized reference integrity, replacement, author preview/download, scoped learner delivery and public delivery only through active published references. The access-link preview, redemption and temporary-login contracts remain available at their source paths as recorded above. |

The older `/home` row's private-support note is superseded by the Learning
Support slice above: learners can read their own visible private replies in
the lifted Desk area. Likewise, the otherwise unavailable Settings family now
has only the source-derived Learner Messages moderation workspace and the
scope-authorized Groups workspace at
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

**Current authoring-read status — 7 November 2026:** The first World Builder
read contract is available at `GET /api/v1/admin/world-builder`. It mirrors
Laravel's two-stage boundary: any `world_maps`, `world_nodes`,
`world_activities`, or `world_map_access` read grant can open the area, but
the returned graph contains only maps selected by the source all/own/assigned
scope and direct editing-group membership. It returns draft map/node fields,
portal candidates and portal links as a separate authoring projection; it does
not reuse learner visibility reads. Review-queue counts and full unlock-path
diagnostics remain zero/empty until their source data models and authoring
workflows are migrated. Overview and selected-map projections now calculate the
source unlock-path diagnostics for locked tiles; they stay author-only and are
backed by the same authored data rather than a browser calculation. The selected-map configuration projection is now also
available at `GET /api/v1/admin/world-builder/maps/{map_id}`. It deliberately
requires the stricter source `world_maps` update permission and evaluates
delete eligibility independently. Its source-shaped support reads now include
map access groups, the current editor's manageable learning groups, role and
topic options, and reusable items and tools; all are fetched only after the
map authorization decision. The selected-node activity graph is now available
at `GET /api/v1/admin/world-builder/nodes/{node_id}` and requires the source
`world_activities` update grant plus its all/own/assigned/direct-editor map
scope. It projects activities, transitions, the eligible preferred start and
ordered starts, portal targets, and the source's exit-portal candidates from
every map in the same World; it also returns message topics, reusable
items/tools/sounds, source records and active concept/topic options from
dedicated authoring facts. The reusable item and tool catalog now also has its
own source-compatible authoring boundary: authorized `assets.ro` principals can
list the complete catalogue, while `assets.ru` principals can create and update
its exact source fields through `/api/v1/admin/assets/items` and
`/api/v1/admin/assets/tools`. The commands preserve source title/slug rules,
tool display configuration and media-reference lifecycle protection. The
source-derived two-pane Settings workspace is available at
`/settings?panel=admin-assets-world-objects&asset=items` and
`/settings?panel=admin-assets-world-objects&asset=tools`; it keeps the source searchable
catalogue, new-entry state, metadata fields and managed reusable-visual picker
rather than replacing authoring with a generic administration form. It remains
distinct from learner route playback.
The source World Builder review queue is now available at `GET
/api/v1/admin/world-builder/review-queue`: it preserves the source four-card
default, twelve-item maximum and map/node/activity ordering, while applying the
same activity-authoring all/own/assigned/direct-editor scope as the selected
node reader. Overview map cards now report their real scoped pending-review
counts, and selected-node activity documents include up to five compact,
immutable review-run summaries when runs exist. This reader stores no learner
data and does not invoke an AI provider or write authored content. AI provider
credentials and reusable agent templates are now available at
`/settings?panel=admin-ai-integrations`: the source Provider keys, Agent
templates and Guardrails sections remain inside the shared lifted Settings and
AI nested shell across desktop and narrow layouts, while using typed Rust
contracts and the source
`ai.ro`/`ai.ru`/`ai.rud` permission levels. Provider key plaintext is encrypted
with purpose-separated server-side material and is never read back into the
browser; deleting a provider detaches its templates. A saved-template test now
accepts one bounded prompt only through `ai.ru` plus CSRF, decrypts the selected
provider key only for that outbound request, and returns text plus bounded usage
metadata without storing a content change or exposing credential material. The
lifted standalone template panel keeps the source saved-only test control,
server-key notice, result pane and sanitized failure state rather than making a
browser credential field or a new AI workspace. An author with both the
source-scoped `world_activities` and `ai.ru` grants can now choose an enabled
`activity_review` helper from the selected-node editor and request `POST
/api/v1/admin/world-builder/activities/{activity_id}/ai-review`. The backend
alone decrypts its provider key, submits only the source-bounded activity
context and the strict versioned review schema, validates every model field
before writing the activity's review record and immutable run, and never sends
learner data. The source-derived dialog makes clear that the result is an
authoring aid rather than a learner grade. When a review proposes a learning
purpose or competence topics, its **Edit metadata draft** handoff opens an
author-controlled source-shaped metadata form; it never sends provider output
to the write route, and no change happens until the tutor explicitly saves the
form. That save records pre-change history and returns the activity to
`needs_review`; it does not change learner data or non-metadata activity
fields. Unlock diagnostics also remain
Every editable activity card also has the source-shaped Learner orientation
form for the common evidence objective and up-to-eight de-duplicated concepts.
It saves only that author-controlled context, records a pre-change version and
resets review state; Rust's existing learner playback and evidence projections
then consume their already-bounded forms without exposing a grading claim.
The same common authoring surface now includes source-shaped Feedback guidance:
purpose, observable evidence, response comparison, next action, up to three
rubric cues, and explain/transfer-only optional independent-check guidance.
The explicit save records history and resets review state; it neither invokes
an AI provider nor turns guidance, response comparison, or observable cues
into a learner grade.
Authors can also save the source's optional bounded Choice context for the
existing learner conclusion directions. It explains a possible next step but
does not add a recommendation, change the choices, or imply a required route;
its explicit save likewise records history and resets review state.
The first graph mutation is now available at `PATCH
/api/v1/admin/world-builder/nodes/{node_id}/activity-graph-layout`: it preserves
the original editor's independently persisted, rounded `start`/`end` graph
positions under the same scoped activity-authoring and CSRF boundary, without
changing learner starts, activities or playback. Subsequent source-shaped
activity, route-start and transition commands have their own bounded contracts;
source-catalog writes were deferred until their separate reuse and revision
contract was available.
Ordinary activity-card dragging is now also available at `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/graph-position`. It
preserves the source UI's finite-number validation and integer rounding, locks
the scoped activity/node and changes only `graph_position_x`/`graph_position_y`.
It is intentionally not an activity-content editor, does not start or end a
learner route, and is consumed only by the source-derived World Builder graph
reader rather than an independent substitute screen.
Activity deletion is now available at `DELETE
/api/v1/admin/world-builder/activities/{activity_id}`. It retains the original
command's activity-authoring scope, removes the activity's selected-node starts,
resynchronizes the node's preferred start, and then lets the reviewed database
foreign-key cascades remove dependent activity data. The original editor can
refetch its node projection after the no-content response. The first
activity-creation contract is now available at `POST
/api/v1/admin/world-builder/nodes/{node_id}/open-practice-activities`. It
ports the source Open practice title, optional slug/introduction and learner
invitation fields, including the source default invitation and node-scoped slug
suffixing. It immediately publishes the new activity, as source creation has
no independent activity-draft state. Rust's retained route grouping is selected
internally and deterministically for this source-shaped node command; ADR-093
records that temporary storage adaptation. The remaining registered activity
types now use their own source-shaped commands below; they do not fall through
to a generic configuration writer.
Open Practice editing is now available at `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/open-practice`. It accepts
the source form's title, slug, introduction and learner invitation as one
complete edit, preserves unrelated stored configuration, and applies the
source editor's `updated_at` optimistic-concurrency check. A stale save is
returned as a conflict rather than silently overwriting a newer save, while an
unchanged save retains its timestamp. Content changes reset the currently
available AI-review state to `needs_review`. The source-adapted Activity
History dialog is now available from every Rust World Builder activity card:
it pages immutable pre-change snapshots six at a time, inspects fields,
configuration and outbound routes, and restores a selected snapshot
transactionally only within the same scoped `world_activities` authoring
boundary. Restore first records the current state as a new snapshot, restores
the selected activity and its outbound transitions, then resets review state;
an NPC dialogue activity restores its node/edge graph and author-only layout
within that same snapshot, then reconciles reusable-media references. The
migrated activity-content, transition and graph-position commands record their
own pre-change snapshots, while unsupported source workflows remain outside
this claim.
The reusable source catalog is now available at `GET`/`POST
/api/v1/admin/source-records`, with scoped `PATCH`/`DELETE` and bounded
revision/restore endpoints beneath each record. It source-adapts Laravel's
metadata bounds, exact-metadata create-or-reuse behavior, title/URL/publisher/
anchor/excerpt/concept search and filtering, and immutable pre-change history.
Editing or restoring always preserves the current source as a new version;
deleting a catalog record removes only that reusable entry and its history,
never copied source metadata already held by activities or learner evidence.
The original source-catalog controls are available within the Rust World
Builder workspace as a temporary source-derived access point. Every editable
Rust activity card now opens a source-derived Source references dialog: an
author may attach a saved catalog record as an activity-owned copied citation
or enter the same bounded citation fields directly. The explicit source save
records a pre-change version, resets the review state, and deliberately never
keeps a catalog-record foreign key, so later library edits cannot silently
change learner evidence or review context. Saving an ad-hoc citation back into
the reusable catalog remains a separate catalog-convenience migration.
Reflection creation and editing are now available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/reflection-activities` and `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/reflection`. They retain
the source prompt, optional note and topic fields with their original bounds,
stored defaults and optimistic-concurrency protection. The narrow command
preserves unrelated activity configuration but deliberately does not claim the
distinct Review/revisit behavior or any shared generic activity editor. The
source Review / revisit form now has its own create/edit route pair while
reusing only the same bounded prompt, note and journal-topic fields: Rust
persists the distinct `review` type, so learner playback retains its separate
earlier-note, confidence and revisit semantics rather than treating it as a
Reflection.
Source Markdown page-graph authoring is now available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/markdown-activities` and `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/markdown`. The lifted
editor retains the source Start/page/End graph, page positions, bounded
Markdown text, dark/light page colors and preview. Its complete graph save uses
the same scoped CSRF and optimistic-concurrency boundary, preserves unrelated
configuration and records embedded managed reusable-media URLs as activity
references, so selected images cannot be deleted while an authored page uses
them.
Item-grant creation and editing are now available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/item-grant-activities` and `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/item-grant`. They retain
the source title, optional visual fields, item quantities and probability
bounds, but resolve every submitted greenfield catalog UUID only after the
node's scoped authoring check. Playback receives only server-resolved item
slugs, so a browser cannot author a forged catalog reference. The complete
edit retains the same `updated_at` optimistic-concurrency boundary and leaves
unrelated activity configuration untouched. This uses the existing
Rust-owned generic activity configuration migration; no Laravel schema or data
is imported.
Tool-grant creation and editing are now available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/tool-grant-activities` and `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/tool-grant`. They retain
the source dark/light background, bubble presentation, animation, text, tool
placement and typing fields with their source defaults and bounds. The optional
catalog-tool UUID is resolved only after the scoped node or activity writer has
authorized the caller, and the persisted configuration contains only the
server-owned tool slug consumed by learner playback. A complete edit uses the
same `updated_at` optimistic-concurrency boundary and preserves unrelated
configuration keys. This uses the existing Rust-owned generic activity
configuration migration; no Laravel schema or data is imported.
Item-obstacle creation and editing are now available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/item-obstacle-activities` and
`PATCH /api/v1/admin/world-builder/activities/{activity_id}/item-obstacle`.
They retain the source state-specific backgrounds, overlay placement, up to ten
item slots, consumption/replay-lock options and the three explicit sound-event
controls. The scoped writer resolves item UUIDs to learner-safe slugs and
checks sound UUIDs only after it has authorized the node or activity. A
complete edit preserves unrelated configuration and uses `updated_at`
optimistic concurrency. This uses the existing Rust-owned generic activity
configuration migration; no Laravel schema or data is imported.
Base-obstacle creation and editing are now available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/obstacle-activities` and `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/obstacle`. They retain
the source normal, solved and revisit visuals, bubble presentation, prompt,
placement, solved-state behavior and typing/animation settings. The scoped
writer resolves the submitted catalog-tool UUID collection only after it has
authorized the node or activity, then stores only the learner playback slugs.
A complete edit preserves unrelated configuration and uses `updated_at`
optimistic concurrency. The collection is bounded at 100 because the existing
safe learner projection has the same maximum; this prevents silently hiding an
author-selected tool. This uses the existing Rust-owned generic activity
configuration migration; no Laravel schema or data is imported.
The first route-start command pair now adds or removes a node's activity start
membership through the source eligibility rule: an activity must belong to that
node's map asset and an exit portal cannot be a learner start. Each command
atomically resynchronizes the legacy preferred start from the ordered eligible
routes. Route-start presentation editing and ordering are now source-compatible:
visual fields retain the original bounds and color validation, and route moves
lock the node's complete start list, renumber it and resynchronize the preferred
start. Activity-content commands remain type-specific rather than accepting a
generic configuration payload.
Transition creation is now available through the source-defined scoped command:
it validates both endpoint activities against the selected node, derives the
trigger and fallback label from the source connector, preserves idempotency by
the endpoint/connector identity, and rejects a non-terminal entry portal.
Transition editing and deletion now use the same scoped authoring boundary.
Editing preserves the source form's narrow scope: it accepts only the display
label and an outcome transition's optional trigger value; an empty label falls
back to the target activity title or source connector label. Deletion returns
the selected node's complete ordered transition state. Any future activity type
remains unavailable until it has its own source-shaped writer.
The source-derived World Builder graph reader is now exposed through
`/settings?panel=admin-world-builder`. It uses the original React Flow graph
language to read the scoped world graph, then separately loads a selected map
and selected node activity graph through all three Rust authoring-read
contracts. Activity cards and the Start/End graph markers retain source graph
dragging through their existing scoped position commands, and the source delete
confirmation through the scoped delete command; the node refetches only after a successful removal. Within a selected
node, the graph also adapts source edge creation: an activity drag uses the
typed transition command and a Start drag uses the typed start-route command.
It renders every ordered learner start with its source connector IDs; selecting
a Start edge opens the source-shaped route-visual editor for that start,
including learner guidance, optional light/dark images and button colors,
ordering and a separate delete confirmation. Selecting an authored edge opens
the source transition editor, preserving its label/outcome-only edit rule and
direct connection deletion. It now adapts the source
Open Practice, Reflection, Review / revisit, Markdown, Question, Shared Task, Item Grant, Tool Grant, Item Obstacle and Base Obstacle create/edit
forms through their complete typed Rust commands. Shared Task preserves its source task/repeat/validation/cycle choices, anonymous contribution boundary, project brief and optional anonymous peer-review invitation under the same scoped, CSRF-protected, optimistic-concurrency writer; Item Grant resolves selected catalog UUIDs
only at the scoped server command and retains its quantities, probability and
scene configuration, while Tool Grant does the same for its optional tool and
retains the source bubble, motion, placement and scene fields. Each form
refetches after a successful write. Item Obstacle carries its normal/completed
scene fields, positioned catalog-item slots, replay/lock behavior and the
three catalog-sound events through the typed scoped command. The World Builder
also adapts source Question creation and editing: its prompt, global feedback,
post-answer explanation, multiple-selection setting and two-to-twelve answer
cards retain option labels, bodies, correctness, optional route outcome keys,
feedback and hidden source weight maps under the same scoped CSRF and
optimistic-concurrency boundary. Learner playback continues to receive only
its existing safe question projection.
It also adapts source Message prompt and Message wall creation and editing. The
writer resolves a map-scoped existing or new topic, preserves the source
peer/support and response-type boundaries, rejects a prompt/wall type switch,
and stores all ten authored dark/light message-surface colors with the source
live preview under the same scoped CSRF and optimistic-concurrency boundary.
Its source Create world map dialog is also available through `POST
/api/v1/admin/world-builder/maps`: title, optional slug and description retain
their source bounds; Rust resolves the current authoring World, assigns the
creating principal, generates collision-safe omitted slugs and returns a draft
map that the browser graph refetches before selecting. Authors holding the
stricter scoped `world_maps` delete permission can now confirm deletion through
`DELETE /api/v1/admin/world-builder/maps/{map_id}`; the selected map is cleared
only after the database transaction cascades its owned tiles, activities,
portal links and learner state, then the browser refetches the graph. The
selected map's source Map Details form is also available through `PATCH
/api/v1/admin/world-builder/maps/{map_id}/details`: title, nullable description
and learning topic, and MapAsset locking save together through the map editor
scope with an `updated_at` conflict boundary; the browser refetches the map and
graph only after success. Its source-derived history dialog now lists bounded
newest-first immutable revisions through `GET
/api/v1/admin/world-builder/maps/{map_id}/versions` and restores a selected
same-map revision through `POST
/api/v1/admin/world-builder/maps/{map_id}/versions/{version_id}`. Both paths
reuse the same scoped map-editor authority; every update and restore snapshots
the current title, description, topic and MapAsset-lock state first. Restoring
keeps the form open with the returned values and refreshed history, then the
browser refetches the graph when the author closes it. The same source-derived
MapAsset editor now also exposes its bounded configuration history through
`GET /api/v1/admin/world-builder/assets/{asset_id}/versions` and restores a
same-asset revision through `POST
/api/v1/admin/world-builder/assets/{asset_id}/versions/{version_id}`. Every
accepted MapAsset update or restore snapshots the outgoing learner-facing
surface, placement, interaction and sound configuration first. The lifted
history dialog updates the still-open editor with the restored configuration,
refreshes its own revision list, and refetches the map only when the author
closes the editor. The same source-derived
Access dialog now keeps map
viewer roles and group-editor assignments as separate commands: the latter
accepts an empty replacement or only learning groups manageable by the caller,
under the distinct map-access scope, and never changes learner visibility. The
source-shaped reusable Activity Template Library
is now available beside that graph: eligible cards save private named snapshots,
update a creator-owned template while preserving the outgoing snapshot in
bounded revision history, and open the same existing typed activity form as an
editable `title (copy)` draft. The library lists only owned or organization-
shared templates, loads full snapshots only for preview, permits one membership-
validated organization share target, keeps shared templates read-only for
members, and retains creator-only rename, restore and deletion behavior.
The API is backed by separate template/version tables and preserves the
source's initial-revision and restore-current-first semantics. Its browser
proof covers save, update, history restore, editable-copy handoff and delete on
the disposable Rust stack. Reusable-media availability and replacement stay in
the dedicated media-lifecycle slice rather than being replaced by an invented
template-media control. The per-activity source `Create editable copy` action
is also lifted: it opens the same typed draft with its `title (copy)` default
and destination MapAsset chooser. A same-MapAsset Portal copy retains its
authored exit target; moving any copy elsewhere clears message-topic and
portal-target references before it is saved outside the source context. Its
browser proof creates and removes a direct copy, verifies the Portal target
preservation/clearing boundary, and checks the dialog at desktop and narrow
viewports.
The local Compose backend now exposes a private, non-cacheable Prometheus
`GET /metrics` scrape route without adding a second listener or a public Nginx
proxy. The opt-in `observability` Compose profile runs a private Prometheus
scraper and evaluates backend-unavailable and sustained-5xx-ratio rules; it
has no host port and no Alertmanager, so it cannot notify externally. The API
records aggregate HTTP response counts and duration/known response
size/per-request database-query summaries, plus actual streamed response-byte
counters, by method, matched route template and status only. The SQL tracing
layer uses query completion events only to increment the current request count;
it does not capture query statements, bound values or result data. Request
paths, query values, principals, IP addresses and payload data are deliberately
not labels. The scrape route does not record itself. This supplies a local
operational signal and rule-evaluation evidence, while production alert
routing, ownership and rollback exercise remain required for the final
operations gate.
Its first source-adapted reusable-visual-library
vertical slice is now available at `/settings?panel=admin-assets-world-objects`: `assets.ro`
lists a bounded searchable/tag-filtered catalog, `assets.ru` may upload a
byte-validated GIF/JPEG/PNG/WebP/SVG under five MiB, edit the source-sized name,
category/tags/transparency/animation metadata, and replace bytes while retaining
the stable asset ID. `assets.rud` alone may delete an unreferenced asset; the
fresh normalized reference table is the deletion-integrity boundary for later
selection writers. Preview and download use an authenticated private content
route with opaque MediaStore keys, `nosniff`, sandbox CSP and private cache
headers. The source-shaped browser library proves upload, metadata, replacement,
preview/download affordance and deletion on fresh development data. The source
MapAsset surface now has a full-size selectable canvas, centered add action,
source geometry and interaction controls, learner-rendered preview, activity
handoff and scoped deletion. Selecting an existing reusable visual stores its
private stable content path in the authored MapAsset and synchronizes the
normalized `map_asset` reference transactionally; direct MapAsset and map
cascade deletion both remove those links. Learner/public MapAsset projections
rewrite only managed reusable-media paths to a Rust-owned endpoint, which serves
bytes only while an active reference belongs to a published MapAsset on a
role-visible map; source-shaped restrictive headers and the short private cache
lifetime are preserved. Route-visual selection now has the same protected
reference lifecycle: dark/light source-compatible inputs select a reusable
visual, its `activity_start` records synchronize transactionally and clean up
on route or map deletion, and learner delivery permits it only through the
published route's visible map. Wiring the selection/reference writer into other
activity forms, grouped reference presentation and orphan reconciliation remain
explicit completion work. Other activity-card types deliberately remain
read-only in this surface.

The source hex-grid tile-placement writer and layout-history dialog are now
available beside the existing MapAssets list. Tile placement accepts integer
`q`/`r` coordinates under the map-editor scope, snapshots only real moves, and
rejects occupied coordinates. Bounded history lists and previews saved/current
tile positions; restore validates unchanged node membership and unique saved
coordinates, snapshots the outgoing layout, then restores atomically. Browser
proof creates disposable tiles, moves one twice, previews and restores a saved
layout, then removes the disposable map. Adjacent tiles can also be swapped in
one of the source hex grid's six directions: the writer requires an occupied
neighbor, locks both map nodes, snapshots the outgoing layout and completes the
exchange through the same collision-free temporary coordinate range. Its browser
proof creates a disposable pair, swaps it, verifies the saved history entry and
removes the map. The adjacent-edge insert command is also available through the
existing MapAsset authoring surface. It requires an occupied neighbor, locks the
whole map, shifts the contiguous source hex chain in reverse order and creates
a new MapAsset, linked tile and draft route atomically in the gap. Insertion
does not create a layout revision because it changes membership; its browser
proof verifies the origin, inserted tile and shifted neighbor coordinates, then
removes the disposable map.

The complete source node writer now has its own contract instead of treating a
default MapAsset as an authoring substitute. `POST
/api/v1/admin/world-builder/maps/{map_id}/nodes` creates the requested
hex-grid node, default focusable MapAsset, and draft route atomically under the
source `world_nodes` update scope. `PATCH
/api/v1/admin/world-builder/nodes/{node_id}` follows the source map-editor
scope, records a layout snapshot only when the coordinate changes, and saves
the title, optional slug, description, seven source states, and complete
source-compatible visual configuration. `POST .../nodes/{node_id}/insert`
uses the source map-editor scope to move an occupied directional chain before
creating the complete node in the gap; it deliberately does not snapshot a
membership-changing layout. `DELETE .../nodes/{node_id}` requires the stricter
source node-delete scope, removes incoming transitions and completed-node
unlock references from other nodes, then deletes the linked MapAsset graph in
one transaction. Before any create, update, or insert commits, it resolves
author-selected tool/item UUIDs to verified learner-safe slugs, validates node
and role references, canonicalizes source `datetime-local` schedules to UTC
RFC 3339, and rejects empty, self-referential, or mandatory cyclic locked-node
unlock requirements. The typed contract and disposable browser proof cover the
lifecycle. The standalone World Builder now lifts the source tile dialog's
identity, description, state, hex-position and destructive lifecycle controls.
Its presentation section writes source-compatible label/hover text, visibility,
dark/light colors, image placement and opacity, and selects reusable visuals
through the established media picker. Its availability section writes the
source discovery, prerequisite, AND/OR grouping and UTC schedule controls,
using the existing server-authoritative catalog resolution, cycle validation
and schedule canonicalization. Its four source interaction-sound controls now
select and preview reusable published sounds; the writer authorizes and
verifies each sound UUID before persistence, and the learner projection exposes
only resolved public URLs. The existing writer synchronizes visual-media
references transactionally without discarding the selected sound configuration.

The node's source `Lock for all users` backend action is also now available
through a scoped typed command. It removes only existing learner tool-unlock
rows for the selected editable node, never learner discovery or support-issued
manual overrides. The lifted source-styled dialog exposes the `Lock for all
users` confirmation alongside metadata, tile-presentation, availability and
interaction-sound edits.

The Learning Support panel now lifts the source manual override control. Its
scoped read contract projects only locked nodes on maps the current support
author may edit, alongside learners already visible through the support scope.
Opening or closing an override still independently rechecks both authorities;
it does not change discovery or tool-use records or expose a general learner
lookup.

### World Builder unlock-reachability diagnostics slice — 8 November 2026

The authoring graph and selected-map projections now calculate the Laravel
opening-path diagnostic for every returned locked tile. It traces completed-tile
requirements through nested AND/OR rules and treats valid tool, item, role,
schedule, hidden-tool-discovery, and NPC-answer events as independent opening
paths. An openable OR alternative suppresses a warning. The source-adapted tile
dialog renders the existing warning and its Learning Support fallback copy; a
disposable browser test creates an unreachable prerequisite and proves the
warning is visible. The calculation is server-side, uses only authoring reads,
and does not change learner availability.

### Learning Companion platform configuration backend slice — 8 November 2026

The Rust application now persists the source-shaped singleton platform
configuration for the Learning Companion: enabled state, display name, optional
avatar URL and framing, color, orientation message, scripted/guided/open AI
mode, guarded AI enablement, a `learner_companion` template reference and at
most three allowlisted context capabilities. `GET` and CSRF-protected `PATCH`
`/api/v1/admin/learning-companion` require the existing `companion` role
permission; template selection is constrained server-side to the intended
purpose. The endpoint is a configuration boundary only: it never invokes a
provider or resolves learner context.

### Learning Companion dialogue authoring backend slice — 8 November 2026

Reusable source-shaped dialogue graphs are now Rust-owned. The companion role
can list, create, read, replace and delete graphs through the typed API; every
graph is bounded to the source's version-one, 24-node grammar, permitted
navigation actions and three allowlisted AI capabilities. Graphs can be scoped
to up to 100 worlds, maps, nodes or activities. The assignment target list and
writer both intersect the caller's companion permission with the relevant map,
node or activity authoring scope, including direct map editing groups. This is
dialogue authoring only: scope-configuration authoring and learner context/action
projections remain later slices in the agreed backend-first sequence. The
source-adapted platform settings and dialogue workspace are defined below.

### Learning Companion learner context backend slice — 8 November 2026

The Rust API now resolves the source-shaped companion projection for the
authenticated learner desk, a visible World map, or a visible/playable activity.
`GET /api/v1/learner/companion` returns only the bounded identity, deterministic
navigation actions, AI-enabled indicator and validated dialogue graph; it never
serializes an AI template, credential, answer history or mutation command.
The resolver now also reads object-only `companion_config` values stored on
World, map, node and activity records. It applies valid source-shaped fields
from broadest scope to most specific, including bounded visual placement,
mode, AI policy and dialogue; an assignment replaces the stored graph at the
same scope. Invalid stored values are ignored rather than breaking learner
access. The platform configuration provides the fallback identity/message; an
inaccessible map or unplayable activity returns no companion. For an active
activity it also reads the matching server-owned route run and route start, and
independently exposes completed-activity eligibility for bounded post-attempt
assistance; neither value comes from a browser parameter. Scope-configuration
authoring remains a later slice. The guarded provider-turn command and
source-adapted launcher are defined below.

### Learning Companion scoped-configuration transfer slice — 8 November 2026

The existing authored-content transfer boundaries now preserve the
Rust-owned object-only `companionConfig` at map, node and activity scope.
Single-map, World and portable-package manifests serialize it; structural
preflight rejects a present non-object/non-null value; imports and duplication
copy it to fresh records and include it when synchronizing managed-media
references. Standalone MapAsset transfer preserves only node/activity scope,
matching its ownership boundary. The browser round trip exports a disposable
map, adds distinct map/node/activity values to the manifest, preflights and
imports it, then asserts the World export retained all three. This is
transfer integrity only: scope-configuration authoring and activity-history
and template snapshot parity remain later slices. Guarded provider turns and
the lifted launcher are defined below.

### Learning Companion activity-snapshot retention slice — 8 November 2026

The source Activity History and reusable Activity Template Library now retain
the stored activity-level object-only `companionConfig` in their snapshots and
immutable revisions. Restoring an activity revision writes the selected object
with the selected activity graph fields; template creation, update and revision
restore keep the same object and their existing media-reference traversal.
Malformed legacy snapshot values fall back safely to an empty object. This
keeps established rollback and reuse workflows from silently discarding a
learner-context override without creating a configuration editor, applying a
template's value to a new activity or invoking a provider. NPC dialogue
activities remain outside reusable activity templates, as in Laravel, because
their dedicated dialogue graph is its own authoring boundary.

**Gate:** representative export/import and media lifecycle tests pass on fresh
data; no Laravel-specific storage or serializer path is in the active
Rust/frontend flow.

### Learning Companion guarded provider-turn backend slice — 8 November 2026

Rust now owns the source-shaped single-turn provider boundary for an authored
Learning Companion AI node. `POST /api/v1/learner/companion/turn` accepts only
the current desk, World-map or activity surface, an authored node ID, one of
the four source assistance choices and an opaque active-run ID. It resolves
the published, playable scope; inherited configuration; assigned dialogue;
active run; completed activity; guarded `learner_companion` template; and
capability intersection server-side. Browser prompt material, template IDs,
private learner answers and navigation/content mutation commands are never
accepted. One successful provider call returns bounded plain text with the
source disclosure. Question/hint help is recorded only against the active
activity run and replaces independent completion evidence with the recorded
support level; post-attempt support never rewrites earlier evidence. The
source-adapted launcher that invokes this boundary is defined below.

### Learning Companion learner launcher slice — 9 November 2026

The standalone React frontend now lifts the source Learning Companion launcher
and local dialogue traversal onto the existing learner desk, World map,
bookmarks, paths, competence, topics, organisations and activity-player
surfaces. It fetches only the server-owned companion projection, opens only
for authenticated learners when that projection is available, and uses the
source visual framing values for the companion avatar. The World placement sits
beside the desktop map-search control; the other source surfaces retain the
lower-left launcher. Message, choice and end nodes retain their transient
Back/Restart traversal, while navigation choices resolve only to the bounded
server-generated actions. AI nodes submit only their authored node ID, chosen
source assistance level and opaque server-owned context through the guarded
turn endpoint; no browser prompt, answer, template or navigation command is
introduced. The panel repeats the bounded-context disclosure and distinguishes
recorded assistance from independent evidence. The activity playback projection
now includes its already-authorized activity UUID solely so this client can
request the companion context for that same run. A disposable authenticated
browser check opens the launcher during an active activity run.

### Learning Companion administration frontend slice — 12 November 2026

The standalone React settings shell now lifts the source-shaped Learning
Companion administration workspace inside the shared source Settings and
Learning Companion nested navigation on desktop and narrow layouts. Companion-role authors can update the
bounded platform identity and AI policy, list, search, create, edit and delete
reusable dialogue graphs, inspect their flow in the source-adapted graph
canvas, and assign each graph only to the Rust-filtered authored targets. The
browser remains a typed client of the existing CSRF-protected API: Rust
validates all graph grammar, capability limits, template purpose and target
ownership; the UI cannot invoke a provider, alter learner context, or author
scope configuration. A disposable authenticated browser check updates the
platform setting, saves a graph, assigns a target and deletes the graph at
desktop and narrow viewport sizes.

### Content API map foundation slice — 12 November 2026

Rust now exposes the first source-compatible `/api/content/v1` namespace. Its
machine-readable contract is session-authenticated and separately gated by the
source `content_api` permission. It currently documents and serves only the
operations Rust owns: reading the contract, listing maps already visible in
the caller's scoped World Builder graph, creating a map through the existing
CSRF-protected World Builder command, and listing or creating source-shaped
MapAssets for one already editable map. The MapAsset read reuses selected-map
scope and obtains activity counts in one aggregate query; its write reuses the
atomic MapAsset, compatibility-node, and draft-route command, carrying the
source API's explicit node title and description. Content API permission never
widens map scope or lets a request nominate a World. MapAsset Activity listing
uses the distinct scoped World Activity policy; Reflection, Review, Open
Practice, Markdown, Question, Shared Task, Item Grant, Tool Grant, Item Obstacle, Obstacle, Portal, NPC dialogue, Message Prompt, and Message Wall are the only Activity
types currently creatable through the API, preserving their existing typed
commands, Markdown's managed-media references, Question's bounded answer
options, Shared Task's bounded collaboration configuration, Item Grant's
scoped catalog resolution, Tool Grant's scoped tool resolution, Item Obstacle's scoped item/sound resolution, Obstacle's scoped tool resolution, Portal's same-World input-target resolution and transactional link/media-reference write, NPC dialogue's default end-node scaffold, Message's map-scoped topic resolution, and optional graph coordinates. Those fourteen entries are the complete source
`ActivityTypeRegistry` set, so the contract does not advertise a partially
migrated source Activity type. The contract also now publishes the source-compatible strict
ContentPlan draft schema for the five source-supported plan activity types.
The scoped Rust authoring endpoints generate and persist one reviewable draft
for an editable map, and let only its creator save an edited draft after the
same schema, selected-source and current map-scope checks. Provider execution
uses the existing encrypted server-only Responses boundary; no prompt, key or
unselected context is serialized back to the browser. The owner may explicitly
apply a draft once through a CSRF-protected endpoint. Rust locks the draft and
map, revalidates the stored plan and original source scope, then creates its
MapAsset, compatibility node, route, five supported typed Activity forms, route
start and linear transitions in one transaction before marking the run applied.
Markdown media references are synchronized in that transaction; any failure
rolls all writes back. Source attributions use opaque Rust source-record UUIDs;
Laravel's numeric record identities are not a greenfield compatibility target.
The source-derived standalone World Builder now exposes that authoring dialog
from an editable map only after the full draft lifecycle is present: authors
choose an enabled scoped content-authoring template, select bounded source
context, review or edit the validated plan, and explicitly approve one atomic
application. The browser remains a typed client and refreshes its map only
after the server reports the apply transaction successful.

The standalone Settings API surface now also lifts the source API Console and
API Documentation views inside the shared source Settings and Content API
navigator across desktop and narrow layouts. It loads the live Rust Content API contract first,
uses only its advertised operations, blocks unresolved path placeholders, and
obtains the existing same-origin CSRF token only for documented mutations.
The response pane exposes the exact server status and JSON body; it never turns
the console into a bearer-token client or a substitute for the contract's map
and activity scope checks. The local browser proof creates a disposable map,
MapAsset, Open Practice Activity, NPC dialogue, Message Prompt, Message Wall,
Reflection, Review / revisit and Markdown through that console, then reads all
fifteen Activity records across two MapAssets, including a bounded-answer
Question, Shared Task, catalog-resolved Item Grant and Tool Grant, an Item
Obstacle with a catalog-resolved item slot, a tool-resolved Obstacle, and a
same-World Portal input/output link, back through the documented scoped route.
The OpenAPI contract and generated TypeScript client now mirror every
advertised operation, including the map lifecycle; no live console operation
is outside the typed API surface.

Frontend migration gates include source navigation and discoverability, not
only a directly addressable route. A source-derived authoring workspace is not
considered lifted until an authorized browser can find it through its source
Settings path and complete the corresponding browser proof. Server-projected
visibility hints may expose only that an entry is available; they never expose
permission scopes or replace endpoint authorization.

The bounded Content API graph slice exposes source-ordered connection reads and
an explicit create/update/delete lifecycle for Activity connections within one
scoped MapAsset. It delegates to the existing idempotent World Builder
transition commands, so connector validation, entry portal terminal rules and
activity-history snapshots remain server-owned. Update and delete additionally
prove that the path transition belongs to the path MapAsset before delegation;
the machine contract, generated TypeScript client and console advertise those
operations only after that complete boundary is present. It does not infer or
automatically wire learning paths.

The Content API also deletes one scoped Activity only after proving that it
belongs to the MapAsset named in the URL. It then delegates the complete
transactional route-start, preferred-start, dependent-record and managed-media
cleanup to the existing World Builder deletion command; the API introduces no
second cleanup implementation.

The Content API now also exposes a complete scoped MapAsset surface-replacement
and deletion boundary. Both adapters require their corresponding `content_api`
capability level, a same-origin CSRF token and the existing World Builder map
scope; deletion additionally requires the existing `world_maps.rud` scope.
They delegate to the typed World Builder command rather than duplicating its
history, cascade or reusable-media-reference rules. A replacement updates only
the MapAsset surface, intentionally preserving the linked node's creation
title and description. The live machine contract, generated client and
source-adapted API console advertise those operations only after the route and
browser proof are present.

The Content API map lifecycle now reads, replaces and deletes one scoped map
through the exact World Builder commands. The read returns the source Map
Details concurrency timestamp; replacement requires that current value and the
complete title, description, topic and MapAsset-lock form, then returns the
fresh projection. It deliberately leaves visuals, access settings and MapAssets
to their distinct commands. Map deletion requires `content_api.rud` and the
existing `world_maps.rud` scope, preserving the transactional cascade and
managed-media cleanup. The generated client and disposable console browser flow
prove the read/update/delete lifecycle before it is advertised.

The first thirteen type-specific Content API mutations replace Reflection, Review,
Open Practice, Markdown, Question, Shared Task, Item Grant, Tool Grant, Item Obstacle, Base Obstacle, Portal, Message Prompt and Message Wall Activities. Activity reads include their
source concurrency timestamp; each writer requires it and the complete source
form, proves both its distinct activity type and MapAsset membership through the
existing scoped query, then delegates to the matching typed World Builder
command. Markdown keeps its page-graph and managed-media-reference update,
Question keeps its answer configuration, Item Grant, Tool Grant, Item
Obstacle and Base Obstacle resolve their catalog UUIDs server-side, and Portal resolves its
selected same-World input Portal inside its command. Message Prompt and Message
Wall retain their typed topic/audience contract inside their command. This establishes the
backend-first pattern for later type-specific activity updates without an
untyped JSON activity writer or a new frontend surface.

NPC Dialogue follows the same backend-first boundary as a separately scoped
graph lifecycle: the Content API reads the source graph, then delegates each
individual node, edge and start-layout mutation to its existing typed World
Builder command. It does not offer a generic full-Activity graph replacement.

### Local backup and isolated restore-drill slice — 13 November 2026

The Rust local stack now has explicit operational evidence for its two
PostgreSQL databases and managed media volume. `scripts/rust-local-backup.sh`
creates a private custom-format dump of each database, copies the managed media
volume, records checksums and records only non-sensitive verification counts.
`scripts/rust-local-restore-drill.sh` refuses incomplete or altered backups,
then restores one only into a newly named temporary Compose project. It applies
forward migrations, restores media, probes the Rust readiness endpoint and
compares the restored principal, subject and media-file counts before removing
only that project on success. A failed drill leaves its uniquely named project
intact for inspection rather than risking the running local stack. The current
proof completed against the disposable local Compose data; this is not a
production backup policy, production restore authorization, or a substitute
for encryption, recovery objectives and named operational ownership.

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
