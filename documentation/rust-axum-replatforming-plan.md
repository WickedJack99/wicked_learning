# Rust/Axum Replatforming Plan

## Active canonical migration completion register

The active goal is complete development/test acceptance of the canonical
frontend against Rust, without production cutover. Historical implementation
entries below are evidence inventories, not proof of route-family completion.
Temporary unavailable controls do not count as migrated behavior. Sequence work
by complete user journeys and backend dependencies, not the retired World
Builder P0 ordering. The canonical source remains pinned to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f` (local `main` verified).

| Route family | Current acceptance status | Next evidence/work required |
| --- | --- | --- |
| Canonical source baseline | Identity verifier available; rerun per slice | Keep the entire copied JS/CSS tree byte-identical; transport changes live outside it. |
| Public/information/authentication | Activated portions; full acceptance not reverified | Reconcile page/command coverage, including verification and recovery, against actual source and real Rust tests. |
| Personal Settings | Activated portions; full acceptance not reverified | Reconcile profile, security, preference and shell tests with all source controls. |
| Learner World and playback | **Incomplete**; whole copied World/layout and player lifecycle evidence, ordinary route entry, completed replay/revisit/arrival check-ins, Companion context/recovery, ordinary output-portal travel, completed ordinary refresh and clean-URL return integrated below | Anonymous and implicit entry, Recall reconciliation, nonordinary entry/continuation/restart, completed nonordinary and finished-portal refreshes, remaining configuration/media and projection bounds; retain observed source usability defects as open acceptance limitations. |
| Learner desk, bookmarks, paths, competence, journal | Pending canonical acceptance | Inventory/reuse Rust contracts, mount complete copied route families, verify cross-route continuation and writes. |
| Topics and platform feedback | Pending canonical acceptance | Source-shaped documents, navigation, submission and failure evidence. |
| Organizations and access links | Pending canonical acceptance | Whole copied membership/redemption flows and permission/error evidence. |
| Platform, asset, localization and support administration | Pending canonical acceptance | Complete each copied panel's document, commands, pagination, media and permission mapping. |
| World Builder and direct editors | Pending canonical acceptance | Complete copied route families through existing Rust authoring contracts after learner/dependency priorities; historical recreated screens are not acceptance evidence. |

### Current World transport and group contract repair

Source checked against pinned `main` before implementation:
`resources/js/pages/world.tsx`, `features/world/{api.ts,group-control.tsx}`,
`components/pagination-controls.tsx`, `hooks/use-platform-translation.ts`,
`features/messages/message-time.ts`, shared `components/ui/{button,input}.tsx`;
the matching controller is `app/Http/Controllers/LearningGroupController.php`,
serializer `app/Learning/Serializers/LearningGroupSerializer.php`, and source
regression evidence `tests/Feature/LearningGroupsTest.php`.

| Source contract | Rust evidence / compatibility seam | Acceptance requirement |
| --- | --- | --- |
| Initial and paginated groups; source camelCase group, member, message and pagination props | `GET /api/v1/learner/groups`; OpenAPI `getLearnerGroups`, `LearnerGroupPage`; `backend/crates/{api,application,persistence}/src/learner_group.rs` | One shared typed mapper for initial reads, subsequent pages and command responses; opaque UUIDs retained for keys/equality/URLs, never fabricated numeric IDs. |
| Send message/help request | `POST /api/v1/learner/groups/{group_id}/messages`; `sendLearnerGroupMessage` | Preserve `body` and `is_help_request`, CSRF, server membership check and returned group; source error keeps unsent text. |
| Resolve another member's help request | `POST /api/v1/learner/groups/{group_id}/messages/{message_id}/resolve`; `resolveLearnerGroupHelpRequest` | Preserve server-derived `canResolve`, author/resolver and timestamps; no client-computed success. |
| Vote for admin access | `POST /api/v1/learner/groups/{group_id}/admin-chat-vote`; `voteForLearnerGroupAdminChatAccess` | Use server vote counts/current-user flag/visibility; preserve source disabled state. |
| Relative and aliased `features/world/api` imports | Existing Vite alias covers only `@/features/world/api`; copied `GroupControl` imports `./api` | Resolve the exact transport module to the platform adapter for both import forms, without editing source files or intercepting arbitrary fetches. |
| Loading and failures | Source `GroupControl` owns pending states, retained page/draft and inline errors | Test pagination and command failures at both viewports; unknown operations remain explicit-unavailable while their own contracts are completed. |

**Verified group transport subworkflow:** `frontend/src/platform/world-groups.ts` maps
initial, paginated and command responses consistently; `world-api.ts` uses the
existing typed Rust operations; the exact-module Vite resolver also handles
relative source imports. No canonical source file, Rust endpoint, schema or
database migration changed. The pre-fix pagination regression failed at both
viewports, then passed with the repair.

`frontend/e2e/canonical-world.spec.ts` covers source group pagination,
message/help/vote responses, UUID/CSRF preservation and failed writes retaining
the draft for 401/403/404/503. Source comparison mounts the whole pinned-main
`GroupControl` with its original relative transport in the test-only
`canonical-world-groups-source` harness. Tests verify those original source
files against the pinned SHA, compare text and panel/control bounds before and
after pagination, and attach source/Rust screenshots at 1440×900 and 390×844.
This is component-level light-appearance evidence; full World/player route
parity remains open. Follow-up inspection traced the live screenshot's dark
panel colors to authored light-variant map configuration; these colors must
be preserved. The separate missing authenticated appearance bootstrap is
covered by the next repair below.

`frontend/e2e/canonical-world-groups-live.spec.ts` uses real local Rust APIs and
PostgreSQL, without response mocks: two members, two paginated groups, message
persistence after refresh, another member's help resolution and majority
voting. It also verifies outsider writes, missing CSRF and self-resolution are
rejected. Only test-created memberships are cleared afterwards. Source-side
pagination coverage and live Rust coverage both exercise the copied UI.

Validation: canonical identity (299 source files plus CSS), frontend production
type/build, generated OpenAPI client drift check, Rust workspace fmt/check,
the focused Rust `learner_group` regression, and 13 browser tests passed.
Browser rerun: start the frontend Vite evidence server on port 8082, serve the
current production build with the local Rust stack on 8081, provision the
disposable sessions using the existing `rust-local-stack.md` procedure, then
run from `frontend/`:
`SOURCE_EVIDENCE_BASE_URL=http://127.0.0.1:8082 PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-world.spec.ts e2e/canonical-world-groups-live.spec.ts --reporter=line,html`.
The ignored `frontend/playwright-report/` retains the screenshot attachments.
The source comparison explicitly requires that evidence server; a skipped
comparison is not parity evidence. Existing unrelated worktree edits remain
outside this slice.

### World bootstrap, empty and dependency state repair

Source evidence: pinned `resources/views/app.blade.php` initializes auth and
the authoritative server appearance before the React tree; copied
`hooks/use-appearance.tsx` and `theme/appearance.ts` own DOM, storage and cookie
updates. `layouts/app/app-sidebar-layout.tsx` normally synchronizes the page's
appearance. The standalone World loader omitted the authenticated bootstrap;
its source layout is also still absent and remains a separate acceptance gap.
The platform adapter must initialize the existing source theme helper from the
successful `/api/v1/me` read before mounting World, without changing a stored
server preference merely by opening the route.

`LearningWorldController::show`, `LoadLearningWorld::forMapView` and copied
`pages/world.tsx` render the source empty view for a signed-in learner with no
visible map. Existing OpenAPI `getLearnerWorld` explicitly defines its 404
`not_found` response as no visible map, matching the Rust repository's `None`.
Reuse this contract; no replacement endpoint is required. Only that contracted
problem response may become the empty view. A malformed/unexpected 404,
authentication/authorization failure or failed companion read must remain
unavailable. Empty props must retain the real current user and real group read,
not a blank subject identifier or fabricated group page.

**Verified:** the new regressions first failed at both viewports on ignored
server appearance and incorrect dependency failure copy. `world-route.tsx`
now uses the successful current-user appearance with the copied initializer
before mounting, maps the failed dependency's actual status, and accepts only
the documented `not_found` response as empty. Empty props retain real subject
and group data. No new Rust contract was needed.

Validation: canonical source identity, production frontend type/build,
generated-client drift check, two focused Rust `learner_world` tests, and 21
browser tests across canonical World, real Rust groups and existing Appearance
Settings passed. The live tests set actual dark/light server preferences at
both viewports and prove reopening World reads them without an appearance
write. The combined HTML report retains source/Rust group comparisons and
live screenshots. This does not complete World shared layout, anonymous
access, location persistence, map/activity identity or playback.

**Next complete integration boundary:** restore the copied shared World layout
(`layouts/app-layout.tsx`, `layouts/app/app-sidebar-layout.tsx`) with its whole
`AppSideActionBar` and `LearnerSurfaceNavigation` trees. Before mounting, map
all consumed authenticated user, inventory/tool, public presentation, menu
theme, Companion, feedback prompt and Journal props/requests to existing Rust
contracts. The current bare World page omits these source controls. The identity/outline dependency described below is now verified. Do not
fabricate the remaining shared-layout props or activate playback before its
complete document and transport contracts are available.

### Verified World identity and activity-outline contract

Pinned-source owners under `resources/js/` are `pages/world.tsx`,
`features/world/active-activity.ts`, `features/world/world-map.tsx`,
`features/world/node-detail-drawer.tsx`, `features/world/activity-panel.tsx`,
`types/learning.ts`, and
`app/Learning/Serializers/LearningNodeSerializer.php`. Source World's completed
badge inspects every activity, its fallback start uses the authored preferred
activity, and `active-activity.ts` persists node/activity/start identities.
The prior adapter's array counters and start-label-as-activity-title projection
cannot preserve those behaviors.

Extended the existing authenticated `/api/v1/learner/world` read with a typed
`graph` identity/outline projection. Reused already scoped map/asset/node reads;
loaded published activity outlines in one additional batched query, with only
the current principal's progress. Anonymous `/public/world` remains unchanged.
Hidden-node activity data, unpublished activities and activity configuration/answers
are excluded. Preferred/start/progress references use UUIDs, including persisted
source continuation links. Playback remains pending until its complete transport
and document contracts are activated.

This dependency precedes full shared-layout activation: the layout's Continue
link reads the same persisted activity record. Shared-layout audit also found
missing learner palette, app-name, menu-theme and feedback-prompt eligibility
projections, plus on-demand Journal/Companion transport mappings. None may be
replaced by invented source props.

| Source contract | Rust evidence / adapter | Verified behavior |
| --- | --- | --- |
| World/map/MapAsset/node identities, `active-activity.ts` persisted URL | `LearnerWorldSnapshot.graph`, `domain/src/learner_state.rs`, `persistence/src/{public_world,learner_world}.rs`; `frontend/src/platform/world-projection.ts` | Real UUIDs survive map reordering, source keys and navigation. No numeric stand-ins. |
| All published node activities, actual title, completed badge | `LearnerWorldActivityOutline`, batched `load_graph` query, principal-scoped progress join | Non-start activities included, multiple starts do not duplicate activities, identical slugs in different maps cannot share completion. No activity configuration/answers exposed. |
| Authored preferred start and route starts | `start_activity_id`, `LearnerWorldStartIdentity`; existing start-summary fields retained | Invalid/portal-input preferred starts excluded. Hidden nodes have no outlines/starts; locked nodes retain readable outlines while source disables starting. |
| Private route continuation summary | Own `learner_route_progress` joined by principal and start UUID; `current_activity_id` and `play_run_id` | Route progress preserves real references; current activity must still be in the published node outline. Playback must independently authorize every command. |
| Incomplete/oversized read | Existing World unavailable boundary; graph-wide 10000-outline limit checked with LIMIT 10001 | An incomplete identity mapping or oversized graph fails explicitly, never fabricates IDs or silently truncates badges. |

Evidence: `frontend/e2e/canonical-world.spec.ts` covers persisted URLs/titles,
non-start completion, preferred starts, missing identities, reordered maps,
repeated slugs and duplicate buttons. Six pre-fix checks failed against the
previous build at both viewports. The independent original-page harness
`canonical-world-source.{html,tsx}` verifies pinned source bytes and compares
selected-place text, bounds, screenshots and source numeric continuation at
1440×900 and 390×844. This is World page evidence, not shared-layout acceptance.
`canonical-world-identity-live.spec.ts` uses real Rust responses, cross-checks
activity IDs/titles against the author read, verifies the anonymous response
remains unchanged and drives source continuation with the real UUIDs. It
attaches request duration/payload-size measurements: the local seed returned
143 outlines across two maps in a 33866-byte response, measured at 11–13 ms
in the two browser runs. These are local observations, not a production SLA.
Existing live group coverage remains passing. The source and Rust selected-place
screenshots were byte-identical at both required viewports.

Rust's `preferred_start_requires_an_eligible_published_outline` covers preferred
eligibility. `graph_outlines_preserve_identity_publication_visibility_and_private_progress`
ran against the migrated local PostgreSQL using connection-local temporary
copies of actual tables: available/locked/hidden nodes, draft exclusion,
non-start outlines, repeated slugs, another learner's completion and answer
non-disclosure. It performs no writes to application rows. Rerun with
`TEST_APPLICATION_DATABASE_URL` set to the local test database and
`cargo test -p wicked-learning-persistence graph_outlines -- --ignored` from
`backend/`. Regular focused workspace tests cover the authenticated route.

Validation: canonical identity, frontend production type/build, generated
OpenAPI client drift, Rust fmt/check and focused tests, the explicit PostgreSQL
regression, and 26 passing checks in the combined canonical World/identity/group
browser suite.
Use the earlier source-server setup and run all three `canonical-world*.spec.ts`
files named above with the HTML reporter to retain comparison screenshots.
No canonical source, migrations, production data or traffic ownership changed.

### Copied learner shell contract register

This is a shared learner-navigation dependency, not World Builder priority.
The owning source tree is `resources/js/layouts/{app-layout.tsx,app/app-sidebar-layout.tsx}`,
`components/{app-side-action-bar,learner-surface-navigation,learner-navigation-header,learner-account-controls,user-menu-content,platform-feedback-prompt}.tsx`,
`features/{items/item-inventory,tools/tool-selection,tools/tool-cursor-overlay}`,
`features/journal/{journal-overlay.tsx,journal-client.ts,theme.ts}` and
`features/world/learning-companion-{panel,dialogue}.tsx`. Preserve those whole
copied modules. Source shared props come from
`app/Http/Middleware/HandleInertiaRequests.php`.

| Required source behavior | Existing Rust evidence | Concrete remaining contract / adapter |
| --- | --- | --- |
| Account name/avatar, media permission, appearance and logout | `/me`, `/session/logout`, `frontend/src/platform/{welcome-inertia,welcome-routes}` and existing Settings account mapping | Connected by `learner-shell-projection.ts` and the existing typed logout. Failed logout retains the session/page with an explicit error; successful logout reloads Welcome, clearing private JavaScript state. |
| `auth.items` and `auth.tools`, grant deduplication, tool selection | `/learner/world` inventory; domain `LearnerItem`/`LearnerTool`; source `Learning{Item,Tool}Serializer.php` | Real UUIDs now travel in World/shell holdings and existing tool-grant/playback/obstacle responses. Owned-item/tool media delivery and URL projection are implemented below; the complete source controls now mount through the shared-layout adapter. The copied item-grant transport now refreshes the real complete shell inventory; verified grant integration is recorded below. |
| `name`, learner palette, branding and cursors | `PublicPresentation`, `persistence/src/public_presentation.rs`; source `theme/presentation.ts` | Branding/cursors reused. `/learner/shell` now supplies deployment `APPLICATION_NAME` and typed learner palette with pinned-source defaults. `toSourceLearnerPresentation` maps every learner palette field into the copied layout. |
| `menuTheme` remembers the learner's preferred visible map | Source `app/Learning/Queries/LoadCurrentMenuMapTheme.php`, `Services/LearnerMapLocationService.php`; Rust visible World maps | Private preferred-map persistence and visibility revalidation now exist in `/learner/map-location` and `/learner/shell`. Managed menu-background URLs now use the existing learner media route. World bootstrap now mirrors source preferred-map redirect and explicit-map persistence before claiming feedback. |
| Journal initial theme without loading private notes | `persistence/src/learner_journal.rs`, table `application_journal_feedback_policy`, domain default theme | The shell now reuses the existing theme/policy read without loading journal content. The source page-prop adapter now supplies that real theme. |
| On-demand complete Journal overlay | `/learner/journal`, `/learner/journal/pages`, page update/delete/feedback request, `/learner/journal/export`; `features/journal/journal-client.ts` | Reuse existing writes, owner scope, search, pagination and theme. `LearnerJournalLearningContext` now carries actual node/activity IDs and published topic context; check-ins/revisits carry actual activity/node IDs. The typed copied-client seam and source-derived/live Journal checks below cover these operations and context links; the complete overlay now opens from the copied header. |
| Companion visibility, context, authored dialogue and AI turn | `/learner/companion`, `/learner/companion/turn`; `domain/src/learning_companion.rs` | All source fields, 204 absence and the exact-module native turn seam are verified below; World now loads the selected-map Companion before mounting the copied layout. |
| Feedback invitation once per authenticated session | Source `app/Settings/Services/PlatformFeedbackPrompt.php`; Rust `/learner/feedback-prompt-preference` | Native Rust session claim now exists as CSRF-protected `POST /learner/feedback-prompt/claim`, honoring enable/decline/14-day snooze and Settings/Feedback exclusions. World now claims once after successful required projections/location persistence; preferred-map redirects do not consume an invitation. The shell GET remains read-only. |
| Feedback dismiss, decline and failure recovery | Existing Rust preference PATCH; source `components/platform-feedback-prompt.tsx` | The verified narrow preference adapter below supports dismiss/decline and source `onError`/`onFinish`, restoring invitations after failed writes. |

The dependency order above is implemented through whole-layout World mounting.
Destination route families may retain honest unavailable states, but controls
within this activated shell cannot be marked complete while their operations
are absent. A failed required shell projection keeps the route unavailable;
never hide missing controls by supplying empty data. The next World work is
its remaining commands and cross-route journeys, not another reconstructed
layout or World Builder priority.

### Shared learner shell metadata and session contracts

This backend dependency slice does **not** mount or declare acceptance of the
copied layout. Source remains pinned and unchanged. Additional source owners
verified for this slice are `app/Models/PlatformPresentationSetting.php`,
`app/Learning/Serializers/Learning{Item,Tool}Serializer.php`,
`app/Learning/Queries/LoadCurrentMenuMapTheme.php`,
`app/Learning/Services/LearnerMapLocationService.php`, and
`app/Settings/Services/PlatformFeedbackPrompt.php`.

| Required data or operation | Implemented Rust contract and evidence | Remaining activation boundary |
| --- | --- | --- |
| Application name, learner colors, inventory identities, Journal theme, menu background | `GET /api/v1/learner/shell`; `crates/{domain,application,persistence,api}/src/learner_shell.rs`; OpenAPI `LearnerShell`; shared inventory/theme queries | Map all source props together when Journal, Companion and media dependencies are complete. A required read failure must keep the route unavailable. |
| Preferred map across visits | `POST /api/v1/learner/map-location`, `RememberLearnerMapRequest`; migration `0106_learner_map_location.sql` | Source URL navigation must call the command and retain selection on reload. Actual map UUID is private to the principal; reads revalidate publication/roles and fall back to the first visible map. |
| Session feedback invitation | `POST /api/v1/learner/feedback-prompt/claim`; `api/src/feedback_prompt_preference.rs`; native subject-scoped session flag | Invoke only through the documented adapter. Existing preference PATCH clears the flag after enable/dismiss/decline; source dismiss/error callbacks still need wiring. |
| Owned visuals and tool animation | Real inventory IDs now available in domain `LearnerItem`/`LearnerTool` and all constructing repositories | `api/src/learner_media_assets.rs` now also authorizes active owned-inventory references; the follow-up below records its verification. Source control activation remains pending. |

The shell performs two bounded inventory queries and one preferred-map query,
without fetching the World graph or private Journal pages. More than 100 items
or tools fails explicitly instead of silently presenting a truncated inventory.
The empty-World shell still returns the principal's holdings. `APPLICATION_NAME`
is deployment configuration (default from the source example: `Learning Worlds`).
`PublicPresentation.learner_palette` uses the exact source dark/light defaults
for older stored documents and validates bounded colors and opacity on writes.

Verification exposed two inherited runtime problems: duplicate application
migration version 0067 and a SQL query-count tracing layer that suppressed
unrelated error events. The already-applied organization migration remains
0067 with unchanged bytes; the unapplied settings-palette migration is moved
unchanged to 0107. Its conditional update preserves existing configured palettes.
Normal local migration applied 0106 and 0107 successfully; no migration ledger
or checksum was bypassed. Regression tests enforce unique embedded versions and
prove that application error events reach the other tracing layers.

`canonical-learner-shell-contract.spec.ts` exercises the actual Rust API,
PostgreSQL and native sessions: guest rejection, private map preferences,
slug/UUID selection, draft/missing/invalid maps, forged principal fields, CSRF,
read-only shell requests, one invitation per session and snooze/decline/enable.
The isolated PostgreSQL regression
`shell_preserves_owned_inventory_and_revalidates_preferred_map_access` also
proves owned IDs, empty World inventory, rename continuity, access revocation,
other-principal isolation and explicit overflow. Its connection-local temporary
tables leave application data untouched. Run it with the local
`TEST_APPLICATION_DATABASE_URL` and `cargo test -p wicked-learning-persistence
shell_preserves_owned -- --ignored`; the existing `graph_outlines` database
regression also passes after inventory-query reuse.

Validation: 299 copied source files plus CSS remain byte-identical; frontend
production type/build and generated OpenAPI drift checks pass. Focused Rust
shell, World, inventory/playback, presentation, feedback, configuration,
migration and observability tests pass, as do workspace check/fmt and both
explicit PostgreSQL regressions. The combined World source/live and shell
contract suite passed 27 checks; existing source comparison screenshots at
1440×900 and 390×844 remain in the local HTML report. These screenshots prove
no World page regression, not acceptance of the still-unmounted shared layout.

### Owned learner inventory media dependency

Pinned-source owners are the complete
`resources/js/features/items/item-inventory.ts`,
`features/tools/{tool-selection.ts,tool-visuals.ts,tool-cursor-overlay.tsx}`,
`components/app-side-action-bar.tsx`, and the Item/Tool serializers listed above.
Those serializers and `HandleInertiaRequests.php` expose held inventory,
including light/dark images and tool animations. This dependency preserves
those fields without altering any copied component.

The existing `/api/v1/learner/media-assets/{asset_id}/content` now additionally
admits an active `learning_item` media reference with the current principal's
positive quantity, or an active `learning_tool` reference with that principal's
tool holding. Anonymous visitors and other learners gain no access from a
catalog or media UUID. Existing published-content and Journal authorization
remain independent valid access paths. No unrestricted catalog-preview route
was introduced. The administrative catalog already synchronizes those media
references transactionally; it is reused unchanged.

`persistence/src/learner_media.rs` supplies shared item/tool projections for
World/shell holdings, item-obstacle inventory, tool-grant/NPC grant results and
playback held tools. It preserves real IDs, quantities, null fallback fields,
custom paths and authored sizing/timing; only recognized managed URLs change.
The shell's preferred-map background uses the same existing recursive media
URL mapping. Unowned tool/item discovery previews still require a separately
audited active-playback contract; inventory access must not expose all catalog
visuals to satisfy that future flow.

`canonical-learner-inventory-media.spec.ts` first reproduced 404 for both owners,
then exercises real uploaded bytes, admin catalog reference synchronization,
owner/peer/guest reads, World and shell projections, replacement under the same
media identity, zero item quantity, revoked tools, and removed references.
Its holdings fixture is explicitly restricted to the local Compose stack and
uses only test-created UUIDs, with cleanup; it does not claim playback-grant
acceptance. Rust projection tests cover null/custom-path fallbacks, retained
identity and visual configuration, and preferred-map theme projection.

Validation: canonical source identity, production frontend type/build, generated
OpenAPI drift, workspace Rust check/fmt and affected learner/media tests passed.
The shell PostgreSQL regression passed, and the combined source/live World,
shell and media suite passed 29 checks. Desktop/narrow World comparison evidence
remains valid; no new inventory UI parity claim is made before layout activation.

### Journal context contract dependency

Before adapting the copied overlay, inspect pinned
`app/Http/Controllers/LearnerJournalController.php`,
`app/Learning/Serializers/LearnerJournalSerializer.php`, and queries
`LoadLearner{Journal,ActivityCheckIns,RevisitInvitations}.php` together with the
complete `resources/js/features/journal/{journal-client.ts,journal-overlay.tsx}`.
Reuse Rust's owned page CRUD/feedback/export and paginated reads.

| Source requirement | Current evidence | Required bounded change |
| --- | --- | --- |
| Journal page activity/node destination and published map topic | `LearnerJournalLearningContext`, `persistence/src/learner_journal{,_page}.rs` retain only titles/slugs | Real node/activity UUIDs and optional published topic now travel in both list and write responses. The source adapter must preserve source `/learning/nodes/{id}/play?activity_id=...` destinations, not infer identities from titles. |
| Check-in activity destinations and revisit actions | `LearnerJournalCheckIn` and `LearnerRevisitInvitation` have slugs and private check-in UUIDs | Actual activity/node identities are returned alongside private check-in IDs. The adapter must retain that association for existing Rust revisit commands; these IDs are not interchangeable. |
| Private context and source page caching | Copied `journal-client.ts` owns cache/update lifecycle | Map the specific World transport calls to typed Rust operations while retaining that whole source module. A failed request rejects; do not cache fabricated empty payloads. |

Implementation reuses the existing queries and page-write response loader; no
new endpoint, table or per-page query was added. Published topic context reuses
`LearnerPathTopic`. A deleted route start resolves through the activity's real,
unique MapAsset/node relationship; a missing node yields null context while
preserving private page text. Existing map admission still controls check-in
and revisit visibility. Read identities never authorize a playback run.

The explicit PostgreSQL regression `journal_context_retains_real_destinations_and_private_scope`
uses connection-local temporary tables and verifies list/write consistency,
real node/activity/check-in identities, unpublished-topic omission, deleted
start/node behavior, other-principal isolation and revoked map access. Run it
with the local `TEST_APPLICATION_DATABASE_URL` and
`cargo test -p wicked-learning-persistence journal_context_retains -- --ignored`.
`canonical-journal-context-contract.spec.ts` first failed against the old HTTP
response's missing IDs. It exercises actual Rust page creation/list/update,
wrong-user/CSRF rejection and private Markdown export with a test-owned
reflection fixture. It records response duration and bytes. Fixture cleanup
uses the existing page-delete endpoint and does not alter authored seed content.

No Journal UI activation or acceptance is claimed by this backend dependency.
The next adapter must retain the copied `journal-client.ts` cache/state code,
map specific CRUD/feedback/revisit calls, preserve export navigation, and prove
source controls and failure recovery as part of the complete shared layout.

Frontend source identity, production type/build and generated-client drift checks
pass. Focused Rust Journal/revisit/desk tests, workspace check/fmt and the
explicit PostgreSQL regression pass. The live HTTP contract test passes against
the rebuilt local Rust service; this is backend evidence, not a substitute for
the pending whole-overlay browser acceptance.
The final combined source/live World, shell, inventory-media and Journal
contract run passed 30 checks, retaining desktop/narrow screenshots and request
measurements in `frontend/playwright-report/`.

### Shared learner layout adapter contract

Activation uses the whole copied `layouts/app-layout.tsx` and its sidebar,
account/navigation, Journal, inventory, tool and Companion trees listed above.
No canonical module is edited. Journal keeps the whole `journal-client.ts`;
only its existing `world/api` transport resolves to explicit typed Rust calls.
The copied export anchor keeps `/learning/journal/export`; the platform serves
an exact redirect to the audited Rust download endpoint. Companion's single
module-local fetch must be bound to a dedicated typed adapter at build time; no
global fetch interception or substitute dialogue component is permitted.

Journal saves also send `request_expert_access` (see pinned
`app/Learning/Actions/UpdateLearnerJournalPage.php`). Rust now accepts the
bounded boolean and checks the existing policy atomically on create/update.
Source feedback dismiss/decline now calls `onError` on rejected writes and
preserves local overlay state on success. All required shell reads must succeed;
Companion's documented 204 maps to absence, not fabricated empty dialogue.
The 200 Companion response proves enabled state. Source IDs retain real UUIDs.

### Verified Journal transport dependency (before whole-layout integration)

The whole copied `features/journal/{journal-overlay.tsx,journal-client.ts,theme.ts}`
remains unchanged. Its existing `features/world/api.ts` seam now reaches
`frontend/src/platform/{journal-api.ts,journal-projection.ts,world-api.ts}`.
Source serialization owners are `LearnerJournalSerializer`,
`LoadLearnerActivityCheckIns`, `LoadLearnerRevisitInvitations`, and
`CreateLearnerJournalPage`/`UpdateLearnerJournalPage` under `app/Learning/`.
Shared UI dependencies remain copied whole: `LearnerPaginatedItems`,
`PaginationControls`, Input/Button, MarkdownRenderer, appearance/translation
hooks and competence links. No route or substitute Journal presentation was
added. Full shared-layout activation is still incomplete.

| Source operation / data | Rust contract / adapter | Verification |
| --- | --- | --- |
| GET `/learning/journal`, page/per_page/search, abort | GET `/api/v1/learner/journal`; explicit camelCase projection for pages, contexts, domains, theme, check-ins, invitations and pagination | Independent original client/transport comparison; pagination/search; closing aborts the native request. Shared API fetch now retains `Request.signal` when combining it with the timeout. |
| Create, save and delete pages | Existing POST/PATCH/DELETE `/learner/journal/pages[/{page_id}]`; native CSRF; `deleted_page_id` → `deletedPageId` | Whole copied overlay against real Rust at both viewports; refresh persistence, search and cleanup; private-owner API test. |
| `request_expert_access` on create/save | Optional boolean in OpenAPI/API draft; SQL gates consent against `application_journal_feedback_policy.allow_review_requests` | Temporary-table database regression covers missing/disabled/enabled policy, withdrawal, create/update, and rejected other-owner write; real HTTP read/write verifies the response. |
| Feedback request and returned page | POST `/learner/journal/pages/{page_id}/feedback-request`, exact `domain_key`; returned request timestamps/domain/status | Copied client preserves successful cache replacement; typed adapter carries native CSRF and server response. Existing Rust authorization remains authoritative. |
| Activity-named revisit action | POST `/learner/revisit-invitations/{check_in_id}` | Only the latest authorized Journal read maps real activity UUID to its private check-in UUID. Failed writes retain the invitation; successful writes remove it; missing/stale association rejects with 409. |
| Context links and export anchor | Actual node/activity UUIDs with source `/learning/nodes/{node}/play?activity_id=…`, topic URL and World map/focus query; exact `/learning/journal/export` redirect to Rust download | Source/Rust context links compared; no invented IDs. Nginx and Vite retain the copied download URL; Rust authorizes content. Destination route activation remains separate. |

`frontend/e2e/canonical-journal.spec.ts` mounts the complete original and
canonical overlays in a test-only harness. `journal-vite.config.ts` directs
only the **original** client's imports to its original Laravel-shaped
transport; the canonical side uses the typed Rust client. The harness serves
root public assets. Source and canonical files are checked against the pinned
Git blob before comparing text, control/editor bounds and screenshots at
1440×900 and 390×844. The local live component test bridges its evidence-server
Origin to the local deployment for native CSRF; it does not mock API responses.
This is component integration evidence, not production shared-layout acceptance.

**Observed source limitations, preserved rather than silently fixed:** at
390×844, the context/review sections displace the editor below the clipped
panel. The same bounds occur in the original. Initial read failure leaves the
source loading skeleton and disabled create control; it does not display an
error message. Save failure retains the draft and the source retry message.
These observations must remain visible at full-route acceptance; they are not
proof that all source controls are usable or a new blanket defect waiver.

Verification: canonical identity and frontend production types/build; Rust
workspace fmt/check, six Journal application tests, authenticated export API
test, isolated PostgreSQL consent/context regression, generated OpenAPI client,
and eight Journal browser/API checks passed. The 24 affected World/group
checks also passed. The production-style container build passed; the download
regression caught Nginx dropping the external port, then passed after the exact
location used a relative redirect. Docker excludes local browser sessions and
generated reports from its build context. Rerun the browser evidence by
starting `npm run dev -- --host 127.0.0.1 --port 8083 --strictPort --config
e2e/journal-vite.config.ts` from `frontend/`, then use
`JOURNAL_EVIDENCE_BASE_URL=http://localhost:8083 PLAYWRIGHT_HTML_OPEN=never
PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report/journal npx playwright test
e2e/canonical-journal.spec.ts e2e/canonical-journal-context-contract.spec.ts
--output=test-results/journal --reporter=line,html`. Without the explicit
server variable the component checks skip and do not constitute acceptance.

**Container identity gate repair:** the existing Dockerfile called the local
Git-dependent verifier inside an image without Git/history and failed with
`spawnSync git ENOENT`. `scripts/canonical-source-manifest.json` records SHA-256
for every pinned source file. Normal verification proves this manifest against
Git and then checks copied bytes/file set. Docker explicitly uses manifest mode
before generating the API client, type checking and building; it never skips
identity checks or copies Git history. The Node regression executes without Git
and rejects altered, missing and extra source files.

### Verified shared feedback invitation transport

Pinned `resources/js/components/platform-feedback-prompt.tsx` sends
`dismiss`/`decline` to `/settings/feedback-prompt` with `preserveState`,
`onError` and `onFinish`. The prior platform facade rejected `dismiss`, ignored
failure callbacks and reloaded the whole learner page on successful writes.
The source-derived pre-fix browser regression proved the dismiss request never
reached Rust.

`frontend/src/platform/welcome-inertia.tsx` now maps those exact actions to
PATCH `/api/v1/learner/feedback-prompt-preference`, reusing the existing
`feedback_prompt_preference.rs` API/application/persistence contract and native
CSRF. HTTP or token/network failures call the copied control's `onError`,
restoring its prompt; `onFinish` releases its pending state. A successful
invitation write honors the source `preserveState` request. Existing language,
sound and Settings preference writes retain their page-prop refresh behavior.
No generic Inertia transport or new Rust contract was introduced.

`frontend/e2e/canonical-feedback-prompt.spec.ts` mounts the whole copied control
at 1440×900 and 390×844 using the same evidence server as Journal. It checks
pinned source bytes, bounded prompt controls, failed write/token recovery and
retained local page state. Real Rust tests obtain the actual session claim,
snooze/decline through the copied buttons and confirm the next server claim
stays false. Test-owned preferences are re-enabled during cleanup. This is a
shared-layout dependency, not completed World/header activation. Full layout
visual evidence and Companion transport/media are still outstanding.

Validation: four feedback browser checks (including two real Rust-backed runs),
four canonical Language regression checks, source identity, frontend types/build,
generated-client drift, Rust formatting and the source-action parser test passed.

### Companion media contract required before shared-layout activation

Pinned owners: `features/world/learning-companion-{panel,dialogue}.tsx`,
`components/learning-companion-avatar.tsx`, `types/index.ts`,
`app/Learning/Services/LearningCompanion{Context,ConfigurationResolver}.php`,
and `app/Http/Controllers/Settings/AdminCompanionController.php`.
The source renders the resolved avatar and retains authored cropping/scale.
Existing GET `/learner/companion` scopes context and inherits configuration, but
returns an administrator media URL. The real API regression reproduces that
learner-inaccessible URL. Platform settings writes also omit media references.

Required bounded repair: managed avatars receive
`/api/v1/learner/companion/avatar/{asset_id}` with the same validated surface and
map/activity query. Delivery must resolve the current enabled Companion scope
again and match the selected asset UUID before reading bytes; guests, unknown
assets, unavailable scopes and stale replaced/cleared selections cannot use it.
Static/external authored URLs remain unchanged. Reuse media response headers
and storage; do not widen generic media-library access. Platform avatar saves
must synchronize their one managed reference transactionally so replacement,
usage reporting and deletion retain the selected media relationship. This
contract adds no UI and does not activate Companion or the complete layout.

**Verified media dependency:** the existing Companion API now projects the
scoped avatar URL and the new endpoint reuses the same configuration resolver
before serving bytes through the hardened learner-media response. Platform
settings changes synchronize the `companion_presentation` reference in the
same transaction. Migration `0108_companion_avatar_reference.sql` backfills
existing selections; the normal migrator applied it to the local application
database and its recorded status is successful.

`frontend/e2e/canonical-companion-media.spec.ts` first failed on the administrator
URL, then passed against the updated Rust runtime. It verifies bytes, sandbox
headers, anonymous/unknown-asset/unavailable-scope rejection, referenced-asset
delete protection, content replacement, disabled/cleared selection revocation,
and unchanged static URLs. Only a test-uploaded image is deleted, and the
original platform settings are restored. Existing real item/tool media tests
also passed after sharing their response helper. The isolated PostgreSQL test
covers World inheritance, map-role denial, map/World unpublication, explicit
avatar clearing and idempotent reference backfill. Four existing Companion
resolver tests and the API guest-authentication regression passed, as did
frontend source identity/type/build, Rust workspace check/fmt and OpenAPI
client generation. This is backend/media evidence; complete copied Companion
browser and full-layout acceptance are still pending.

### Copied Companion transport contract

Pinned source owners are the whole
`features/world/learning-companion-{panel,dialogue}.tsx`,
`components/learning-companion-avatar.tsx`, `types/learning.ts`,
`hooks/use-platform-translation.ts` and `lib/json-response.ts`.
Turn behavior comes from `app/Http/Controllers/LearningCompanionController.php`,
`app/Http/Requests/LearningCompanionTurnRequest.php` and
`app/Learning/Services/LearningCompanion{Context,TurnService}.php` at the pinned
SHA. No canonical component is edited or replaced.

| Source requirement | Rust evidence and adapter rule |
| --- | --- |
| Enabled/absent Companion, full resolved appearance and context | `GET /learner/companion` returns a scoped document or 204; `companion-api.ts` maps every field, retains UUIDs, and maps 204 to null. Other read failures remain errors. |
| Whole message/choice/AI/end graph, Back/Restart/history | Reuse `parse_dialogue_graph` in `application/src/admin_learning_companion_dialogue.rs`. OpenAPI now names normalized node/choice/position fields; authored input normalization remains separate. Local interaction state stays in copied components. |
| One direct source turn request | A fail-closed Vite transform binds only the exact fetch call in the exact copied dialogue module to `companionFetch(companion, …)`. A WeakMap retains that projected object's real authorized query without injecting props or a mutable global current-map. No generic fetch interception. |
| Map/node/activity/run identities | Compare every source context ID against the read document; map its retained real map slug to the native request. Rust rechecks scope, ownership and capabilities. Unknown objects, altered IDs and unknown authored nodes cannot send turns. |
| Assistance, disclosure, provider failure and retry | Existing CSRF-protected `POST /learner/companion/turn`; preserve native reply and source assistance event. Map problem titles to source errors with actual HTTP status. AI Off remains source-local. No private learner text is introduced. |
| Action URLs and avatar cropping | Preserve server action URLs and copied Link/avatar components; managed-avatar authorization is verified above. Unactivated destinations remain unavailable. |

**Verified transport dependency:** `canonical-companion.spec.ts` mounts the
whole pinned original panel/dialogue separately from the copied Rust-bound
modules. Desktop and narrow checks compare exact text, panel geometry, action
URLs and avatar crop styles, and attach source/Rust screenshots. They exercise
message/choice/end traversal, Back/Restart, Escape/focus return, local No AI,
rejected and retried native turns, disclosure and post-attempt assistance
events with opaque map/node/activity/run UUIDs. A separate negative check
rejects unknown projection objects, changed map IDs, unknown graph nodes and
extra private-response fields before any request, and proves interleaved
contexts retain their respective map slugs. 204 absence and read failure are
distinct states.

The real Rust browser cases temporarily create their own map-assigned dialogue,
load it using an existing learner session, follow the copied controls and
receive the native 422 provider-unavailable result without fabricating a reply.
They delete only their own dialogue and restore the prior platform settings.
The test-only evidence server proxies native API traffic with the local
deployment Origin; normal Rust cookie/CSRF verification remains active.
Evidence is under `frontend/playwright-report/companion-verified` and
`companion-attribution`. Rust graph normalization and source turn/authentication
checks, workspace check/fmt and canonical frontend identity/type/build pass.

**Observed inherited source defect:** on the 390×844 viewport, the expanded AI
assistance panel extends above the viewport and clips its heading/close control.
The original and canonical screenshots and geometry agree. This is preserved
source behavior, not a newly approved usability waiver; full usability
acceptance must retain that distinction. The normal message panel is bounded.
No AI is also a resolved local turn: the source hides assistance choices until a
new component mount, and Restart retains resolved AI state. Tests preserve this
behavior instead of inventing a different retry flow.

The Companion transport dependency is verified. Its integration into the whole
copied learner layout is recorded next; remaining World operations and inherited
source defects still prevent complete route-family acceptance.


### Whole copied learner layout mounted around World

Source remains byte-identical to `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`.
The original `resources/js/app.tsx` assigns World the complete
`layouts/app-layout.tsx` → `layouts/app/app-sidebar-layout.tsx` tree. The Rust
resolver now does the same through `world-route.tsx`, using all named source
header, account, inventory/tool, Journal, Companion and feedback components
from the shell register above, including `components/user-info.tsx`. No
presentation fragments or substitute layout were introduced.

`frontend/src/platform/learner-shell-projection.ts` maps the existing typed
`GET /learner/shell` and `/me` documents: complete account identity, real item
and tool UUIDs/configuration/media, deployment name, Journal theme, learner
palette, branding/cursors and menu theme. `welcome-projection.ts` shares its
existing public-presentation conversion without changing Welcome's output.
World retains its independently verified graph/group/translation/sound
projections. Missing or malformed required data renders explicit unavailable;
source props are constructed before any invitation claim.

Source `LearningWorldController::show/syncMapLocation` and
`LearnerMapLocationService` govern the navigation seam. An omitted map query
restores a different visible preferred map using a replacement navigation,
preserving other query parameters and the hash. Explicit valid slug/UUID
references use native `POST /learner/map-location`; explicit unknown references
retain the source first-map fallback. The native response supplies the actual
menu theme. The selected initial map scopes `/learner/companion`; local source
map transitions retain the original source lifecycle. `POST
/learner/feedback-prompt/claim` runs only after required reads and location
writes succeed. Route-key remounting refreshes bootstrap on actual Router
navigation, without replacing the source's local state/history operations.

`canonical-learner-layout.spec.ts` exercises the real local Rust stack at
1440×900 and 390×844: header/navigation bounds, real inventory/tools, whole
Journal opening/closing and focus return, account controls, preferred-map
redirect/reload and zero claims on required dependency failures (including a
malformed shell). Its independent shell prop oracle mounts the whole pinned
original World/layout dependency tree in
`canonical-learner-layout-source.tsx`; `learner-layout-vite.config.ts` keeps
original presentation imports on original files. It compares shell styles,
control text/URLs/bounds and inventory geometry and retains screenshots. The
source JS/CSS tree is checked against the pin before comparisons. Layout and
inventory source/Rust screenshots match at both sizes.

`canonical-world.spec.ts` now compares selected-place and group-panel states
inside that full original layout. An isolated GroupControl harness is not a
valid oracle for the full page's panel placement. Component fixtures explicitly
stub their own World identities; `canonical-shell-fixture.ts` takes only real
local presentation/theme data. Separate live tests exercise unmocked holdings
and PostgreSQL. No fixtures are used by production adapters.

**Observed inherited source defects:** at 390px the fixed learner header covers
part of the current-map heading and the selected-place bookmark button. Source
and copied-route evidence agree, including hit testing that identifies the
header above the bookmark. The complete fixed-header layout also places the
fresh-session feedback invitation partly above the viewport, clipping its Close
control and overlapping account controls. Whole original and Rust screenshots
and bounds match for that invitation at both sizes; component-only invitation
tests did not expose this containing-layout issue. A normal page reload removes
the already-claimed session invitation and permits the independent logout test.
The tests record these obstructions instead of forcing clicks or claiming
usability. The previously observed narrow Journal and
Companion defects remain open. Only the previously authorized Welcome clipping
has a user-approved waiver; these additional findings are not implied waivers.

Validation/evidence: canonical identity, frontend production type/build and
OpenAPI client drift checks pass. Focused Rust shell/auth/location tests and
workspace fmt/check pass without backend changes. The combined browser run has
56 passing World/group/identity/Welcome/Journal/feedback/Companion/layout checks.
The final built-container run passes all four layout checks, including original
source comparisons; the isolated native-session logout check also passes.
It verifies that a failed logout preserves the page/session, retry revokes that
session, Welcome becomes anonymous, and a different existing session remains
valid. Fresh-login setup exposed a native 429 after an expired rate-limit window;
the separate verified authentication repair below closes that reproduced
issue. It was not a logout failure. No credential-bearing traces are retained.
Reports are retained under `frontend/playwright-report/learner-layout-verified`,
`learner-layout-final`, `learner-layout-container` and `learner-logout-container`.
The two built-container ready measurements were 910 ms and 924 ms (local seeded
stack, one observation per viewport; not a production performance claim). The local frontend image
is rebuilt and served through its normal Nginx/Rust origin for container checks.
Source evidence remains at the separate test-only original-source Vite server.

This completes the whole-layout integration slice, not the World route family.
Search, bookmarks, tools applied to places, route lifecycle/playback, anonymous
access and other rows in the active completion register remain incomplete.


### World search transport and source-state verification

Pinned source owners: `resources/js/pages/world.tsx`,
`features/world/{world-search.tsx,api.ts}`, `types/learning-search.ts`,
`components/pagination-controls.tsx`, `components/ui/{button,input}.tsx` and
`hooks/use-platform-translation.ts`, within the complete copied learner layout.
Source server behavior is `LearningWorldController::search` and
`app/Learning/Queries/SearchLearningWorld.php`. No copied presentation edits
are permitted for this slice.

| Source requirement | Current Rust evidence | Verified change / evidence |
| --- | --- | --- |
| Discriminated topic/map/node results; real map/node identities | `GET /api/v1/learner/search`; `LearnerDeskSearchResult`; `persistence/src/learner_desk_search.rs` | The bounded reader now exposes nullable `map_id`/`node_id`, including the node's parent map UUID. `world-search-projection.ts` maps exact result variants and removes zero placeholders; topics receive no invented map/node props. Incomplete required identities reject explicitly. |
| Visible published content, category order, pagination, literal search | Existing application request bounds and persistence filters/count/category windows | Existing filters and category windows are retained. An isolated PostgreSQL regression proves real identities, restricted/hidden/empty-space exclusion, locked labels and cross-category pagination. At most three counts plus three bounded result queries remain; no per-result reads were added. |
| Debounced search and stale-request cancellation | Source owns 180 ms debounce and AbortController | The adapter now forwards the original signal. The pre-cancelled regression makes no request, rejects with AbortError and emits no unavailable alert. |
| Loading, empty results and API failure | Complete copied `WorldSearch`; source catches failures and clears results | The copied component retains its loading/empty transitions. Transport and malformed-contract failures reject and use the existing World operation alert; successful retry clears only the matching search alert. No empty success document is fabricated. |
| Local map/place focus and topic destination | Source `goToSearchResult` and exact source URLs | Source map/place selection retains UUID equality, slugs and query/history behavior. Source comparison and native Rust tests pass at both viewports. Topic URL/navigation is preserved; its destination remains explicitly unavailable until its own route family is activated. |


The new browser contract regressions failed before the repair on fabricated
identity fields and ignored cancellation; the PostgreSQL regression failed on
the missing map identity. All now pass. OpenAPI and its generated TypeScript
client include the nullable UUID fields. A separate regression found the
existing search-destination regex rejected literal `?` in source World URLs;
the bounded pattern now uses `[?]` and accepts source map/place destinations
while rejecting external URLs.

`canonical-world.spec.ts` compares the whole pinned original World/layout tree
with the copied route for search loading, result/control bounds, pagination,
empty results, failed transport and recovery, local map/place focus and topic
navigation. Fixtures supply the actual local deployment name to both trees.
The original uses its source HTTP helper; the copied tree uses the typed Rust
adapter. `canonical-world-search.spec.ts` covers exact result variants, opaque
identities, cancellation, 401/503 and malformed identity failures.
`canonical-world-search-live.spec.ts` exercises the built local Nginx/Rust stack
without search response mocks, cross-checking each result against the actual
World identity graph, opening copied search results and navigating map/place
state at 1440×900 and 390×844. It also checks anonymous rejection and the
OpenAPI destination pattern.

**Observed inherited source defect:** when Companion is enabled, its fixed
launcher wrapper includes the left margin used to position its button. That
transparent wrapper intercepts pointer input over the desktop search input and
the narrow Open map search button. Full original/canonical hit tests and
screenshots reproduce the same obstruction. The native integration test uses
the available keyboard path; it does not force-click, hide Companion, modify
source styles or count pointer interaction as accepted. Pointer acceptance
remains an open source defect, alongside the previously recorded header,
feedback, Journal and Companion clipping findings.

Validation: 35 combined World/group/identity/search browser checks pass,
including all original-source comparisons and both native viewport journeys.
The final source-fixture comparison is retained separately under
`frontend/playwright-report/world-search-source-final`; the combined evidence
is `frontend/playwright-report/world-search-verified`. Canonical identity,
frontend production type/build, Rust workspace check/fmt, three persistence
search checks (including PostgreSQL), request-bound and authenticated-World API
checks pass. The local backend/frontend images are rebuilt and their normal
origin exercised. No database migration is needed.

The existing ADR-047 current-World locator remains a declared extraction
boundary before multiple published Worlds are supported; this slice does not
broaden search across Worlds. The real four-result response measured 1,303
bytes and 7–8 ms in two local observations, with the same bounded SQL query
count as before. These are fixture-scale observations, not production latency
claims. Search transport is verified; remaining World commands and recorded
source usability defects still prevent full World-family acceptance.


### World bookmark command adapter

Pinned owners: `resources/js/pages/world.tsx::toggleBookmark`,
`features/world/{node-detail-drawer.tsx,activity-panel.tsx,api.ts}`, source
`LearningBookmarkController::{store,destroy}` and
`LearningBookmarkService`. The whole copied World remains the presentation
owner. Existing native POST/DELETE
`/api/v1/learner/maps/{map_slug}/nodes/{node_slug}/bookmark`, OpenAPI
`LearnerBookmarkResult`, and `backend/crates/{api,application,persistence}/src/learner_bookmark.rs`
already supply CSRF, principal ownership, idempotence, visible-map/hidden-node
checks and the bounded authoritative bookmark set (ADR-025).

The adapter supplies source UUID → existing native slug target and native
bookmark references → source UUID set. It binds only the copied World's two
bookmark transport calls through a fail-closed exact-module Vite transform.
It retains each projected node object's verified target and World identity index
in a WeakMap; do not create a mutable global current-map registry or refetch a
whole World for each toggle. Reject unknown node objects and incomplete native
responses. No new endpoint or backend writer is needed. Preserve source labels,
local state and known narrow header obstruction; API failures must retain the
prior bookmark label and expose the existing operation-unavailable alert.
The dedicated Bookmarks route family remains a separate complete-source activation.

| Source contract | Adapter / existing Rust evidence | Failure boundary |
| --- | --- | --- |
| `toggleBookmark(node, isBookmarked)` returns authoritative `bookmarkedNodeIds` | `src/platform/world-bookmarks.ts`; `world-projection.ts` registers exact graph objects; `vite.config.ts` replaces exactly the two pinned calls | Unknown/copied node objects fail before CSRF or a write. Source component files stay byte-identical. |
| Add/delete current learner bookmark | Native POST/DELETE above with generated client and same-origin CSRF | No arbitrary source HTTP emulation; source label changes only after valid success. |
| Preserve other bookmarks, including duplicate node slugs across maps | Per-World map/node → UUID index; complete returned references mapped by both slugs | Reject unknown references, contradictory `bookmarked`, or an absent newly saved target. |
| Native unavailable response | Existing World operation alert; successful bookmark retry clears only its own error | The original async callback does not catch rejection; the expected page error and unchanged prior label are covered explicitly. |

Focused source browser regression first failed at both viewports against the
previous generic unavailable adapter. The implemented checks compare original
and copied source labels, control bounds, add/remove/retry and screenshots at
1440×900 and 390×844. Native browser checks save, reload, remove and reload
through local PostgreSQL-backed Rust, restore original fixture state, verify
missing-CSRF rejection and another principal's unchanged bookmark state.
The narrow original header still covers the bookmark pointer target; keyboard
activation is verified without hiding the header or forcing a click. This is
an open source usability defect, not a waiver or a completed pointer check.

The existing native result remains bounded to 500 bookmarks. The adapter does
not invent missing identities or claim success for a newly saved target omitted
by that limit. Full bookmark projection/pagination acceptance remains open;
this slice establishes the command transport for complete native responses.
It adds no backend endpoint, database query or whole-World refetch per toggle.

Verification: canonical identity (299 JS files plus CSS), production frontend
build, API generation/drift, Rust workspace formatting/check, two application
bookmark tests and the API World/shell authentication test passed. The combined
World/search/group/identity run passed 43 checks; its remaining narrow bookmark
check encountered a concurrent Playwright artifact-directory collision. The
isolated final bookmark run passed all three checks against the rebuilt local
frontend, including both native viewport journeys and the adapter negative
contracts. The native anonymous contract check also passed. Evidence reports:
`frontend/playwright-report/world-bookmark-verified` and
`frontend/playwright-report/world-bookmark-native-final`; source comparison
screenshots in the former retain the known header obstruction. No production
resources were changed. World remains **Incomplete**.



### World evaluated availability prerequisite

The tool-action audit found that the existing native
`POST /learner/maps/{map_slug}/nodes/{node_slug}/use-tool` and
`LearnerNodeToolResult` are reusable, but the previous World reader only evaluated
`node.state` and passed authored reveal/unlock configuration directly to the
copied UI. Source `LearningNodeSerializer::{baseNode,concealedNode}` and
`NodeUnlockService::{unlockState,requirements,transformRequirement}` instead
provide evaluated reveal flags, safe requirement labels and own-user satisfaction;
hidden nodes have the fixed “Undiscovered place” label, no description or activity
outline. The copied `features/world/world-map.tsx::canUseToolOnNode` and
`node-detail-drawer.tsx` depend on those fields. Connecting the writer alone
would leave the original controls unusable.

The existing authenticated World read now includes server-evaluated source
availability presentation, reusing the existing batched principal facts and
at most three scoped catalog-label queries for the complete World. It preserves
the source nested AND/OR requirement shape, node destinations, tool/item/role
labels and schedule times, and keeps hidden activities absent. Projection
before/after native discovery and unlock, isolation, nested requirements and
copied rendering are verified below. Source answer-event availability is now
backed by the NPC answer evidence/events contract recorded below. Tool command transport and source `router.reload({only:['world']})`
activation follow this prerequisite; a full document reload is not equivalent
because it discards source local interaction state.

| Source contract | Rust / adapter evidence | Boundary |
| --- | --- | --- |
| Concealed node | `domain/src/learner_availability_presentation.rs`; `persistence/src/learner_world.rs::apply_learner_node_states` | Fixed source title and empty native description; `world-projection.ts` maps the latter to source null. Only concealment visual flags remain. Existing graph filter keeps hidden activities and starts absent. |
| Evaluated unlock flags and nested requirements | Same domain module; existing `learner_node_availability.rs` facts; `availability_labels` batches catalog labels | Own-user tool/item/completion/manual facts, AND/OR structure, source labels and destinations; no authored rule tree is passed as evaluated UI data. Missing referenced labels remain nullable. |
| Timed tool unlock | Existing `learner_availability.rs::unlocks_node` and native `learner_node_tool.rs` writer | A configured future schedule must remain an unsatisfied condition. A regression reproduced the old early unlock after tool use; the fixed rule includes schedule presence rather than only elapsed schedules. |
| Typed World read | OpenAPI `LearnerWorldPresentation`, `LearnerWorldMap`, `LearnerWorldNode`, `LearnerNodeUnlockPresentation`, `LearnerNodeUnlockRequirement`; generated client | Public read schemas stay separate. This is authenticated World evidence, not anonymous-route acceptance. |

Source navigation limitation observed during browser comparison:
`pages/world.tsx::openNode` and the focused-node effect reject every locked
node, although `ActivityPanel::LockedActivityState` can display requirements.
Both original and copied World preserve that refusal. Complete drawer evidence
uses `e2e/canonical-availability-source.{html,tsx}` to mount the whole original
and whole copied `NodeDetailDrawer` and shared layout, with no component
fragments. This verifies the existing requirement rendering at both viewports;
it does **not** claim the World can navigate to that panel. Its narrow header
obstruction also remains visible. These source defects are not waived.

The native fixture uses real author map/node/catalog commands and scoped local
SQL only to publish its newly created map/nodes and grant its newly created
tool; it does not claim author publication or playback grant UI acceptance.
Native tool commands then prove discovery, timed lock retention and principal
isolation, with CSRF/ownership rejection. Cleanup removes only those disposable
records and restores the prior learner map preference.

The tool-action adapter and partial World reload are verified in the next
entry. Source informational visible-state preservation is repaired in the
authored-state entry below. NPC answer-event availability is verified below. World-family
acceptance remains **Incomplete**.

Verification: 45 combined browser checks passed on the rebuilt native stack,
covering native availability, source/canonical drawer evidence, identity,
bookmarks, search, error states and canonical resolver imports. The isolated
concealed-prop check additionally covers the native-empty → source-null seam.
All 13 focused domain availability checks, three World persistence checks
(including PostgreSQL-backed discovery/tool-use isolation), the application
tool-target check and API World/shell authentication check passed. Rust
format/workspace check, frontend canonical identity (299 JS files plus CSS),
production type/build and generated API drift checks passed. Native fixture
World reads measured 37,606 bytes and 12–15 ms in two local observations; those
are fixture-scale values, not production latency claims. Browser evidence is
in `frontend/playwright-report/world-availability-verified` and the separate
`world-availability-source` / `world-availability-native` reports. Canonical
source bytes, migrations, production resources and unrelated worktree files
remain unchanged.


### World tool command and partial reload adapter

Pinned owners: `pages/world.tsx::useToolOnMapNode`, complete
`features/world/world-map.tsx`, `features/tools/tool-selection.ts`,
`components/app-side-action-bar.tsx`, and the source sound helpers. Source
controllers `LearningWorldController::{revealNodeWithTool,unlockNodeWithTool}`
use `NodeRevealService` / `NodeUnlockService`; native
`POST /learner/maps/{map_slug}/nodes/{node_slug}/use-tool` already owns scope,
CSRF, tool ownership, transactional discovery/tool-use records and evaluated
result flags. The previous availability prerequisite now supplies the source
read fields required to expose these controls.

| Source seam | Implemented narrow adapter | Failure / preservation rule |
| --- | --- | --- |
| Source node UUID + selected tool UUID and reveal/unlock path | Retain verified map/node slugs and owned-tool UUID → slug mapping per exact projected node; call only the existing generated native tool command | Reject forged/changed node objects, unknown tool identities and other paths before a write. Repeat actual scope/ownership enforcement in Rust. |
| Separate reveal / unlock results | Map native flags into the matching source result variant, retaining real node/tool identities | A reveal result must not expose `isUnlocked` and accidentally play an unlock sound or reload an unrelated already-open node. Wrong-but-owned tool remains the source's successful no-op. |
| `router.reload({only:['world']})` after a useful opening | Bind only this exact copied call to the mounting World's read callback; fetch the existing World projection and update only `world` props | Keep copied layout/page/component instances, local map interactions and other props. Latest reload wins; abort reads on unmount. Failed refresh retains prior state with explicit unavailable feedback. No generic Inertia reload emulation. |
| Mutation failure / retry | Existing operation alert and source async rejection; successful retry clears only its own error | Never fabricate discovery/unlock, clear unrelated errors, or reset the document to hide a failed refresh. |

Implementation: `src/platform/world-tools.ts` retains per-projection identity
and reload bindings in WeakMaps; `world-projection.ts` registers verified nodes
and tools; `world-route.tsx` reads and replaces only the World prop. The exact
module/call guards in `vite.config.ts` fail the build if the pinned transport
seams change. All copied JSX, state hooks, controls, tool animation and sound
code stay byte-identical. No Rust endpoint or command was added.

Source-derived comparison first failed against the previous generic
unavailable adapter. Both reveal and unlock now preserve no-op, mutation
failure/retry, selected tool and toggled-map-asset state at 1440×900 and
390×844. Refresh failure keeps the old World with an error; retry restores it.
Overlapping reload coverage verifies browser cancellation (`ERR_ABORTED`) of
the older request, with no stale replacement. An unexpected 404 remains an
error; the existing contracted `404/not_found` response supplies source
`world: null` and renders the complete copied empty state. That edge case was
also reproduced before the correction.

The original-source evidence harness adapts only the exact
`router.reload({only:['world']})` transport call into a test-only World-prop
update. Original command URLs and the complete original React tree remain
independent of the native adapter. Final screenshots wait for both source and
canonical drawer transitions to settle and compare their bounds; a screenshot
mid-transition is not treated as a presentation mismatch.

Real local Rust browser journeys use the complete copied tool controls with
new disposable author-created nodes and tools. The existing scoped local SQL
fixture publishes only those records and grants only the two new test tools.
An owned but incorrect tool produces a successful no-op. Correct tool use
unlocks/reveals persistently; another principal remains locked/concealed, and
native ownership/CSRF rejection still applies. The document and equipped tool
survive both successful commands. Page-read counters prove that only World is
refetched (plus the separate CSRF reads required for writes), without another
shell, group, current-user or appearance bootstrap. Fixture cleanup restores
the previous map preference and removes only its created records.

Validation: canonical identity (299 source files plus CSS), production frontend
type/build, generated OpenAPI client drift, Rust workspace fmt/check, and focused
application/API regressions passed. The combined browser run passed 55 checks,
including `canonical-world.spec.ts`, `canonical-world-tools.spec.ts` and
`canonical-world-tools-live.spec.ts`, alongside existing availability, bookmark,
identity, search and source-identity coverage. The native tool journeys exercised
the existing Rust writer against local PostgreSQL at both required viewports.
The ignored `frontend/playwright-report/world-tools-verified/index.html` retains
the source/Rust screenshots and final results. No canonical source, backend,
OpenAPI schema or database migration changed in this slice.

Recorded source header/selection defects remain unchanged and are not waived.
Playback, anonymous World access, remaining availability/media and bounded
projection gaps still prevent whole-family completion.


### Authored visible World states

Source audit (pin `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`, local `main`
reverified): `app/Learning/Services/LearningNodeStateResolver.php` retains the
authored state unless concealment, schedule or an actual opening overrides it.
`app/Learning/Serializers/LearningNodeSerializer.php` exposes that result;
`resources/js/types/learning.ts`, `pages/world.tsx`, and the whole
`features/world/{world-map,activity-panel,node-detail-drawer}.tsx` consume it.
Only `hidden` and `locked` prevent entry; an authored `completed` value does
not synthesize activity progress or a learner completion badge.

| Contract | Existing Rust evidence | Required correction |
| --- | --- | --- |
| Authored active/available/completed/hinted/recommended | OpenAPI `PublicNode.state`, inherited by `LearnerWorldNode`; persisted `learning_nodes.state`; `world-projection.ts` passes the state through | `persistence/src/learner_world.rs::apply_learner_node_states` now preserves these values when evaluated availability permits entry, instead of emitting `available` for all of them. |
| Concealment, schedule and actual opening precedence | `domain/src/learner_availability.rs`, `persistence/src/learner_node_availability.rs` | Keep the existing authorization enum and evaluated hidden/locked states authoritative. A discovered hidden node or opened locked node becomes available. |
| Unknown state / API failure | Existing fail-closed authored-state mapping and World unavailable boundary | Do not treat arbitrary persisted strings as playable or fabricate a successful World response. |

This is a read-projection repair using the existing endpoint, with no copied
frontend changes or new backend contract. NPC answer-event availability is
implemented separately below; this informational-state repair alone did not
establish it.

The isolated PostgreSQL regression and real Rust HTTP/browser fixture both
reproduced `active` being returned as `available` before the correction. The
database regression now covers all four previously flattened authored states,
playability, scheduled recommendation remaining locked, concealment, actual
tool openings and principal isolation. It uses connection-local temporary
tables and leaves application rows untouched. The correction adds no SQL
queries or response fields.

`frontend/e2e/canonical-world.spec.ts` compares the complete original-source
World/layout against the copied page for all five visible states at 1440×900
and 390×844. It checks selection, drawer bounds, bounded Start controls and
absence of a fabricated completion badge; the separate existing regression
still proves real activity progress renders the completion badge. Source and
Rust screenshots are byte-identical for the inspected completed-state pair at
both sizes. The inherited narrow header obstruction remains unchanged and is
not waived. `canonical-world-states-live.spec.ts` creates disposable records
through native author APIs, publishes only those fixtures locally, verifies
the actual World response, opens each state through the copied route and
checks that scheduled recommendations cannot be selected. Its cleanup restores
the learner's previous map preference and deletes only its created map.

Verification: canonical identity, frontend production type/build and generated
client drift passed, as did Rust fmt/workspace check, 13 domain availability
tests, the API authentication regression and the explicit PostgreSQL regression.
The broader 43-case source/resolver suite initially passed 42 checks and exposed
one search-test animation race: on narrow screens the open source drawer covers
the search button. The test now activates the existing Close node panel button
with Enter before reopening search; both desktop/narrow search cases passed on
rerun. No production or source control was changed to satisfy that check.
All six native availability/state/tool browser cases passed against the rebuilt
local backend. Reports are retained under ignored
`frontend/playwright-report/world-states-{source,search,native}/`. The six-node
state fixture returned 44382 bytes in 11–12 ms locally; these are observations,
not a production performance claim.

### Canonical playback prerequisites (activation remains pending)

Entry audit against pinned `main`:
`app/Http/Controllers/LearningWorldController.php::play`,
`app/Learning/Serializers/{LearningNodeSerializer,LearningActivitySerializer,LearnerProgressSerializer}.php`,
`resources/js/pages/learning/node-play.tsx`, `types/learning.ts`, and
`features/world/{activity-panel,active-activity,learning-check-in,api}.ts*`.
The complete player imports `standard-activities`, `markdown-activity`,
`tool-grant-activity`, `item-grant-activity`, `item-obstacle-activity`,
`obstacle-activity`, `message-activities`, `npc-dialogue-player`,
`shared-task-activity` and `activity-ambient-sound`. These whole source modules,
their transitive controls and the existing copied layout remain the only UI
target. This prerequisite audit does not declare that their complete command
and field mappings are verified.

| Source requirement | Reusable Rust evidence | Concrete remaining contract / adapter work |
| --- | --- | --- |
| Node UUID in `/learning/nodes/{node}/play`; node/map identity in props | `GET /learner/play-runs/{play_run_id}`, `domain/src/learner_state.rs::LearnerPlaybackContext`, `persistence/src/learner_playback.rs::PlaybackRow` | Actual authorized `node_id` and `map_id` now returned for generic, message, portal-arrival, revisit, recall and replay reads. Existing titles/slugs cannot stand in for these identities. The future adapter must validate route identity against the authorized read before mounting. |
| Start/resume/reset; ordinary, portal, revisit, recall and replay semantics | Existing `/learner/activity-starts/{start_id}/{start,reset}`, replay/recall/revisit entry endpoints and run repositories | Map source query parameters and restart response URL to typed commands. Preserve distinct run kinds and CSRF; no Laravel GET/session emulation. Inventory clean URL entry and direct activity entry before activation. |
| Complete `node` with activity graph, start alternatives and portal links | World graph supplies real outline IDs; active-run document now adds the published navigation definition described below; native author graph is **not** a learner endpoint | The authored-presentation, private-state and node/portal read extensions below now supply these prerequisites. Review/shared-task contexts are now projected below; complete source identity/transport mapping before mounting; never fill inactive activities with fake config or use author-only payloads. |
| `playActivityId`, `playRouteId`, `playRunId`, `revisitActivityId`, `recallQuestionId` | Active activity ID, optional start ID, run ID/kind and owner-scoped recall handle exist | Reconcile question/option identities and source recall question identity versus native recall-item handle. Source numeric identity checks such as alternative `route.id > 0` require an exact transport/identity seam, not invented numeric IDs. |
| `progress.activities`, `progress.answers`, `progress.recallQuestionIds`, `playState` | The typed `LearnerPlaybackDocument.private_state` extension below supplies owner progress, bounded answers, recall membership and saved run/obstacle state | Map these verified native facts into the whole copied page, retaining missing-snapshot unavailable behavior. Copied-player resume/reset acceptance remains required. |
| Reached/completed progress and optional check-in | Existing route-entry/progress writes, completion and check-in endpoints; `persistence/src/learner_playback.rs` | Map all source completion fields and returned activity/transition identities, including assistance, outcome and check-in state; do not acknowledge an unmapped write. |
| Question/reflection/grants/obstacles/messages/dialogue/shared-task/portal commands | Existing typed `/learner/play-runs/{run}/activities/{slug}/...` operations and persistence modules | Complete per-player source request/response and media mapping before mounting the route family. Preserve the server's active-run authority even where source state selects the next activity locally. |
| Companion refresh, shared layout, appearance, inventory, bookmarks and return-to-map | Existing shell and World adapters, companion context/turn, bookmark and map-location operations | Bind to actual node/activity/run context. Source partial reload of Companion must remain scoped; failed reads/writes keep explicit unavailable/error behavior. |
| Anonymous playback and invalid/unpublished/unowned runs | Anonymous source branch exists; native playback currently requires authentication | Anonymous source parity remains missing. Keep the route unavailable until its required contracts exist; 401/404/503 must not produce a fabricated player document. |

Implementation order: finish the bounded playback read prerequisites, complete
the source-shaped graph/progress and per-player command matrix, then activate
the whole copied route with native run/refresh/navigation coverage. Playback
acceptance must include both required viewports and actual Rust integration;
read-contract tests alone do not establish UI parity or route completion.

**Verified identity prerequisite:** added required UUID fields to the existing
OpenAPI context and regenerated the typed client. Every read branch obtains
them from its existing authorized node/map joins; no new query, endpoint,
schema migration, writer or canonical component was added. The initial native
regression failed on the absent fields. `frontend/e2e/canonical-playback-contract-live.spec.ts`
then passed all six reader branches, cross-checking real author activity IDs,
distinct portal source/target nodes, 404 for another principal, 401 without a
session, 404 after unpublishing the fixture map and question-answer exclusion.
The scoped SQL fixtures seed only newly created run records; they do not claim
entry-writer or playback UI acceptance. Cleanup deletes their created map and
cascaded fixture records.

Verification passed: canonical identity, frontend production type/build,
generated-client drift, Rust fmt/workspace check, eight playback persistence
unit tests and three application tests. All eight native/browser checks passed:
the six reader cases plus existing real World continuation at 1440×900 and
390×844. The latter still reaches the explicit unavailable player route; it is
identity/navigation regression evidence, not playback parity. The ignored
`frontend/playwright-report/playback-identity/` contains the results. No source
UI changed, so no new playback screenshot parity is claimed.

### Published playback navigation graph

Source owners: pinned `LearningNodeSerializer::serialize`,
`LearningActivitySerializer::{serialize,transition}`,
`LearningNode::activities`, `LoadPlayableNode::handle`, and copied
`pages/learning/node-play.tsx` / `features/world/activity-panel.tsx`.
The source selects activities by real identity, follows authored connector
edges, shows alternate starts and refuses a newly hidden/locked node on entry.
The active Rust playback document previously lacked the node graph and did not
recheck source node availability when reading an existing run.

The read extension is a typed, published **navigation definition**, not a
fabricated `LearningNode` prop: all published activities on the authorized
node's MapAsset, their introductions, existing learner-safe configuration,
time/check-in metadata, complete authored transition identities/connectors,
and eligible starts with own-user continuation. The current activity must be
in that graph. Reuse the existing safe-config, media URL, start eligibility and
availability policies. Node/map authorization still comes from the active run.

Bound the graph to 1000 activities, 4000 transitions and 1000 starts, using
bounded batched queries and explicit failure on overflow. An edge to an
unpublished or foreign-node activity must not be silently converted into a
terminal edge or omitted as if the authored route had ended. Private progress,
answers and portal destinations remain separately tracked prerequisites. The
authored presentation/resources extension is recorded below; neither read
definition alone authorizes player activation.

Implementation: `persistence/src/learner_playback_graph.rs` adds four batched
queries to the existing active-run read, reusing `learner_safe_config`,
`learner_media_config`, `time_guide_minutes`, `check_in_context`, the existing
start-type allowlist and `PostgresLearnerNodeAvailability`. It revalidates map,
node and MapAsset publication/access and rejects current hidden/locked or
scheduled-locked nodes with 404. The domain/OpenAPI graph types distinguish
navigation definitions from complete source activity props. Source files and
all UI resolvers remain unchanged.

The native regression reproduced both the absent graph and the existing
locked-node read returning 200. Focused graph tests cover real identity with
repeated slugs, parallel/self/terminal edges, source connector fallbacks,
eligible preferred starts, input-portal exclusion, question correctness
exclusion, invalid targets/configuration and all three collection bounds.
The real PostgreSQL fixture additionally checks draft exclusion, another
principal's start progress remaining absent, source start presentation,
unpublished destinations yielding 503, current availability yielding 404, and
recovery after removing an over-limit or malformed definition.

The completion restriction across native route groupings is repaired below.
The authored presentation extension below supplies question/option keys, sources,
feedback guidance, configured resources and NPC definitions. Before activation,
finish source identity adaptation, portal destinations, private
answer/progress/play-state projections and the per-player transport matrix.
None may be substituted with empty source props merely because definitions
are now readable.

Verification passed: canonical identity, frontend production type/build,
generated-client drift, Rust fmt/workspace check, twelve playback persistence
tests (including four graph regressions), three application tests, and eight
native/browser cases against the rebuilt local PostgreSQL-backed API. The six
run-kind fixtures exercise the graph and current availability checks; real
World continuation is still checked at 1440×900 and 390×844 without claiming
that the unavailable player has been activated. The ignored report is
`frontend/playwright-report/playback-graph/`.

Local measurements: the two-activity/parallel-edge definition returned 3459
bytes in 12 ms; a 102-activity definition returned 31453 bytes in 8 ms. These
single warmed local observations demonstrate payload growth and successful
bounded reads, not a speedup or production SLA. The implementation performs
the same four graph queries at both sizes. No source component, database
migration, production data or traffic ownership changed.

### Playback completion across native route groups

Pinned source evidence: `app/Learning/Services/LearnerRouteProgressService.php`
(`enterActivity`, `progressForRun`, `completeRouteIfTerminal`) scopes progress
to the learner, node and play run. `LearningActivitySerializer::transition`
preserves authored activity destinations. A native `learning_routes` grouping
does not introduce a source navigation boundary within that node's MapAsset.
The existing completion endpoint incorrectly required that grouping to match;
its separate message branch could filter out an invalid destination and mark
the run completed instead.

`persistence/src/learner_playback.rs` now shares a published destination lookup
between ordinary and message completion. The authorized current activity's
MapAsset bounds the destination, including a different published route group.
The message path resolves the first authored completion edge before validating
its target, so a foreign, unpublished or malformed destination returns the
existing 404 instead of completing or skipping to a later edge. A real null
terminal remains terminal. Run/start identity and the original start's route
association remain unchanged; no schema migration or generic progress writer
is introduced. OpenAPI `completeLearnerCurrentActivity` documents the behavior.

`frontend/e2e/canonical-playback-contract-live.spec.ts` extends disposable real
PostgreSQL fixtures for ordinary and support-message runs. The pre-fix checks
reproduced 404 for a valid cross-group advance and a false completed status/count
for an invalid message destination. Coverage checks foreign MapAsset targets,
unpublished activities/routes, malformed configuration, first-edge ordering,
another learner, anonymous access, missing CSRF, retained run/start association,
successful advance/readback, stale commands, explicit null terminals and a
single completion count after retry. Reset creates a new run at the original
start; both completion paths preserve an explicit first null edge even with a
later non-null edge. Source files and UI activation are unchanged.

Verification passed: canonical byte identity, frontend production type/build,
OpenAPI generated-client drift, Rust workspace fmt/check, twelve persistence
and three application playback tests, plus eight real API/browser checks
against the rebuilt local Rust/PostgreSQL stack. Existing World continuation
checks passed at 1440×900 and 390×844; this is not player UI parity evidence.
The report is `frontend/playwright-report/playback-completion/`. Ordinary and
message cross-group completions took 13 ms and 10 ms respectively in single
local observations. The destination lookup is indexed and bounded; the message
path adds one point query so it can distinguish a terminal from an invalid target.

Remaining activation gaps include node availability enforcement across all
player writers. The exact-reference contract below addresses commands when two
activities share a slug; the canonical adapter must use it throughout the
copied player. Full player props and typed commands are still required before
activating the route.

### Player activity reference contract

Pinned `resources/js/pages/learning/node-play.tsx` and its whole activity-player
components send the selected activity ID in source URLs. Slugs are not unique
across the native route groups now exposed in a node graph. Before activation,
all player transports must address the actual graph activity UUID, including
stale requests after another command advances the run.

The existing Rust path parameter retains its historical `activity_slug` name
for client compatibility, but gains the explicit `id:<lowercase UUID>` form.
The typed adapter must encode this reference from the server's real activity
ID; it must never resolve an ID back to an ambiguous slug. The `id:` prefix is
outside the documented legacy slug alphabet, so UUID-shaped slugs remain valid
legacy slugs and an invalid explicit ID never falls back to slug matching.
Resolution stays inside each existing authorized/locked SQL query; it is not a
separate preflight whose result can become stale before the write. There is no
new endpoint, generic transport, schema migration or client-chosen destination.
Answer, reflection and check-in responses continue returning the actual stored
`activity_slug`, rather than echoing the new reference into a slug field.

| Contract owner in `backend/crates/persistence/src/` | Required identity boundary |
| --- | --- |
| `learner_playback.rs` | Current completion, message completion, portal arrival and current run-specific state/resource reads retain the activity UUID. |
| `learner_question.rs`, `learner_reflection.rs`, `learner_recall.rs`, `learner_check_in.rs` | Answer, reflection, recall and completed-activity observations remain bound to the addressed activity and owned run. |
| `learner_tool_grant.rs`, `learner_item_grant.rs`, `learner_item_obstacle.rs`, `learner_obstacle_tool.rs` | Grant/obstacle prerequisites and owned inventory remain authoritative after exact activity selection. |
| `learner_npc_dialogue.rs`, `learner_shared_task.rs` | Every dialogue and shared-task command reuses its existing current-activity lookup, with exact reference matching. |
| `learner_support.rs`, `learner_peer_message.rs` | Private support and peer message reads/writes keep their topic, audience and membership boundaries. |
| `learner_portal.rs` | Travel and idempotent existing-arrival lookup both identify the actual source activity. |
| `learner_activity_translation.rs`, `learner_activity_replay_run.rs` | Translation and replay entry select the exact published, scoped activity; replay no longer relies on an ambiguous slug when called by the canonical adapter. |

Verified implementation: the named repositories accept exact references inside
their existing queries without extra preflight queries. The initial native
regression failed because translation rejected the real explicit ID. The new
`frontend/e2e/canonical-playback-reference-live.spec.ts` exercises an actual
read/command for each of the fourteen supported activity types against fresh
PostgreSQL fixtures. It checks legacy slug reads, exact-ID reads, wrong IDs,
another principal, CSRF, UUID-shaped legacy slugs, malformed explicit IDs and
stale requests after movement to a different activity with the same slug.
Question, reflection and check-in results retain real slugs. Recall queueing,
exact replay entry, private support submission, portal travel and its
idempotent arrival retry retain their existing server-owned semantics.

The extended `canonical-playback-contract-live.spec.ts` now advances between
same-slug activities using explicit IDs and rejects the old activity's command
after advancement. All six run kinds complete through their exact references;
revisit completion still refuses a run without a current due invitation. The
publication denial is checked while each run is active, rather than relying
on a completed run's unrelated 404. Fixtures are local-only and their created
maps/catalog records are removed afterwards.

Verification passed: canonical byte identity, production frontend type/build,
generated OpenAPI client drift, Rust workspace fmt/check, 54 focused
persistence tests and 43 application tests. Six unrelated database-dependent
Rust tests were ignored by that command, not counted as passing. The rebuilt
local Rust/PostgreSQL service passed all 22 native/browser cases, including
existing World continuation at 1440×900 and 390×844. Report:
`frontend/playwright-report/playback-reference/`. Single local observations of
the fourteen representative requests ranged from 4–11 ms; these are not a
production SLA. No copied component or source URL changed. These command
prerequisites do not constitute full player UI or every secondary-command
workflow acceptance.

This is a prerequisite contract, not player activation. Node availability on
all writers, complete player props, full command mappings and source-derived
browser acceptance remain open.

### Published player presentation contract

Pinned `main` remains `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`.
Source owners are `app/Learning/Serializers/{LearningActivitySerializer,
LearningItemSerializer,LearningToolSerializer,DialogueTypingSoundSetSerializer}.php`,
`app/Learning/Services/{ActivitySourceReferenceConfiguration,
ActivityFeedbackGuidanceConfiguration,ActivityCompletionChoiceConfiguration}.php`,
and the whole copied `resources/js/pages/learning/node-play.tsx`,
`types/learning.ts`, `features/world/{activity-panel,activity-ambient-sound,
standard-activities,tool-grant-activity,item-grant-activity,item-obstacle-activity,
npc-dialogue-player}.tsx`. No source component is edited or selectively recreated.

| Source presentation dependency | Native graph contract and evidence |
| --- | --- |
| Sources, feedback guidance, completion choices | `LearnerPlaybackGraphActivity.presentation`; reuse the existing administrative source-reference/feedback normalizers, first-five source references, bounded excerpts/concepts/rubrics and optional null semantics. The already verified `check_in` and `time_guide_minutes` fields supply evidence context and time guidance. |
| Configured items and tool | Batch only authored item/tool references, preserving actual catalog UUIDs and native slugs. Configured item quantity is zero as in the source catalog serializer; holdings remain a separate private inventory. The later source adapter must resolve native catalog slugs to these UUIDs for source controls and map commands back through the typed contract. |
| Configured sounds and typing sound sets | Batch referenced published sound UUIDs, retaining the existing Rust audio publication boundary, and the enabled NPC nodes' selected/default sets. Preserve name/icon, volume, duration, looping, letter keys and real sound identities. Disabled nodes expose no typing sets. |
| NPC authored graph | Batch node definitions and transitions, including real transition IDs, nullable start endpoint and connector names. Private dialogue cursors/history are not fabricated from these definitions. |
| Question and options | Question identity is the native activity UUID; option identities are existing native option keys. Preserve prompt, multiple-choice flag, labels/body, outcome keys and authored weights, while excluding correctness, answer feedback and explanation. Canonical numeric-ID assumptions still need the documented identity seam. |
| Media transport | Reuse `learner_media` URL/config conversion. This does not itself prove delivery authorization for every unowned configured catalog resource; that remains an activation requirement. |

Implementation owners: `domain/src/learner_state.rs`,
`persistence/src/learner_playback_{graph,presentation}.rs`, and the corresponding
OpenAPI/generated client types. Presentation enrichment runs only after the
active run's published node graph is authorized. Catalog references and NPC
rows are fetched in bounded batches, with maps by resource/activity identity
for assembly. No per-activity database reads are added. The existing four
graph queries remain; enrichment adds at most seven queries, skipping absent
resource kinds. Global limits are 4096 items/tools/sounds/NPC nodes per kind,
8192 NPC edges, 256 sound sets and 6656 typing sounds. Overflow returns the
existing unavailable response rather than a truncated player definition.
Missing authored catalog references retain the source's null/empty behavior;
this is distinct from a missing Rust contract.

Verification passed: canonical byte identity, production frontend type/build,
generated-client drift, Rust workspace fmt/check, fifteen persistence playback
tests (including three presentation regressions), three application playback
tests, and all 22 native/browser cases against the rebuilt local API and
PostgreSQL. The new source-derived fixture first reproduced absent presentation
props, then verified metadata normalization, real catalog IDs distinct from
slugs, configured-versus-owned quantities, sound fields, private question-field
exclusion, NPC transition identities, explicit/default/disabled typing sets,
unpublished sound exclusion, and 503/recovery for an oversized NPC graph. Existing run-kind/command guards
and World continuation at 1440×900 and 390×844 remain passing. This is backend
presentation and unchanged World evidence, not player screenshot parity.

The report is `frontend/playwright-report/playback-presentation/`. The fourteen
representative two-activity reads took 6–12 ms locally and returned 4.5–11.4 KB.
The existing 102-activity fixture returned 57850 bytes in 8 ms, compared with
31453 bytes/8 ms before authored presentation was included. These single local
observations describe the additional payload, not a performance guarantee.
No canonical UI, database migration or production ownership changed.

This completes the authored-presentation prerequisite, not the player route.
The private-state and node/portal read extensions below now supply their
separate prerequisites. Per-activity review/shared-task state and all player
transport, availability and media boundaries still need complete source-derived
acceptance before activation. Question option-weight authoring must also
be checked against the source; exposing stored weights is not evidence that
all source authoring controls persist them.

### Check-ins after crossing activity route groups

Source owners, verified byte-identical to pinned main:
`app/Http/Controllers/LearningWorldController.php::recordActivityCheckIn`,
`app/Learning/Services/LearnerProgressService.php::recordCheckIn`, and
`tests/Feature/LearnerActivityCheckInTest.php`. Source check-ins require the
learner's completed activity, not membership in the start's original route
group. The Rust run keeps its original start/group after traversing an authored
same-MapAsset connection. Its check-in query incorrectly required that original
group, returning 404 after a successful cross-group completion.

`persistence/src/learner_check_in.rs` now scopes explicit activity UUIDs to the
authorized run's MapAsset. It retains own completed progress, publication,
map-access, current run, and transactional row locks. Legacy slugs remain
scoped to the original group because slugs can repeat between groups. The
existing endpoint, payload, private history limit and revisit scheduling are
reused; OpenAPI documents the identity distinction. No schema or source UI
changes are needed.

`canonical-playback-contract-live.spec.ts` reproduced the 404 for both ordinary
and message-started runs. Its regression follows a real authored transition,
completes the destination, saves an observation and checks persisted ownership,
activity/run identity and pending revisit. It also rejects incomplete,
foreign-place, unpublished, wrong-user, anonymous, missing-CSRF and superseded
run requests, and proves repeated legacy slugs still select the original group.
Verification passed: canonical identity, production frontend type/build,
generated OpenAPI client drift, Rust fmt/workspace check and the focused
application check-in test. All 22 native/browser checks passed against the
rebuilt local API/PostgreSQL, including World continuation at 1440×900 and
390×844. Report: `frontend/playwright-report/playback-checkins/`. This backend
fix adds no queries or UI changes; it does not establish player screenshot
parity.

This closes the same-place cross-group check-in gap only. Private replay,
recall/revisit and portal-arrival check-in admission, dynamic availability on
writers, and complete copied-player props/transports remain activation work.

### Private player progress and saved interaction state

Source audit owners: pinned `LearnerProgressSerializer::{forUser,activities,
answers,attempt}`, `LearnerActivityPlayStateService::{activityStatesForRun,
updateNpcDialogueState,updateSharedTaskChecklist,clearActivityState}`,
`LearningWorldController::play`, copied `types/learning.ts`,
`pages/learning/node-play.tsx` and the whole `activity-panel`,
`item-obstacle-activity`, `obstacle-activity`, `npc-dialogue-player` and
`shared-task-activity` modules. The private boundary is separate from the
authored presentation contract. Also audited pinned
`QuestionAnswerService::{answer,feedbackFor}` and `QuestionTransitionResolver`;
source serializers/services were verified byte-identical to the pinned SHA.

| Source prop | Existing Rust evidence | Projection and adapter requirement |
| --- | --- | --- |
| `progress.activities` keyed by real activity identity | `learner_activity_progress`; `LearnerActivityProgress` currently exposes node/activity slugs, status and timestamp | Project actual activity UUIDs for the authorized node, preserving status and completion time. Source obstacle metadata must come from its typed durable records, not invented empty metadata. |
| `progress.answers` with latest and three earlier attempts | `learner_question_answers`; `learner_question.rs::question_feedback_for_playback` returns only the active activity's current-run answer | Batch the owner's latest four answers per published node question across runs; preserve native option keys, confidence/calibration, authored selected-option labels, feedback/explanation and next transition identity. Existing current-run helper is insufficient and must not be called per graph activity. No unanswered-question correctness may leak. |
| `progress.recallQuestionIds` | Existing recall queue and activity identities | Batch actual owner queue membership for the node's questions; distinguish question/activity identity from the separate recall-item handle. |
| `playState[activity].npcDialogue` | `learner_npc_dialogue_states`; current-activity reader in `learner_playback.rs::load_npc_dialogue` | Batch only this principal/run's saved cursors/history, validate against authored node identities and preserve the source forty-entry bound. An absent saved row remains absent; do not fabricate an initialized state. |
| `playState[activity].sharedTask` | `learner_shared_task_checklists`; current-activity `load_state_for_playback` | Batch this principal/run's actual completed indexes, retain source limits and validate against current authored steps. Shared contribution/review data remains its separate typed contract. |
| `progress.activities[id].metadata.itemObstacle` | `learner_item_obstacle_states`, `learner_item_obstacle_slots`, `learner_item_obstacle.rs::load_state` | Batch durable slot/lock state and reuse configured-slot/condition policy. Map real catalog identities consistently with the presentation catalog; do not substitute owned inventory for filled slots. |
| `progress.activities[id].metadata.obstacle.destroyedAt` | `learner_obstacle_resolutions` versus `learner_obstacle_run_passes` | Project the durable resolution timestamp only; a temporary per-run pass must not become a permanent source clear. |

Implementation: `LearnerPlaybackDocument.private_state`,
`persistence/src/learner_playback_private_state.rs`, domain/OpenAPI/generated
client types. The caller first authorizes the active run and bounded published
node graph. Eight batch reads at most (absent activity kinds skip their reads)
return owner-only facts; saved dialogue/checklists additionally require the
exact run. Unique activity-keyed records are bounded by the graph's 1000
activities, slots by ten per activity, and answers by an indexed lateral read
of four records per question. No all-history materialization or per-activity
network query is added. Authored definitions and private facts remain separate.
The typed adapter must map these actual facts into the copied props; the
canonical page remains unmounted.

Malformed selected options, missing saved dialogue references, over-forty
history and checklist entries outside current authored steps fail explicitly.
Absent records remain absent. Obstacle conditions reuse the existing configured
slot/evaluation functions. Durable obstacle clear timestamps are distinct from
per-run passes. Saved state reads do not initialize or change these records.
The existing playback endpoint's topic-visit behavior remains unchanged.

**Answer-time feedback:** source persists the feedback actually shown. Native
answers previously did not. Migration `0109_question_answer_feedback.sql` adds
nullable feedback plus a recorded flag, preserving existing rows without
inventing their history. The native answer writer now saves the source-derived
single/multiple-choice feedback in its existing transaction. The new canonical
projection returns 503 if its latest answer lacks a recorded snapshot; a new
valid answer supplies a real snapshot, including a deliberately null feedback.
Earlier attempts require only their already-recorded result, time and choices.
Current-run reads preserve recorded feedback after author edits. No legacy
answer text is backfilled or deleted.

**Selection rule:** pinned source uses option outcomes only for a single-choice
question and aggregate correctness for multiple-choice questions. The native
answer writer, completion resolver, current-answer reader and new private
projection now share that rule. This prevents a restored answer and its next
command from choosing different destinations.

Verification passed: canonical byte identity, frontend production type/build,
generated OpenAPI client drift, Rust workspace fmt/check, twenty persistence
playback tests, one question test, and three application playback tests. The
local SQLx migration runner completed migration 109 (`success=true`). All 22
native/browser checks passed against the rebuilt API/PostgreSQL, including
World continuation at 1440×900 and 390×844; the report is
`frontend/playwright-report/player-private-state/`. The initial regression
first reproduced the absent private state; the next native run reproduced the
multiple-choice transition mismatch before its correction. Source-derived
coverage includes latest/four-attempt ordering across runs, repeated slugs,
owner/peer isolation, unpublished activities, missing snapshots, changed authored
feedback (including recorded null), single versus multiple-choice transitions, current versus stale run
state, malformed dialogue history, checklist bounds and durable versus temporary
obstacle state. This does not by itself complete node/topic/portal presentation,
review/shared-task documents, all player transports, anonymous playback, actual
copied-player refresh/reset acceptance or UI activation.

Local measurements for the two-activity fixtures before any private records
were seeded: 6–9 ms and 4.7–11.6 KB. The existing 102-activity graph returned
58015 bytes in 8 ms, versus 57850 bytes/8 ms before this extension. These are
single local observations, not an SLA or measurements of populated history.


### Player node and portal presentation

Pinned-source owners verified against main: `LearningNodeSerializer::{serialize,
baseNode}`, `LearningPortalLinkSerializer::serialize`, copied
`pages/learning/node-play.tsx`, `features/world/standard-activities.tsx` and
`types/learning.ts`. The source selects a portal by actual source activity ID,
shows target availability, and constructs its destination from real target
node/activity IDs. A display-only target title cannot satisfy that contract.

| Required source data | Existing evidence | Next implementation |
| --- | --- | --- |
| Node description, position, evaluated state/visual configuration, map identity and topic | `world-projection.ts::toWorldPageProps`, `learner_world.rs`, `public_world.rs`, `learner_availability_presentation::visual_config` | Reuse sanitization, media conversion and evaluated availability policies in a bounded projection for the already authorized playback node. The existing World endpoint chooses the first published World and cannot reliably supply an arbitrary authorized deep-link node. Do not fabricate a missing node from titles/slugs or load another World as its substitute. |
| All outgoing portal links: real link/source activity/target activity/map/node IDs, target map/node slugs and titles, label/description, evaluated target state | `LearnerPortalDestination` currently contains only labels/titles/state; `learner_playback.rs::load_portal_state` reads the active route portal; `learning_portal_links` and typed travel commands already persist actual identities | Batch the authorized node's published links and target publication/map access, reuse `PostgresLearnerNodeAvailability` for target state, and return source-required identities. Keep locked/hidden state explicit; route labels alone cannot authorize travel. Test multiple output portals, input portals, inaccessible/unpublished targets and same-slug destinations. |
| Bookmark and source topic/return URLs | Existing bookmark, topic and node/map identity contracts | Bind URLs and bookmark membership to the authorized node's real identifiers; retain source navigation. A topic link may stay unavailable until its route activation, without inventing topic content. |

Review and Shared Task documents are covered by the following extensions.
After these boundaries, complete
typed command/media mappings and source identity seams before mounting the
whole copied player. This contract does not activate any UI or declare playback
complete. Existing World selection policy is not changed by the
playback-node projection.

Implementation: `LearnerPlaybackDocument.node`,
`persistence/src/learner_playback_node.rs`, the existing authorized node query
in `learner_playback_graph.rs`, and domain/OpenAPI/generated client models.
The node query now supplies actual map/node identity, title/description,
coordinates, published topic and owner-only bookmark existence. No extra
endpoint or first-World lookup is introduced. The future source adapter must
retain `/topics/{slug}` and `/competence?topic={slug}` as their distinct source
destinations, not map both links to the topic page.

Node visual configuration reuses `learner_availability_presentation`, the
existing availability facts and `public_world::learner_node_visual_config`.
Catalog label collection/queries are shared with the World reader. Prerequisite
node labels are fetched in one bounded, published/map-access-scoped batch;
interaction sounds reuse publication filtering and learner media URL mapping.
The current node still returns 404 when its availability denies play. This
proves URL conversion, not delivery authorization for every configured asset.

Outgoing portals are one bounded batch over the authorized graph's published
output activities. Target activity/route/MapAsset/node/map publication and map
access are checked before projection; targets must remain input portals. Locked,
hidden and authored visible states remain explicit. Every returned identity is
native: the link's `id` is its real source-activity primary key, not a generated
presentation counter. Input portals, inaccessible/unpublished targets and
missing links do not produce substitute destinations. Existing travel commands
retain run ownership and recheck destination playability independently.

The base node/bookmark/topic data extends an existing query; dependent labels,
sounds and portal links add at most six batch queries, skipping absent kinds.
The graph's 1000-activity limit and unique source-portal primary key bound links;
node/sound reference collections also reject more than 1000 dependencies.

Verification passed: canonical source identity, production frontend type/build,
generated client drift, Rust fmt/workspace check, 21 persistence playback tests,
one World unit test, both previously ignored PostgreSQL World integration tests,
four public-World tests, thirteen domain availability tests and three application
playback tests. All 26 native/browser cases passed against the rebuilt API.
`canonical-playback-node-evidence.ts` proves a node outside the explorer's first
World, coordinates/topic visibility, private bookmark membership, visual-rule
sanitization, media URL conversion and published sound filtering. Portal cases
cover multiple outputs, input arrivals, repeated target slugs in distinct maps,
other-World targets, scheduled/hidden/locked/active/completed states, inaccessible
maps, each publication boundary and changed target type. Existing owner/run,
private-state and command guards remain passing.

Report: `frontend/playwright-report/player-node-portals/`. World continuation,
availability and authored-state browser checks retain 1440×900 and 390×844
coverage. These are backend and unchanged World evidence, not player screenshot
parity. Six run-kind reads took 7–38 ms locally; the 102-activity fixture returned
58516 bytes in 13 ms, versus 58015 bytes/8 ms before node presentation. Fourteen
two-activity reads took 6–10 ms. These observations are not an SLA. No canonical
UI, database migration, production owner or World-selection policy changed.

### Review context for the complete playback graph

Pinned `main` remains `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`.
Source owners: `app/Learning/Serializers/{LearningNodeSerializer,LearningActivitySerializer}.php`,
`tests/Feature/LearnerJournalTest.php`, and copied
`resources/js/{pages/learning/node-play.tsx,features/world/standard-activities.tsx,types/learning.ts}`.
The copied Reflection/Review component reads each activity's `reviewContext`,
not only the activity active on the server when the page was loaded.

| Source requirement | Existing Rust evidence and gap | Implemented contract / adapter requirement |
| --- | --- | --- |
| Review activities and reflections with `learningIntent: review` receive category history; all other types receive null | `learner_playback.rs::load_review_context` covered only the current activity | `graph.activities[].review_context` uses exact source type eligibility; eventual page adapter maps the field and `created_at` to source camelCase. No UI or endpoint activation in this prerequisite. |
| Trimmed topic/subtopic; blank topic uses node title; blank subtopic includes all subtopics | Existing current-activity reader had the same category matching, but sanitized graph configs do not carry category authoring fields | `learner_playback_reviews.rs` uses already-loaded raw configs internally; category fields do not need to be exposed or fabricated by the browser. |
| Latest three own reflections, ordered by timestamp then ID descending, including inactive published activities | Native journal/reflection tables and indexes reusable; per-activity graph projection absent | One batch over deduplicated categories, bounded by the already-authorized 1,000-activity graph. SQL limits each category to three rows and scopes both reflection and journal page to the authenticated principal. |
| No category history is an empty array; a non-review activity is null | Existing active response uses an array | New graph field preserves null/empty distinction. Existing `activity.review_context` reuses the graph result, retaining its array contract and removing its duplicate SQL query. |
| Unpublished activities, wrong-owner runs, unavailable reads | Existing playback publication, graph, ownership and error gates | Context is populated only after those gates. Query failure remains unavailable, never an invented empty history. No new writer or anonymous access. |

The pre-change real-Rust regression failed because inactive review context was
absent. `canonical-playback-review-evidence.ts`, exercised by the native route
playback test, covers specific/all-subtopic categories, title fallback, shared
categories, empty/null distinctions, timestamp ties and descending UUID order,
peer isolation, unpublished activities, active/graph agreement, refresh after
history deletion, and 100 additional same-category reviews. Fixture journal
pages and activities are disposable and removed on both success and failure.

Verified: canonical byte identity, frontend production type/build, generated
OpenAPI client consistency, Rust workspace check/format, 22 persistence playback
tests, three application playback tests, and 20 real Rust/PostgreSQL playback
checks across six run kinds and fourteen activity types. Report:
`frontend/playwright-report/player-review-context/`. No UI changed, so these
are contract checks, not new desktop/narrow screenshots. The seven-inactive-
activity fixture read took 7 ms / 8927 bytes; 100 additional same-category
reviews took 23 ms / 117365 bytes. One SQL round trip handles all distinct
review categories (zero when none exist); each category returns at most three
rows. Local measurements are evidence, not an SLA.

The complete player remains unavailable
until command/identity/media mappings, anonymous playback and whole copied-route
acceptance are complete. Shared Task state is covered by the next extension. This read-only
prerequisite does not claim player UI/browser parity.

### Complete-graph Shared Task state contract

Source audit before implementation: pinned `main`
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`,
`app/Learning/Serializers/{LearningNodeSerializer,LearningActivitySerializer,SharedTaskStateSerializer}.php`,
`tests/Feature/SharedTaskActivityTest.php`, and copied
`resources/js/{pages/learning/node-play.tsx,features/world/shared-task-activity.tsx,types/learning.ts}`.
Canonical source files remain unchanged.

| Source requirement | Rust reuse / concrete gap | Required boundary |
| --- | --- | --- |
| Every Shared Task activity carries initial `sharedTaskState` | `learner_shared_task.rs::state_for` already reads one active task; graph activities have no collaboration state | Batch the already-authorized published graph and reuse the same projection for command responses. Null for other types; real zero/empty state for tasks without submissions. |
| Activity-wide accepted count, latest submission, threshold, remaining/completion | Existing `learner_shared_task_submissions`, typed configuration and state | Aggregate by actual activity UUID, independent of current run or learner; never expose contributor identity. |
| Latest own accepted submission and one revision opportunity | Existing reader uses any received review to set `can_revise`, which can refer to an older submission | Match source `submission()` precisely: latest submission explicitly shared, unrevised, and that exact submission has a review. |
| Latest five explicitly shared contributions; latest revised body, 500-character snippets | Existing source-shaped state and project-step mapping | Preserve sharing opt-in, source ordering, revised-body selection and Unicode truncation; no unshared peer text or identity. |
| Peer review enabled only when authored sharing/review are enabled | Existing reader covers submitted review, five reviewable contributions, five received reviews and own follow-ups | Reviewable/received collections require own accepted submission. Reviewable snippets use original body. Received reviews and follow-ups stay contributor-scoped. |
| Checklist is private to learner/activity/run; duplicate/unsorted input is normalized | Existing private-state batch normalizes correctly; the typed writer incorrectly rejects duplicates and descending order | Reuse private-state read bounds, accept bounded source input, sort/deduplicate before persistence and return. Wrong-run/principal and unavailable-step writes remain rejected. |
| Source local activity selection, wrong-owner/unpublished/invalid run and read failure | Existing playback graph/run guards | Populate only the authorized graph. Failed state reads remain unavailable; no fallback success or activation of a partial copied player. |

The real-Rust regression also reproduced the checklist validation mismatch:
`LearningWorldController::updateSharedTaskChecklist` accepts up to six indexes,
and `LearnerActivityPlayStateService::updateSharedTaskChecklist` sorts and
deduplicates them. Rust now preserves that behavior; the request schema no
longer incorrectly requires unique indexes. Out-of-range/oversized input stays
400; a step outside the current authored brief stays 404, with existing state
unchanged. The source test sends `[2, 0, 2]` and expects `[0, 2]`.

`learner_shared_task_state.rs` now supplies `graph.activities[].shared_task_state`
and all existing collaboration command responses. The active-activity reader
reuses the graph value. It issues at most seven batch statements for the whole
bounded graph, skips absent kinds, and uses SQL limits of one own submission
and five snippets/reviews per task. Snippets are reduced to 500 Unicode
characters in SQL; received-review follow-ups join only this contributor's
notes. The pre-existing private-state checklist projection remains a separate
batch. No migration or canonical UI file changed.

Verified: canonical source identity and production frontend type/build,
OpenAPI client regeneration/consistency, Rust workspace check/format,
22 persistence playback tests, the updated application input regression,
and 20 real Rust/PostgreSQL checks across six run kinds and fourteen activity
types. `canonical-playback-shared-evidence.ts` proves inactive context, null/empty
states, bounded ordered snippets/reviews, Unicode original/revised-body rules,
sharing/review toggles, own versus peer state, revision eligibility on the exact
latest submission, checklist run isolation, mutation/read agreement, CSRF and
wrong-owner rejection, unpublished omission and invalid-config unavailability.
The initial graph-field regression and subsequent duplicate-checklist regression
both failed before their respective fixes.

Report: `frontend/playwright-report/player-shared-context/`. The populated task
read took 8 ms with 6028 state bytes; a graph with 100 additional empty Shared
Tasks took 18 ms / 150828 bytes. These local observations are not an SLA.
No UI changed; these are native contract checks, not desktop/narrow screenshot
parity. This prerequisite does not activate Shared Task UI or complete the copied player; typed command/identity/media
mapping and anonymous playback remain separate acceptance requirements.

### Player progress mutation response contract

Before implementation, source was checked at pinned main
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`:
`resources/js/pages/learning/node-play.tsx`,
`features/world/{activity-panel,standard-activities,item-obstacle-activity,obstacle-activity}.tsx`,
`app/Http/Controllers/LearningWorldController.php::{markActivity,recordActivityCheckIn}`,
`app/Learning/{Serializers/LearnerProgressSerializer,Services/LearnerProgressService}.php`.
The source completion/check-in callbacks replace local activity progress with
server-returned status, completion timestamp and metadata. A run-status-only
Rust acknowledgement cannot truthfully supply these values after the run has
become terminal and its active-run read returns 404.

| Source requirement | Existing Rust contract / missing data | Required typed response |
| --- | --- | --- |
| Completion returns the affected activity identity, status and stored first-completion timestamp | `LearnerPlaybackCompletionResult` contains only run ID/status; six branches cover ordinary, message, portal-arrival, revisit, recall and replay | Read the affected principal/activity state in the same transaction before commit. Return actual persisted progress or null, never a browser timestamp or invented durable completion. |
| Completion follows authored transition; terminal edges stay null | Ordinary/message completion already resolves the next activity under lock, but omits its ID from the response | Return that actual `next_activity_id`; isolated recall/replay/revisit/arrival runs return null. |
| Check-in response retains progress and obstacle state | `LearnerActivityCheckInResult` returns the saved observation only | Include the same typed activity-state receipt after the check-in/revisit scheduling write. |
| Source progress metadata restores item-obstacle slots/lock and base-obstacle destruction | Private graph state already reads normalized records; source consumes `metadata.itemObstacle` and `metadata.obstacle.destroyedAt` | Reuse typed normalized obstacle state and resolution timestamp. A future mapper translates only these audited fields; arbitrary metadata is not a new API. |
| Recall does not create ordinary activity/route progress or evidence | ADR-037 and existing native recall completion deliberately preserve this boundary | Receipt reports absent progress as null and returns existing progress unchanged when present. Full copied recall/check-in transport compatibility remains a separate unresolved requirement; do not fake ordinary progress to activate it. |

The entry/progress transport audit also confirms remaining work: the source
posts `status: reached` before reading translation; locally selects the next
activity after completion; restarts via a returned URL; and completes an output
portal before visiting its target. Native output portals complete through the
atomic travel command, so blindly forwarding the source completion call to
ordinary `/complete` cannot work. Resolve these typed lifecycle seams before
mounting the whole player, alongside every activity command and native UUID
identity conversion. This slice adds response facts only, not a partial player
or a generic progress writer.

**Verified:** all six completion branches and the check-in command now return
the authorized principal's actual activity state from their write transaction.
`learner_playback_activity_state.rs` uses one joined query; an existing item
obstacle record adds the two existing bounded slot/state reads. No database
migration, canonical UI change or generic metadata writer is introduced.

The new native regression first failed on the absent receipt. The 20 live
checks in `canonical-playback-contract-live.spec.ts` and
`canonical-playback-reference-live.spec.ts` then passed against the rebuilt
local Rust backend and PostgreSQL (20.8 seconds). They cover advancing and
terminal runs, server-selected destinations, preserved first-completion time
after reset, owner isolation and CSRF, recall's absent ordinary progress,
all six run kinds, and item/base obstacle state surviving completion and
check-in after the active-run read becomes unavailable. Reports are retained
in ignored `frontend/playwright-report/player-progress-receipts/`.

Canonical identity, frontend production type/build, generated OpenAPI client,
Rust workspace check/format, 22 focused persistence playback tests, three
application playback tests and one check-in application test passed. These
are native contract checks; no desktop/narrow UI parity claim or player
activation is made by this prerequisite.

### Whole copied player lifecycle integration (in progress)

Next integration owner is the entire pinned `pages/learning/node-play.tsx`,
with `features/world/{activity-panel,learning-check-in,active-activity}`,
`features/localization/activity-translation`, `layouts/app-layout.tsx` and its
existing learner shell dependencies. These and the owning
`LearningWorldController`, `LearnerProgressService` and
`LearnerProgressSerializer` match pinned main. Reuse the existing activity
children and transport adapters; do not build another player presentation.

| Source boundary | Existing Rust mapping | Required integration / incomplete rule |
| --- | --- | --- |
| Initial page and private state | `GET /learner/play-runs/{run}`, existing `toPlaybackPageProps`, current user, shell, platform translations, sound preferences and Companion | Bind the actual document for the whole copied page and layout. Initial missing/dead run is unavailable; do not fabricate initial activity, shell or progress. Explicit route entry is covered below; entry without both run and route, and anonymous read, remain required contracts. |
| Active activity reached, then translation | `POST .../activities/{id:UUID}/reach`, `GET .../translation` | Source `status: reached` selects only this typed entry command. Source translation handling retains original copy on unavailable/stale reads. |
| Completion and local continuation | Existing typed `/complete`, actual activity-state/next-target receipt and child-specific completion adapters | Parent must reuse real completion receipts, including completed terminal runs; browser outcome/attempt/calibration cannot overwrite evaluated Rust facts. Output-portal travel is an atomic native command, not ordinary completion. |
| Optional check-in | `POST .../check-ins`, existing state receipt | Bind the run from the exact active page because the source request has no run field. Preserve skip/hide/draft/error behavior. Ordinary and completed replay/revisit/arrival scopes are supported below; Recall remains excluded. |
| Restart and alternatives | `/learner/activity-starts/{id}/reset` and `/start` | Preserve returned real run/node/start identities and source URLs. Source `route.id > 0` requires an opaque-ID compatibility seam. No invented numeric IDs or fabricated redirect receipt. |
| Bookmark | Existing map/node-slug bookmark POST/DELETE | Resolve IDs/slugs from the actual page document, and return the actual boolean. Do not require a fabricated full World snapshot to update one bookmark. |
| Companion activity reload | `loadCompanion({surface:'activity', activity_id, play_run_id})`; verify its returned run identity | Replace only the page's exact `only:['companion']` reload; preserve local page/check-in state and reject stale reloads. The bounded explicit run contract and retry/cancellation behavior are verified below. Generic Inertia reload emulation is not permitted. |
| Recall completion/check-in | ADR-037 forbids ordinary progress/check-ins; native completion returns null ordinary progress | The source parent dereferences a progress receipt and can open an ordinary check-in. Reconcile this actual source/accepted-contract conflict explicitly; do not fabricate persisted progress or silently write forbidden Recall evidence. |

The first browser integration must mount the whole copied page and layout,
compare against the whole pinned source tree, and prove reached→completion→
check-in→next activity→terminal navigation plus restart/bookmark/refresh and
failure retention at both viewports. A successful child harness does not
establish these page transitions. Production activation stays unavailable
until all entry/run kinds, portal and anonymous contracts pass acceptance.

**Implemented ordinary-run integration:** `frontend/src/platform/playback-page-bootstrap.ts`
loads the real run, current user, shell, translation, sound and Companion
contracts, then claims the existing feedback invitation. It checks the URL's
node/start against the authorized run before any claim or player write.
`playback-page-api.ts` binds these page commands to that actual document and
reuses the existing completion/answer/NPC adapters. Restart reads the returned
new run before constructing the unchanged source destination. The two exact
Vite seams in `playback-page-source-transform.ts` replace Companion-only reload
and the numeric alternative-route test; no source JSX, styling or files change.

`frontend/e2e/canonical-player-page-live.spec.ts` mounts the entire copied
`node-play` and `AppLayout` against the entire pinned source tree. Its native
Rust/PostgreSQL journey covers reached state, bookmark and refresh, restart,
completion, hide/show check-in, retained private notes after an actual 404,
retry, local next-activity movement without document reload, skipped check-in
and terminal World navigation. Missing runs and mismatched URL node/start
identities render unavailable without issuing writes. The subsequent scoped
entry integration below extends this test to click alternative routes and
start/resume them from the exact source URL without a run parameter.

**Open source usability defect:** at 390×844, the pinned full-page `Player
actions` floating toolbar covers the center of both the transition and terminal
continuation buttons. The same obstruction is asserted in both source trees;
the test then uses actual keyboard focus/Enter to verify persisted lifecycle
behavior. This is not pointer-control acceptance or an extension of the
previous Welcome-only source-defect waiver. Check-in content scrolls inside
its source container; failure text is scrolled into view for evidence, where
the same toolbar also obscures part of the inline error. Bounded geometry
therefore does not establish unobstructed visibility. The
canonical source is unchanged. Production player activation remains closed.

Remaining whole-page gates include entry without both run and route,
anonymous playback, nonordinary entry/local restart/authored continuation,
Recall's accepted-contract conflict, other completed-run refreshes and automatic
arrival failure recovery. Ordinary atomic output-portal travel and Companion
reload failure/recovery are now verified in their dedicated sections below. The
evidence host is not a production resolver or a claim that the route family
is complete.

**Verified:** four whole-page journey/failure checks passed at 1440×900 and
390×844 against local Rust and PostgreSQL (36.2 seconds), with source/copy
screenshots in ignored `frontend/playwright-report/player-page-final/`.
The 42 existing response, NPC and Markdown browser checks also passed
(`player-page-regression/`). Canonical source identity, frontend production
types/build and generated OpenAPI drift passed; 182 API tests passed (two
opt-in tests ignored), alongside 26 persistence playback and three application
playback tests. This slice changes no Rust contract or production routing.

### Scoped copied player route entry

Pinned `LearningWorldController::{play,routeFromRequest}` resolves an explicit
route under the URL node before starting/resuming it, then redirects using the
actual run. Copied `node-play.tsx` alternative links omit `run`. Existing native
`POST /learner/activity-starts/{start_id}/{start,reset}` authorizes the start but
has no node-context predicate. Do not fetch the entire World just to validate
one link, or start a different node's route before detecting the mismatch.
Extend those existing commands with an optional typed `node_id` query guard,
checked inside the write transaction before any progress change. Old callers
remain compatible; copied page entry/reset always supplies its actual node.
After start/resume, read the authorized run and construct the same source URL
from its real node/start/activity IDs. Explicit run reads still validate the
URL context. Entry without either a run or an explicit route, anonymous entry,
and other run kinds remain open acceptance work.

**Implemented:** the optional UUID guard is part of both existing OpenAPI
commands and is enforced in the indexed start-resolution query inside the
transaction. It adds no query, World snapshot read, table or fabricated node
projection. Unknown, duplicate or malformed query fields return 400; a
different node returns 404 before creating, resuming or resetting progress.
Omitting the guard preserves existing native callers. The copied page loader
now starts/resumes an explicit route with its URL node, reads the actual run,
and lets the source replace its own URL. Reset sends the same node guard.
The evidence router remounts only for an actual route navigation; local
activity history replacement still retains check-in state.

The native regression first reproduced an incorrect 200 for a mismatched
node. The extended whole-page test then verified real alternative-link clicks,
a new alternative run, refresh, return to the unchanged original run, and
restart at both viewports in both source trees. It also checks malformed and
duplicated query fields, unknown principal fields, missing CSRF, and unchanged
stored progress after rejected start/resume/reset requests. A failed page
entry is explicitly unavailable and cannot change the existing run.

The broad native regression also exposed a pre-existing portal-arrival 503:
its SQL still decoded the shared `CurrentActivityRow` after Markdown work had
added required node-availability fields to that row. Portal completion uses
only activity/principal IDs. A dedicated `PortalArrivalCompletionRow` now
matches that query and preserves its existing authorization and transaction.
The live contract check additionally asserts the completed arrival record,
timestamp and owner alongside the persisted progress receipt. This repairs
native arrival completion; output-portal travel and whole-page portal
integration remain separate gates.

**Verified:** four extended whole-page source/copy journeys passed at both
viewports (44.9 seconds; ignored `frontend/playwright-report/player-entry-verified/`).
All 20 native playback/reference regressions passed after the portal repair
(42.0 seconds; `player-entry-contracts-final/`). Canonical identity, frontend
production types/build, generated-client drift and Rust workspace check/format
passed. Rust verification passed 183 API tests (two opt-in ignored), 129
persistence tests (six opt-in ignored), the route-command application test,
and 26 focused playback persistence tests after the portal repair. Local
Compose was rebuilt and readiness returned 200. There is no migration or
production route activation in this slice.

### Completed nonordinary player check-ins and Companion context

Pinned `LearningWorldController::recordActivityCheckIn`,
`LearnerActivityAccessService::assertCanPlay`,
`LearnerProgressService::recordCheckIn` and `LearnerProgressSerializer` require
currently playable content and the principal's completed activity. The source
check-in is not restricted to an authored route. ADR-032 requires a server-owned
run; ADR-033 and ADR-040 keep revisit/replay independent of authored progress;
ADR-037 explicitly excludes Recall. Reuse the existing normalized check-in
writer and bounded history, with a completed-run authorization path for replay,
revisit and portal arrival. Each such run authorizes its one actual activity,
never another activity on the same map. Recall must remain unavailable even
when ordinary progress exists. Reuse the existing evaluated node-availability
service for both ordinary and nonordinary check-ins before writing; publication
and map roles alone do not satisfy the source's `canPlay` check.

The six whole-page revisit/replay/arrival checks then exposed a missing
Companion contract: its read infers only ordinary active routes, while the
pinned `LearningCompanionContext::forActivity` receives the actual page run.
Extend the existing Companion document/avatar query with an optional activity
`play_run_id`, resolving an owned ordinary/replay/revisit/arrival run and its
actual activity before returning context. A one-activity run has no authored
route reference; retain null rather than inventing one. Preserve the old
inferred ordinary context when no run is supplied. Reuse that ownership check
for the existing typed Companion turn; Recall stays excluded while its wider
page contract is unresolved. Invalid explicit contexts must be unavailable,
not disguised as disabled Companion or rewritten by the frontend.

**Implemented:** `learner_check_in.rs` preserves the existing ordinary-run
resolution and adds at most three indexed, fixed-table lookups for completed
replay/revisit/arrival runs. Each locks the owning run and completed activity
progress before using the same private history/scheduling writer. Evaluated
node availability is loaded once; locked/hidden places cannot accept a note.
No schema migration, authored-route progression or evidence write is added.
The page adapter permits these real receipts and native input-portal completion;
output portals and Recall still require their separate contracts.

`learner_companion.rs` now resolves explicit activity runs from their actual
owned records. The existing implicit ordinary-context behavior is preserved.
The same bounded read validates document, selected avatar and typed turn
context; missing/foreign/wrong-activity run contexts return unavailable rather
than a substituted ordinary run. Nonordinary context has a real run UUID and
null authored-route reference. The copied page passes its actual run for initial
Companion loading and subsequent activity-only reloads. Native off-level turns
verify the expanded ownership boundary without invoking an external provider.
Recall Companion requests are rejected, and Recall check-ins remain rejected
even when separate completed ordinary progress exists.

**Verified:** 26 checks passed against rebuilt local Rust/PostgreSQL (1.7
minutes): six native playback cases, six whole copied replay/revisit/arrival
page comparisons, four ordinary-page journeys/retries, and ten existing
Companion/media checks. `canonical-playback-check-in-evidence.ts` covers owner
isolation, CSRF, incomplete runs, locked/hidden nodes, actual persisted notes,
three-day revisit scheduling/clearing and unchanged authored-route/evidence
state. `canonical-player-completed-run-live.spec.ts` covers both source trees
at 1440×900 and 390×844, completion, retained notes after a real locked-place
404, retry and terminal navigation. All 12 initial/failure screenshot pairs
are byte-identical; desktop and narrow evidence was visually inspected.
Reports are in ignored `frontend/playwright-report/player-completed-runs-verified/`.
An additional real-media replay check passed (2.6 seconds;
`player-run-avatar-verified/`): the selected avatar URL retains the actual run,
delivers the original bytes only to its owner, rejects guest/foreign/forged-run
and wrong-asset reads, and removes its fixture after map cleanup.
Canonical identity, frontend production types/build, generated-client drift,
Rust workspace check/format, 183 API tests (two opt-in ignored), 129 persistence
tests (six opt-in ignored), three Companion application tests and the check-in
application test passed.

These are completed-activity/check-in and scripted Companion acceptance paths,
not full nonordinary route-family acceptance. Their entry writers, the source's
local `From beginning` behavior and outgoing transitions versus isolated-run
semantics, provider-backed assistance, Recall and output-portal travel still
need end-to-end reconciliation. The mobile toolbar obstruction remains an open
source defect pending an explicit decision; the production player resolver
remains unavailable.

### Player Companion refresh recovery

Pinned-source owners: `resources/js/pages/learning/node-play.tsx`,
`components/app-side-action-bar.tsx`, `features/world/learning-companion-{panel,dialogue}.tsx`,
and the complete copied `components/{alert-error,ui/button}.tsx` primitives.
The source page requests only `companion` after its local activity changes;
`onSuccess` updates its context reference and `onFinish` clears the pending
reference. Installed Inertia 3.11's `Response.handleNonInertiaResponse` shows
a framework error without replacing the page; cancelled requests do not
publish success. The replacement must retain that partial-update boundary,
not remount the player or fabricate an empty/disabled Companion on failure.

`playback-companion-refresh.ts` owns the exact activity/run refresh lifetime.
It retires the prior Companion turn binding immediately, cancels superseded
reads, and applies only the latest actual projection. Failed HTTP/network
reads keep the source request pending for an explicit retry; duplicate retry
clicks share one attempt. Success (including a genuine native 204 disabled
response) completes the source callback once. Navigation/disposal settles a
cancelled operation without success, aborts in-flight turns and ignores late
responses. This cancellation prevents stale browser delivery; it does not
claim to undo a server action already accepted before cancellation.

`playback-companion-recovery.tsx` composes the whole copied error/button
primitives as a bounded platform transport-error region. It is framework
failure UI, not a replacement player or a fabricated Companion prop. The
normal source layout, controls and check-in state stay mounted and usable.
The error can be dismissed (including while retrying), cancelling this partial
reload without pretending it succeeded. This restores access to navigation
under the narrow error notice; the real-stack test continues through the
source check-in and return-to-map controls after dismissal. A later activity
change can load its own new context normally.
`companion-api.ts` revokes retired projection objects and combines request
cancellation with their lifetime; stale objects cannot issue another turn.
There are no backend, OpenAPI, canonical-source or production-resolver changes.

The new real-stack `canonical-player-companion-reload-live.spec.ts` first
failed on the missing error region. It runs the complete pinned-main and
copied player/layout trees at both viewports, with actual Rust entry,
completion, scoped Companion reads and private progress. Only the two failed
refresh attempts are injected (HTTP 503, then network failure). Recovery reads
the real second-activity/run context, displays it in the source Companion
panel, keeps the unsaved check-in draft and URL/run, and sends no document
reload. Screenshot attachments cover failure and recovery for both trees.
The shared platform error boundary is not claimed as Laravel error-page
pixel parity. Focused Companion regressions cover in-flight turn cancellation,
revoked objects, superseded/late reads, duplicate retry clicks, genuine disabled
responses, and disposal without late state updates.

Verification: canonical identity and production frontend type/build passed,
with unchanged generated OpenAPI/client output; Rust fmt and five focused
application/API Companion checks passed. The combined player/Companion/media
suite passed 24 checks, then all changed Companion/recovery tests passed again
(15 checks, 26 seconds) after adding dismissal. The four failure/recovery
source/copy screenshot pairs were byte-identical. Desktop recovered context
and narrow error screenshots were visually inspected; the existing mobile
source toolbar obstruction remains open. Reports are in ignored
`frontend/playwright-report/player-companion-recovery-{verified,final}/`;
rerun the named browser files with the existing 8084 learner evidence host.

### Output portal departure contract audit

Pinned owners: `resources/js/pages/learning/node-play.tsx` (`markCompleted`,
`travel`, `continueAfterCheckIn`), whole `features/world/standard-activities.tsx`
(`PortalActivity`), `app/Http/Controllers/LearningWorldController.php`
(`markActivity`) and `app/Learning/Services/LearnerActivityAccessService.php`.
Laravel owner files match the pinned SHA; the canonical identity gate covers
the copied React files. ADR-053 retains atomic departure plus an independent
arrival run, without starting or resetting an authored target route.

| Source requirement | Existing Rust evidence / necessary adapter | Audit finding |
| --- | --- | --- |
| `onComplete(activity)` resolves before `onTravel(link)`; the parent consumes actual completed progress and opens the optional departure check-in | `POST /learner/play-runs/{run}/activities/{activity}/portal/travel`; `persistence/src/learner_portal.rs`; shared `learner_playback_activity_state::load` | `playback-portal-api.ts::completeOutputPortal` uses the actual departure receipt, coalesces requests in the owning page and retains only a successful native result. It never synthesizes completion time or sends ordinary `/complete` first. |
| Current departure must remain playable | Source `assertCanPlay`, `PostgresLearnerNodeAvailability` | Initial travel and the idempotent arrival branch now revalidate both source and destination, including publication and role scope. |
| Source optional check-in before navigation | Existing run-scoped check-in writer, completed departure progress and `playback-page-api.ts` | Reuse the owned source run; a failed check-in retains its draft and pending destination. Skipping makes no check-in write. |
| Source target node/activity URL | Native travel's opaque arrival ID plus existing `GET /learner/play-runs/{run}`; `navigatePlaybackPortal` replaces exactly two page visits | Validate the source link against the mounted graph and the actual arrival's run kind, node, map, activity, input mode and absent route start. Build the source URL with its real opaque run. No target authored route is started or reset. |
| Unavailable destination, failed travel, duplicate click/retry | Native 401/403/404/503 boundaries; source `isTravelling`; `performPortalAction` and `PlaybackPortalRecovery` | The exact source async click and two visits have a dismissible framework error boundary made from whole copied AlertError/Button components. Failed travel cannot open a check-in or navigate. A failed arrival read retries only that read, preserving the already-saved departure/check-in. No source markup or styling is changed. |
| Refresh after departure, before arrival | Source `LearningPlayRunService` accepts the owned current run even when completed; bounded native playback read extension | Permit only a completed ordinary output portal with its owned arrival still in progress. It retains real completed progress and the original run, so Traverse recovers the same arrival idempotently. Once the arrival completes this departure read closes; other completed-run lifecycle contracts remain open. |

**Verified native prerequisites:** the locked-departure regression first
returned 200 instead of 404. Initial travel now evaluates departure state, and
the idempotent branch rechecks departure node/MapAsset/route/activity
publication, role access and current playability. That branch locks the owned
arrival and completed activity progress in the read transaction. Both success
paths reuse `learner_playback_activity_state::load` for the new typed
`departure_state` receipt; an unexpected route-update failure rolls back
instead of committing a partial completion. No schema migration is needed.

The real Rust/PostgreSQL portal case in
`canonical-playback-reference-live.spec.ts` now proves locked/hidden departure
rejection leaves route state unchanged and creates no arrival; successful
travel returns actual completed progress; retries return the same receipt and
arrival; revoked source node, activity, asset or route publication rejects
retry; restored access retains exactly one arrival and one route completion.
The existing peer/wrong-activity/CSRF checks still pass. A private departure
check-in persists against the original run and preserves its completion time.
The focused native test passed against the rebuilt local image. Rust workspace
check/fmt, 183 API tests (two ignored), one portal application test, 26 playback
persistence tests, canonical identity, frontend production type/build and
generated OpenAPI/client drift all passed. The whole copied integration now
uses these native prerequisites as described below.

**Whole copied output-portal integration:** `playback-portal-api.ts` is bound
and released with the owning player document. Its single in-flight source
action prevents duplicate callbacks, its departure promise cache discards
failed/ambiguous requests, and departure writes/arrival reads share the page's
abort lifetime.
A dropped response after Rust commits is retried through the native idempotent
command. Arrival navigation verifies an actual successful read and current
access; it never trusts a target supplied by the browser. A failed arrival
read does not repeat a successful travel or optional check-in. Navigation
away aborts pending transport and prevents late navigation. The two source
visits and one async portal click are the only new Vite seams; whole source
components, source local state, authored presentation and URLs remain owned by
the pinned tree. The framework error region is not claimed as Laravel's exact
error-page presentation.

The first whole-page regression failed because output completion was explicitly
unavailable. A subsequent refresh regression reproduced the closed completed
departure read. The read extension is restricted to an owned pending arrival,
retains source access checks, and exposes actual stored state. Browser evidence
uses the entire pinned-main and canonical page/layout trees, checks the entire
reference React/CSS tree against the pin, and compares both viewports. Native
travel, check-in, arrival completion and target route progress use real local
Rust/PostgreSQL. The only injected fault is dropping one successful travel
response after the real command commits.

`canonical-player-portal-live.spec.ts` covers ordinary departure, refresh before
arrival, actual source completion/check-in, manual and automatic arrival,
skipped check-ins, locked destination rejection, dismiss/retry from the source
control, lost-response recovery, retained draft after rejected check-in,
revoked arrival read/retry, and arrival refresh/completion/return-to-map. It
asserts one departure completion and unchanged independent target route
progress throughout. Retry/dismiss controls are visible, bounded and hit-tested.
The existing mobile source toolbar obstruction is identified before keyboard
fallback; it remains unaccepted pointer behavior. Source/copy screenshot
attachments cover departure, check-in, arrival and both transport failures.
Production player activation stays closed until the remaining family gates
are satisfied. Completed arrival refresh remains open; the automatic-arrival
failure contract is handled by the bounded refinement below.

Verification: 40 real-stack browser/contract checks passed (2.6 minutes),
covering all six native run kinds, fourteen activity types, ordinary and
nonordinary whole-player flows, Companion recovery and the six new portal
scenarios. Canonical source identity, production frontend type/build and
generated OpenAPI/client drift, Rust
workspace check/fmt, 183 API tests (two ignored), 26 playback persistence tests
and one portal application test passed. The source/copy evidence has 22 portal
screenshot pairs: 21 are byte-identical; one automatic-arrival narrow pair
differs in five pixels confined to the check-in heart icon, with no observed
layout difference. Desktop arrival, narrow arrival and narrow failure controls
were visually inspected. The ignored report is
`frontend/playwright-report/player-portal-page-final/`. Reuse the 8084 learner
evidence Vite host and run `canonical-player-portal-live.spec.ts`, the two
`canonical-playback-{contract,reference}-live.spec.ts` files, and the ordinary,
completed-run and Companion-reload whole-player live suites. Restart that host
when changing its Vite transforms; HMR is disabled for source evidence.

### Automatic portal arrival recovery

Pinned owners: `resources/js/features/world/standard-activities.tsx` (the whole
`PortalActivity` effect and its original continuation),
`resources/js/pages/learning/node-play.tsx` (completion, check-in and map URL),
and the shared player layout already listed above. The source effect catches
a failed completion without exposing a retry, leaving its automatic-arrival
copy visible. No canonical source bytes or JSX are changed.

| Required contract | Rust/adapter evidence | Acceptance requirement |
| --- | --- | --- |
| Complete only the owned input-portal arrival under current access | `persistence/src/learner_playback.rs::complete_portal_arrival`; existing `completeLearnerCurrentActivity` | Recheck evaluated node playability as well as map roles and every publication boundary before writing. The new regression reproduced a locked destination incorrectly completing with HTTP 200. |
| Recover a lost successful completion response | Same command, locked arrival row and existing activity receipt | Completed arrival retries repeat authorization and return stored completion without changing arrival/progress timestamps or another authored route. No fabricated completion or new arrival is allowed. |
| Retry the source automatic effect | `playback-page-source-transform.ts`, `playback-portal-api.ts::completeAutomaticPortal` | Replace only the exact `void onComplete(activity)` transport invocation; the source `.then` continuation and `.catch` remain intact. Keep its promise pending through transport errors. |
| Leave an unavailable automatic arrival | Existing `PlaybackPortalRecovery` and actual document map/node slugs | Offer bounded Retry portal / Return to map controls. Returning rejects the pending source promise and uses the source World URL; it does not complete the arrival. |
| Retire a player document | `completeInputPortal`, `playback-completion.ts`, existing document release | Input completion shares the bound page AbortSignal and rejects an aborted receipt before invoking source completion. Other activity commands keep their existing signatures/behavior. |

The whole-page regression extends `canonical-player-portal-live.spec.ts` with
real locked-arrival rejection, actual completion followed by a dropped response,
retry, and return-to-map. Completed retries are also checked against another
principal, wrong activity, missing CSRF, revoked map roles, locked destination,
and unpublished map/node/MapAsset/route/activity. It compares complete stored
arrival/progress rows before and after retries and preserves independent target
route progress. Both source trees and both viewports are exercised. The four
new real-stack cases passed, with 14 byte-identical source/copy screenshot
pairs. Desktop and narrow error panels were visually inspected; both actions
are inside the viewport and hit-tested. The initial new test caught locked
arrival completion returning 200. After implementation, test assertions were
corrected to wait for the actual retried request/check-in and to preserve the
source's legitimate reached progress rather than expect no row at all.
Completed-arrival refresh and the inherited narrow toolbar obstruction remain
open; this refinement does not activate production NodePlay.

Verification: canonical identity (299 files plus CSS), frontend production
TypeScript/build, generated OpenAPI/client drift, Rust workspace check/fmt,
26 persistence playback tests, 183 API tests (two ignored) and one portal
application test passed. The combined 44-case real-stack run passed 43 checks;
its sole failure was the pre-existing assertion that repeated portal completion
must return 404. That assertion now requires the same complete receipt for
portal arrivals, retaining 404 for other run kinds. All six native contract
cases passed on rerun (16.6 seconds); the 38 other combined checks passed
without changes. All 36 portal screenshot pairs in the combined report are
byte-identical. Evidence reports are ignored under
`frontend/playwright-report/player-auto-portal-final/` and
`frontend/playwright-report/player-auto-portal-contract-final/`.


### Verified current completed ordinary-run refresh

Source evidence: pinned `LearningWorldController::play`,
`LearningPlayRunService::{currentRunId,canUseRunForUser}` and
`LearnerRouteProgressService::progressForNodeRun` accept the principal's current
run without excluding its completed status. Whole copied
`pages/learning/node-play.tsx` and `OpenPracticeActivity` in
`features/world/standard-activities.tsx` reload the actual terminal activity;
Continue requests its completion receipt before opening the optional check-in.
The new desktop whole-page regression reproduces unavailable playback after
refreshing the completed second activity.

| Contract | Existing Rust evidence and missing behavior | Required verification |
| --- | --- | --- |
| Read the current completed ordinary run | `learner_playback.rs` previously filtered ordinary reads and private question/obstacle/dialogue readers to in-progress; current completed non-portal reads now reuse those same authorized projections | Allow current completed non-portal ordinary runs under existing publication, ownership, evaluated availability, graph and bounded configuration gates. Never resurrect a superseded run UUID. |
| Continue from a refreshed terminal activity | Existing `/complete` retains active writers and now shares `completed_route_receipt` with reached | Return the actual already-completed receipt idempotently, without re-running completion writers, adding evidence, resetting progress or incrementing completion count. Wrong owner/activity, revoked access and CSRF remain rejected. |
| Copied page/bootstrap and check-in | Existing page projection, Companion completed-run context and owned check-in writer | Refresh → same terminal activity/run → Continue → check-in → World at both viewports, with source screenshots and unchanged route progress. |
| Reached → translated copy after refresh | `learner_playback_reach.rs` and `learner_activity_translation.rs`; source `node-play.tsx` fetches translation only after reached succeeds | Return existing completed state without entry/progress/topic writes, then allow the current owned non-portal translation read. Verify actual stored translated title after refresh; success with only the default language is insufficient. |
| Other run kinds and portal travel | Separate accepted Recall/revisit/replay/arrival contracts | Do not broaden their mutation permissions or turn an output portal into ordinary completion. Their remaining refresh/continuation gaps stay explicit. |

Implementation reuses the current ordinary route row and private presentation
readers for thirteen non-portal activity types; the message topic binding
remains required. `completed_route_receipt` locks and reauthorizes that current
completed route, requires its actual completed activity fact, validates bounded
configuration, and returns the existing receipt. Completion and reached share
this no-write path. The translation reader keeps the same current-activity,
publication, principal and evaluated node-availability gates.

The original whole-page refresh regression failed on unavailable playback.
After the first reader/receipt implementation, all 44 existing/extended checks
passed, but source inspection identified the reached → translation dependency
that default-language screenshots did not prove. A new stored-translation
whole-page regression then failed at the untranslated title after refresh.
That dependency is included in the verified slice. The final fourteen native
activity-reference checks cover all thirteen completed non-portal readers,
stored completion/reached receipts, translation availability, locked-node and
owner rejection, CSRF, superseded runs, and unchanged ordinary route rows.
Stored terminal reader fixtures are distinguished from the whole-page cases,
which use actual completion commands before refresh and check-in. The four
whole-page cases pass at both viewports, including a real saved translated
title after refresh and unchanged completion count/timestamps after Continue.
The six native run-kind contract cases also pass, retaining other run kinds'
closed completed reads and the separate portal rules.

Final verification: 18 affected browser/native checks passed (1.5 minutes),
then six run-kind contract checks passed (16.6 seconds); the broader 44-check
set had passed before the reached/translation refinement. Canonical identity,
production frontend type/build, OpenAPI/client drift, Rust workspace check/fmt,
26 persistence playback tests and 183 API tests (two ignored) passed after
that refinement. The local combined completed read/receipt measurements were
15–37 ms across the thirteen types; these are fixture observations, not an SLA.
Both new completed-refresh screenshot pairs are byte-identical and were
visually inspected. Of sixteen total whole-page pairs, fourteen are identical;
the other two narrow check-in pairs differ in three icon pixels at the same
small bounds, without a layout difference. The inherited mobile toolbar still
obscures Continue and remains an open source usability limitation; keyboard
coverage is not pointer acceptance. Reports are ignored under
`frontend/playwright-report/player-completed-translation/` and
`frontend/playwright-report/player-completed-translation-contract/`.
Production NodePlay remains unavailable; no canonical source file changed.

### Clean-URL player return

Pinned source: `pages/learning/node-play.tsx` persists
`features/world/active-activity.ts::persistActiveActivity` with
`useCleanPlayHref: true`; shared `LearnerSurfaceNavigation` returns to that
bare `/learning/nodes/{id}/play` URL. `LearningWorldController::play` uses
`LearnerRouteProgressService::progressForNode` when no explicit run is supplied:
prefer an in-progress route by descending last-entered/created time, otherwise
choose the most recently updated current route. The whole copied-page desktop
regression reproduces unavailable entry when following that exact saved URL.

| Contract | Source/Rust mapping | Required evidence |
| --- | --- | --- |
| Resolve a clean node URL without creating another run | New bounded `GET /learner/nodes/{node_id}/resume`, returning existing `LearnerPlaybackDocument`; reuse `PostgresLearnerPlaybackRepository` after selecting the caller's current ordinary run | Prefer unfinished work over a more recently completed route; within unfinished work prefer latest entry. When all are completed, use latest update. Return exactly that run, never silently choose an older available route if the selected one fails its read gates. |
| Ownership, publication and availability | Actual principal/node-scoped selection followed by the existing playback graph/configuration/access gates | No progress, another principal, wrong node, locked/unpublished selected content and stale data remain unavailable. No supplied principal or activity can select another learner's run. |
| Source URL/history/local state | `playback-page-bootstrap.ts` consumes the typed resume document when run/start are absent; copied page restores its own full URL | Follow the actual persisted clean href at both viewports using whole main/copy trees; retain the saved activity and run and issue no start/reset command. |
| Bounded persistence | One principal/node lookup with LIMIT 1; additive principal/node index; existing bounded playback reader | Record local timing and verify the index/migration, with no history or route-progress mutation in selection. Existing playback visit bookkeeping remains unchanged. |

A clean URL with no ordinary history still has no projection. New implicit
entry without an authored start, direct `activity_id` entry, anonymous entry and
nonordinary return selection are separate unresolved source contracts; this
lookup must not invent a default route or treat those cases as completed.
Production NodePlay remains closed until the complete family is accepted.

**Verified:** `canonical-player-node-resume-live.spec.ts` exercises actual local
Rust start/completion commands and PostgreSQL: latest unfinished selection,
unfinished-over-completed ordering, latest completed selection, no history,
wrong node, principal isolation, anonymous rejection, superseded runs and
locked/unpublished/role-restricted selected content without fallback. Every
resume checks that route-progress rows remain unchanged. Migration 0115 and
the principal/node index were applied and verified on the local test stack;
the index is additive and may remain when rolling back to the previous binary.
Local reads took 6–7 ms in the final run; this is not a production benchmark.

`canonical-player-page-live.spec.ts` follows the actual source-persisted clean
href in both whole source trees at 1440×900 and 390×844. It retains the current
activity/run/start, sends no start/reset command, rejects an unsupported
activity-only query, and verifies a bounded unavailable state for a clean URL
without resumable history. The final run, including
`canonical-playback-contract-live.spec.ts`, passed all 11 tests. Of 16 screenshot
pairs, 15 are pixel-identical; one existing narrow check-in pair differs only
in the small icon region `(358,553)–(361,555)`. Both clean-return screenshots
are identical and were visually inspected. The inherited mobile toolbar
overlap remains an open source-defect acceptance limitation; keyboard fallback
does not prove pointer usability.

Frontend canonical identity, production type/build, generated OpenAPI client,
Rust formatting/workspace checks, four application tests, 183 API tests and
129 persistence unit tests passed (two API and six persistence database tests
are explicitly ignored by the unit suites; the live coverage above ran against
the migrated database). Local evidence:
`frontend/playwright-report/player-node-resume-final/`. No copied presentation
files or production routing changed.

### Authored-start activity-query entry

The pinned World `startNode`
constructs `?activity={id}` with an optional `route`. The controller's
`routeFromRequest` resolves `activity` to an existing authored start within
that node, with explicit `route` taking precedence. This is distinct from
`requestedActivityFromRequest`'s `activity_id`, which can request an activity
without an authored start (`DashboardTest.php`, “learners can open a requested
activity within a playable node”). The latter, anonymous entry and no-history
default entry still need their own bounded read/write contracts. Do not
manufacture an authored start to satisfy them.

The typed `POST /learner/nodes/{node_id}/activities/{activity_id}/start`
(`startLearnerNodeActivity`) resolves the actual authored association under a
shared row lock inside the existing start/resume transaction. The existing
unique `(node_id, activity_id)` index bounds the lookup; no migration or extra
authored route is needed. The same command rechecks publication, ownership,
map roles and evaluated availability. `playback-page-bootstrap.ts` maps only
this exact entry seam, verifies the returned start/run against the read, and
retains explicit `route` precedence. Copied World/player URLs and JSX remain
unchanged.

**Verified authored-start alias:** The desktop browser regression failed on
this exact source URL before the adapter. The final live suite passed all 11
cases, including the six existing playback run-kind contracts; the four
whole-page cases passed again after adding immediate-entry screenshots.
`canonical-player-node-resume-live.spec.ts` now starts actual runs through the
alias and verifies explicit-start compatibility, repeated resume, principal
isolation, missing authored association, wrong node/activity, malformed ID,
anonymous/CSRF rejection and unpublished/locked/role-restricted failures
without progress changes. `canonical-player-page-live.spec.ts` enters both
whole source trees with `activity`, checks explicit-route precedence, then
continues the existing start/reset/refresh/check-in lifecycle at both sizes.
Immediate-entry pairs are pixel-identical and visually inspected. The final
18 screenshot pairs include 15 identical pairs and three existing narrow
check-in icon differences within `(358,553)–(361,555)`; the source toolbar
overlap remains an open acceptance limitation. Evidence reports are
`frontend/playwright-report/player-node-activity-entry/` and
`frontend/playwright-report/player-node-activity-entry-final/`.

Canonical identity, frontend production type/build, OpenAPI generation, Rust
formatting/workspace check, the affected application/persistence tests and
183 API tests passed (two API tests explicitly ignored). No production player
activation or schema migration is included in this refinement.

**Remaining direct-entry semantics:** Source `LearningWorldController::play`
and `LoadPlayableNode` allow the playable node document without a run;
`NodePlay::getStartActivity` chooses the first authored start, then preferred
activity, then first activity. `requestedActivityFromRequest` handles the
separate `activity_id` destination. `markActivity` accepts a null play-run ID
under `LearnerActivityAccessService::assertCanPlay`; `LearnerProgressService::mark`
then persists reached/completed activity facts but skips route entry/exit,
route completion and `awardActivityCompletion`. Therefore making a hidden
ordinary route/run for these links would incorrectly create route/evidence
semantics. Before implementing direct entry, map its nullable-run props,
anonymous local completion, authenticated progress/check-ins, each specialized
activity command, Companion and refresh behavior separately. Reuse existing
bounded graph/presentation/access helpers; do not claim that the run-required
`LearnerPlaybackDocument` or an ordinary start command already supplies this
contract. Source tests include `DashboardTest.php`'s requested-activity case
and public/private node entry cases. These remain incomplete requirements.

### Runless node read projection

The principal-scoped
`GET /learner/nodes/{node_id}/playback` snapshot is separate from run-authorized
playback. It reuses the bounded graph/node, presentation/review, shared-task and
private-progress readers. It returns the requested activity only when it belongs
to the readable node, otherwise null so the copied source retains its normal
default selection; an empty published node is a valid empty graph. It issues no
new run or authored-start authority and performs no entry/progress/evidence writes.
Without a run, NPC dialogue/checklist transient state must be absent while
actual owner progress, answers, review history and shared-task submissions
remain visible. Publication/roles/evaluated node access and oversized/broken
graph failure gates still apply. The application/persistence implementation is
`backend/crates/{application,persistence}/src/learner_node_playback.rs`, with
OpenAPI `getLearnerNodePlayback` / `LearnerNodePlaybackDocument` and the existing
API playback module. `toDirectPlaybackPageProps` shares the existing pure
node mapper, retaining source null run/route/default-selection props without
synthesizing a legacy run document.

**Verified read contract:** `canonical-player-direct-read-live.spec.ts` covers
an empty node, a populated node with no authored start/history, explicit and
source-default selection, anonymous/role/publication/locked/hidden rejection,
1001-activity overflow and unchanged starts/progress/evidence. The existing
`canonical-playback-reference-live.spec.ts` now checks the read across all 14
activity kinds, actual saved answers/progress/obstacle facts, principal
isolation, absence of run-specific NPC/checklist state and retained mapper
identity checks. Reads took 6–7 ms and returned 4,473–5,936 bytes in these small
local fixtures, not a production benchmark. No route-progress, evidence or
last-visited-topic changes occurred during the direct reads.

The combined native/whole-page regression run passed all 25 cases. Existing
ordinary whole-page source/copy journeys passed at 1440×900 and 390×844 after
the shared mapper change; 15 of 18 screenshot pairs are identical, with only
the previously observed small check-in icon region differing in three narrow
pairs. These are regression screenshots for ordinary playback, not acceptance
evidence for a runless interactive player. Canonical identity, frontend
production type/build, OpenAPI client generation, Rust formatting/workspace
check, 129 persistence unit tests and 183 API tests passed (six persistence and
two API database tests explicitly ignored in those unit runs). Live report:
`frontend/playwright-report/player-direct-read/`.

This read alone does not activate direct-entry commands, anonymous playback or
the production player. Next, map source runless progress/check-in and specialized
activity commands without routing them through ordinary completion/evidence
writers. In particular `LearnerProgressService::mark` preserves a prior
completed status when reached again, and only runs route entry/topic visits
when `playRunId` is present.

### Copied player page-prop adapter

Source owners checked against pinned `main`: `resources/js/pages/learning/node-play.tsx`,
`types/learning.ts`, `features/world/{activity-panel,item-obstacle-activity,shared-task-activity}.tsx`,
`app/Learning/Serializers/{LearningNodeSerializer,LearningActivitySerializer,LearnerProgressSerializer}.php`
and `app/Learning/Services/LearnerActivityPlayStateService.php`.
`frontend/src/platform/playback-projection.ts` consumes the existing generated
`LearnerPlaybackDocument` and command receipt schemas. It is a pure typed data
adapter, with no production route activation or source-file modification.

| Copied source prop | Native evidence / mapping | Incomplete-contract rule |
| --- | --- | --- |
| `node`, starts, transitions, outgoing portals and topic links | `LearnerPlaybackNode`, `LearnerPlaybackGraph`; keep actual UUIDs, order, nullable terminal edges, route progress and authored presentation | Reject mismatched node/map/active/start identities or missing transition targets. Topic and competence URLs remain distinct source URLs. |
| Every activity's question, sources, feedback, sounds, items/tools, NPC graph and review/shared-task context | Typed `presentation`, `review_context`, `shared_task_state`; explicit field mapping, no generic case conversion of authored config | Question identity is its actual native activity UUID; options retain native authored keys. Catalog references resolve to actual catalog UUIDs, never array counters. Missing referenced items fail explicitly. |
| `progress.activities`, `progress.answers`, `recallQuestionIds` | Principal-scoped `private_state`; preserve stored timestamps, feedback, earlier attempts, actual next targets and nullable records | No inferred completion, empty substitute answer or fabricated recall ID. Unknown saved question options or next targets fail explicitly. |
| `playState` | Per-run `npc_dialogues` and `shared_task_checklists` | Preserve only actual saved entries and validated node identities. Do not initialize or persist new state merely by mapping props. |
| Obstacle metadata in reads and command receipts | `item_obstacles`, `obstacle_resolutions`, `LearnerPlaybackActivityState` | Map consumed slot item IDs and actual destruction time; native storage has no `filledAt`, which the copied component does not consume. Do not invent it. Null ordinary recall progress stays null. |
| Initial route/run/recall/revisit selection | Authorized document `start_id`, `play_run_id`, `run_kind`, active activity UUID | These props describe an existing authorized run. They do not authorize entry, start, restart, navigation or completion. |

Still required before whole-player activation: exact typed command transport,
entry/resume/restart and terminal lifecycle, anonymous access, Companion reload,
media delivery evidence, and narrow UUID transport seams for source numeric
coercions/comparisons (item drops/slots, tool grants, route filtering and sound
references). Also reconcile every source-consumed configuration key against
the type-specific Rust allowlists: the existing check-in projection excludes
learning-area labels without a valid slug, while source accepts a null slug.
The adapter preserves any already-returned `competenceTopics` and otherwise
maps the projected areas; this does not establish complete configuration parity.
The production route remains explicitly unavailable until these gaps close.

**Verified data seam:** canonical source identity and production frontend
type/build passed; generated API drift check and 22 focused Rust persistence
playback tests passed. The 20 live contract checks passed in 26.6 seconds
against real local Rust/PostgreSQL, with `canonical-playback-projection-evidence.ts`
applied to all six run kinds and fourteen activity types, populated saved
answers/NPC/checklists, review context and shared-task peer state. They check
complete activity field coverage, unchanged input documents, stable native
identities, no invented empty progress, exact private feedback/history,
nullable destinations, catalog reference resolution and obstacle receipts.
Mismatched node/active activity, absent option keys and absent catalog rows
fail explicitly. HTML evidence is in ignored
`frontend/playwright-report/player-projection/`. These are adapter/native
contract checks, not browser-rendered player parity or route acceptance.

### Player reached-state command

Audit before implementation: copied `node-play.tsx` posts `status: reached`
on each authenticated active-activity change, before loading translation.
Pinned `LearningWorldController::markActivity` and `LearnerProgressService::mark`
authorize the activity/run and preserve existing completed progress. Rust
`learner_route_run::{start_or_resume,reset}` currently updates only route state;
`learner_playback::mark_activity_reached` is called only when advancing. There
is no existing endpoint that records the initially displayed activity.

Add only `POST /learner/play-runs/{run}/activities/{reference}/reach`, using
the existing explicit `id:UUID`/legacy-slug reference convention. Resolve and
lock the actual owner/run/current activity, check publication, map access and
node availability, then upsert reached progress without downgrading completion.
Return the existing typed persisted activity-state receipt. Source
`LearnerRouteProgressService::enterActivity` also updates entry time and topic
visits: reuse Rust's existing `record_topic_visit` (already called by playback
reads), and refresh the ordinary run's entry time without changing its current
activity. This matters for local source navigation that does not reload the run.
No browser-supplied
status, activity substitution, route advance, evidence, check-in, answer or
completion is accepted. Recall only verifies its active question and returns
actual nullable progress; it never writes ordinary progress (ADR-037).
Stale, other-owner, inactive, unpublished and unavailable pairs return 404;
missing authentication/CSRF retains 401/403; storage failures return 503.

**Verified:** `persistence/src/learner_playback_reach.rs` implements this command
through the application port and the authenticated/CSRF-protected API handler.
It checks at most five native run tables, stops at the authorized current row,
and reuses existing availability, topic-visit and activity-state helpers. It
does not load the entire player graph merely to record entry.

The initial endpoint regression failed against the previous backend. After
implementation, canonical identity, production frontend type/build, generated
OpenAPI client, Rust workspace check/format, three application playback tests,
22 persistence playback tests and 20 real Rust/PostgreSQL checks passed (37.5
seconds). `canonical-playback-reach-evidence.ts` covers all six playback paths
and fourteen activity types, explicit/legacy references, duplicate entry,
completion timestamp preservation, owner/CSRF/anonymous/stale/publication/map
access and locked/hidden-node failures. Dedicated entry-context checks prove
ordinary entry time/topic updates, no repeated topic transition, and Recall's
absent ordinary progress/topic writes; entry creates no completion evidence
or check-in. Measured local entry commands took 7–10 ms, not a production SLA.
Report: ignored `frontend/playwright-report/player-reach/`. Expired disposable
sessions were renewed through the existing local setup before the final run.
No canonical UI, database migration or production ownership changed. Copied
player command transport and full route/browser acceptance remain open.

Separate observed authoring gap: `persistence/src/admin_world_map_delete.rs`
relies on activity FK cascades; during the player message fixture cleanup it
returned 503 with `learning_activity_transitions_endpoint_connector_unique`.
Multiple edges from one source can transiently collapse to the same null target
as destination activities are deleted (constraint introduced by
`backend/migrations/application/0079_world_builder_transition_identity.sql`).
Before authoring acceptance, reproduce a map with parallel outgoing destinations,
then delete incident edges before cascading their owners, preserving unrelated
maps and permission checks. Player fixture cleanup now removes only edges owned
by its disposable map before calling the map-delete API; this is not a product
fix or evidence that map deletion is accepted.

### Copied Shared Task command transport

Pre-implementation source audit: pinned
`resources/js/features/world/shared-task-activity.tsx` and its whole dependency
tree (`activity-utils.tsx`, `components/ui/button.tsx`,
`hooks/use-platform-translation.ts`, `lib/utils.ts`, `types/learning.ts`), plus
`features/world/api.ts`. Initial activity/peer state and saved checklist use the
verified `playback-projection.ts` mapping. This slice connects the complete
Shared Task command surface; common player completion/navigation remains a
separate whole-route integration boundary.

| Source operation | Existing typed Rust contract | Response / unavailable behavior |
| --- | --- | --- |
| POST `shared-task-submissions` | `.../shared-task/submissions`, `SubmitLearnerSharedTaskContribution` | Real persisted shared state; preserve body, explicit sharing choice and nullable project step. |
| POST `shared-task-reviews` | `.../shared-task/reviews`, `SubmitLearnerSharedTaskReview` | Preserve actual submission UUID, response type and project step. |
| PATCH `shared-task-submissions/{id}/revision` | `.../shared-task/submissions/{id}/revision` | Source receives actual revised submission and permissions. |
| PATCH `shared-task-reviews/{id}/helpfulness` | `.../shared-task/reviews/{id}/helpfulness` | Source receives actual updated helpful marker. |
| PATCH `shared-task-reviews/{id}/follow-up` | `.../shared-task/reviews/{id}/follow-up` | Private nullable note remains owner-scoped. |
| POST `shared-task-checklist` | `.../shared-task/checklist` | Return normalized actual step indexes; source owns optimistic rollback on failure. |

Bind only a successfully loaded playback document and its graph identities to
its exact run. No unbound/global-current-activity fallback, arbitrary Laravel
POST or success emulation. Validate the six known source paths and payload
types, forward through the generated client with native CSRF, map successful
state through the existing explicit projection, and propagate actual failures
to the copied component's error and draft-retention behavior. Test-only browser
harnesses import whole original/copied components; they do not activate a
partial production player or count as whole-route acceptance.

Implemented in `frontend/src/platform/playback-shared-task-api.ts`, dispatched
only for the six recognized command paths by `world-api.ts`. A run binding is
released by its owning render; disposing an older binding cannot invalidate a
newer one. Unknown runs, foreign URLs, malformed payloads and unsupported
methods fail explicitly. Backend ownership, current activity and publication
checks remain authoritative. No Rust contract or canonical source changed.

Verification: canonical identity (299 JS files plus CSS), frontend type/production
build, generated OpenAPI consistency, the focused Rust Shared Task input test,
and all 20 native player contract/reference checks passed. The two real
Rust/PostgreSQL browser checks in
`frontend/e2e/canonical-player-shared-live.spec.ts` exercise all six commands at
1440×900 and 390×844, persisted reloads, real stale-run failures, retained drafts,
optimistic checklist rollback, and binding/payload guards. There are no mocked
API responses or legacy Laravel requests. Test-owned maps/runs are removed.
The test-only `canonical-player-shared.tsx` imports the complete copied and
pinned-source components and compares initial/persisted review text, geometry
and screenshots; controls are reachable and bounded after scrolling. Source
and copied initial and persisted review screenshots are byte-identical at both
viewports; their layouts were visually reviewed. Screenshot capture
normalizes the pointer and disables animation for reproducibility. Evidence:
ignored `frontend/playwright-report/player-shared-transport/` and
`frontend/playwright-report/player-shared-native/`.

This is command/subcomponent acceptance only. The complete NodePlay route,
completion/navigation lifecycle, other activity transports and full-page
responsive/media acceptance remain open; the production resolver still reports
the route unavailable.

### Question answer and reflection lifecycle contracts

Pre-implementation audit against the pinned SHA: whole source
`resources/js/features/world/standard-activities.tsx` (`QuestionActivity`,
`ReflectionActivity`), `app/Learning/Services/{QuestionAnswerService,QuestionTransitionResolver}.php`
and `app/Http/Controllers/LearningWorldController.php`.

| Source requirement | Current Rust evidence / required repair |
| --- | --- |
| Single-choice correctness is the selected option's flag; multiple-choice requires exactly all correct options | `persistence/src/learner_question.rs` was applying the multiple-choice comparison to both. The live regression reproduced wrong correctness/calibration and the wrong edge; evaluation now follows source semantics. |
| Answer option identities follow authored option order | Normalize accepted keys from the validated authored selection, preserving opaque keys; no numeric aliases. |
| Authored mode changes preserve recorded answers and earlier attempts | Live completion coverage exposed 503 when earlier multiple-choice answers were checked against the new single-choice mode. Apply the mode constraint only to new writes; keep recorded selections, correctness and feedback on reads. |
| Evaluated response includes nullable `nextActivityId` and matching `nextTransitionLabel`; outcome edge precedes correctness edge | Add the existing server-resolved transition UUID to `LearnerQuestionAnswerResult` and OpenAPI; use the same result on refresh. Preserve terminal null and keep the run open until the distinct completion command. |
| Saving a reflection/independent response does not complete the activity before optional guidance and completion | Existing persistence returns `status: saved` and does not advance. Correct the stale OpenAPI `in_progress/completed` enum and advancing description; do not change the working writer. |

Required verification: real PostgreSQL/Rust routing, response and refresh parity,
authored option ordering, repeated attempts and deferred completion; focused
Rust tests and generated-client/type/build consistency. Whole copied player
transport and browser acceptance remain separate outstanding work.

Implemented in `backend/crates/domain/src/learner_state.rs`,
`backend/crates/persistence/src/{learner_question,learner_playback_private_state}.rs`,
OpenAPI and its generated TypeScript client. The answer command and refreshed
feedback now return the same destination and label. Recorded history survives
an authored selection-mode change while current-mode restrictions still apply
to new answers. No database migration or canonical presentation changed.

Verification: 65 focused learner persistence tests passed (six existing
integration tests remain ignored), Rust workspace fmt/check, canonical source
identity, frontend production type/build and generated-client consistency
passed. Real PostgreSQL/Rust tests in
`frontend/e2e/canonical-player-answer-live.spec.ts` cover ordinary, revisit,
recall and replay runs: single/multiple correctness, option order, outcome and
correctness routing, terminal/absent edges, private attempts, refresh parity,
authored-mode changes, rejected choices and distinct completion. The four
checks pass after correcting the revisit fixture to include its required due
invitation; existing native player contract/reference checks also pass (20).
Recall completion creates no ordinary activity progress. Reports: ignored
`frontend/playwright-report/player-answer-native/` and
`frontend/playwright-report/player-answer-completion/`.

Nullable outcome follow-up verified: pinned
`app/Learning/Services/QuestionTransitionResolver.php` compares nullable option
and edge values directly, and `app/Learning/Actions/UpdateActivityTransition.php`
persists blank outcome values as null. A live regression reproduced Rust
incorrectly falling back to the correctness edge. `QuestionOutcome` now
distinguishes skipping outcome lookup (multiple-choice) from matching a nullable
outcome (one selected single-choice option), consistently in the command,
refreshed feedback, private progress and completion. SQL uses null-safe equality;
lookups remain bounded to the first matching edge. Browser-driver/native tests
prove that multiple-choice ignores the same null edge, while single-choice
returns and completes through it. The four run-kind cases and existing player
checks all pass together (24 tests, 46.4 seconds), alongside 65 Rust learner
checks, workspace fmt/check, canonical identity, frontend type/build and
OpenAPI client consistency. Report: ignored
`frontend/playwright-report/player-null-outcome/`. No presentation source,
public contract, migration or production ownership changed in this follow-up.

Remaining before whole player acceptance: wire the copied question/reflection
commands and recall controls; finish shared player completion/navigation and
source/browser acceptance. Native contract tests are not evidence that the
copied player route is active. The Recall control audit and native repairs
below close the previously missing replay and independent feedback contracts;
whole copied control integration remains outstanding.

### Recall control contracts for the copied question player

Source audit: pinned whole
`resources/js/features/world/standard-activities.tsx`,
`features/learning/recall-items.ts`,
`app/Http/Controllers/LearningWorldController.php` and
`app/Learning/Services/LearnerRecallItemService.php`.

| Source operation | Existing native evidence / required work |
| --- | --- |
| Keep current question for recall | Existing `POST .../play-runs/{run}/activities/{reference}/recall`; `persistence/src/learner_recall.rs::active_question_for_update` checks ordinary/revisit/recall runs but omits replay. Extend the owned current-question lookup to replay and verify publication, map access, node availability and stale-run rejection. |
| Remove saved question | Existing `DELETE /learner/recall-items/{id}`; actual queue identity is returned by queueing and by active playback. Source removes an already-absent authorized question idempotently. Preserve this distinction from a foreign/unavailable target when adapting the current player. |
| Save nullable post-feedback confidence | Source allows `exploring`, `leaning`, `settled` or null and returns `updated: false` if no private item exists. Add a bounded owner/current-question command returning the actual update result. It must preserve schedule, review count, answer history, activity/route progress and run status. Do not call completion to simulate this independent write. |
| Source helper omits run argument | The copied question component already has `playRunId`; inject it only at the exact transport call seam. Avoid a global current-question fallback or choosing a run from an unrelated page. |

Implemented native contracts in
`backend/crates/{api,application,persistence}/src/learner_recall.rs`, with routes
in `backend/crates/api/src/main.rs` and OpenAPI/generated TypeScript evidence:

- Existing `POST .../recall` now supports ordinary, revisit, recall and replay
  runs. A pre-fix live regression reproduced replay's 404. Static run lookups
  lock the current run and reuse `PostgresLearnerNodeAvailability`; all queue
  commands require published, visible and playable content and owner access.
- New `DELETE .../recall` (`removeLearnerCurrentQuestionFromRecall`) returns
  the actual `removed` boolean, including false for an already-absent item on
  an authorized current question. It does not reinterpret foreign/stale 404s.
- New `POST .../recall/feedback` (`updateLearnerCurrentRecallFeedback`) accepts
  the nullable `confidence_after_feedback` field and returns the actual
  `updated` boolean. Missing/null clears the value; no item returns false
  without creating one. Invalid phrases return 400, invalid/unknown JSON
  fields 422, missing auth 401, invalid CSRF 403 and unavailable targets 404.
  This command updates only that private field and its row's update timestamp.

Pinned source test evidence also checked:
`tests/Feature/{LearnerRecallItemTest,QuestionActivityTest}.php`. Focused Rust
verification passed: four application tests, 65 learner persistence tests (six
existing tests ignored), workspace check/fmt. Canonical identity, frontend
production type/build and OpenAPI client consistency passed.

Real PostgreSQL/Rust coverage in
`frontend/e2e/canonical-player-recall-evidence.ts`, called by all four cases in
`canonical-player-answer-live.spec.ts`, verifies idempotent queue/removal,
feedback values and clearing, invalid fields, absent items, owner/anonymous/CSRF
boundaries, publication/map access/locked/hidden/stale failures, and unchanged
run, activity-progress, answer, check-in, review-count and scheduling facts.
The four cases passed in 16.6 seconds after supplying the required timestamp
in the stale isolated-run fixture; the existing 20 native player checks also
passed. Local queue requests measured 8–12 ms, not a production guarantee.
Reports: ignored `frontend/playwright-report/player-recall-native/` and
`frontend/playwright-report/player-recall-controls/`. No canonical UI or database
migration changed, and Rust gained no production ownership.

Next: connect the complete copied question/reflection command surface through
explicit run-bound transport adapters, then collect whole-source browser
evidence at both required viewports. The player route remains unavailable;
these native contracts alone do not complete copied-control acceptance.

### Copied question and reflection command transport

Pre-implementation audit: whole pinned `features/world/standard-activities.tsx`
and dependencies `activity-utils.tsx`, `portal-scene.tsx`, `api.ts`,
`features/learning/{recall-items,review-outcomes}.ts`, `components/ui/button.tsx`,
`hooks/{use-appearance.tsx,use-platform-translation.ts}`, `lib/utils.ts` and
`types/learning.ts` (all under `resources/js/`). Canonical bytes stay unchanged.

| Source command | Typed native mapping / constraints |
| --- | --- |
| Question `option_id` or `option_ids`, optional confidence, deferred completion | `answerLearnerQuestion`: preserve opaque authored option keys, validate the bound question/run and run-kind flags, map the full real evaluated answer including destination, feedback and earlier attempts. Answering must not complete the activity. |
| Queue, remove and post-feedback Recall controls | The three verified current-question contracts; inject the component's existing `playRunId` only at exact Recall transport call sites. No global-current-run lookup. |
| Reflection/review and independent response | `saveLearnerReflection`: forward writing, optional context/cues and independent-check flag; Rust derives topic/category and permissions. Only the real `saved` response advances copied local UI state. |
| Completion callback for these response types | Use the actual completion receipt; question correctness/attempt/calibration and reflection evidence are server-derived. Preserve optional confidence and source review outcome. Recall's absent ordinary progress stays null. Full NodePlay check-in/navigation integration remains separate. |
| Failure and disposal | Bound-document identity guard, owned disposable binding, native CSRF and actual errors. No success fallback, generic Inertia or substituted presentation. |

Test-only hosts mount whole original/copied exports for both required viewports,
with real Rust-backed commands and persisted-state checks. Their component-level
evidence does not activate or accept a partial production NodePlay route.

`frontend/src/platform/playback-response-api.ts` now implements those narrow
commands. `playback-context.ts` shares the existing owned-document binding with
Shared Task; disposing an older render cannot release a newer binding. The
answer mapper in `playback-projection.ts` is shared by initial saved answers and
command responses, preserving opaque option keys, retries, feedback, resolved
destinations and nullable Recall schedules. The exact-file Vite transform
replaces only the four Recall call sites in the copied `standard-activities.tsx`
with typed commands carrying its existing `playRunId`. No canonical JSX, style,
control, Rust endpoint, OpenAPI schema or migration changed.

`frontend/e2e/canonical-player-response{.html,.tsx,-live.spec.ts}` exercises
single/multiple questions, isolated Recall, transfer with a fresh independent
response, and Review at 1440×900 and 390×844. Commands use real Rust/PostgreSQL;
checks cover retry/history persistence, deferred completion, the actual Recall
interval, queue/remove/feedback, private journal responses and cues, Review
outcome/confidence, stale-run failures, invalid/unbound adapter requests and
bounded primary controls. Recall completion retains its actual null ordinary
progress. Source-vs-copied comparisons use the whole pinned-main component and
dependency tree, with identical real read projections: initial states for all
five cases, and reloaded saved-answer states for questions. Post-save reflection
screenshots are Rust-only evidence; they do not claim a second Laravel-backed
write or full-page parity.

**Open source/acceptance limits:** pinned Reflection/Review has `try/finally`
without an inline error catch. A real rejected save retains the draft and makes
no journal record, but produces an unhandled rejection without visible error
copy. This is recorded, not waived or redesigned. The copied Question callback
can emit an authored next activity even after an isolated Recall run completes;
the future owning-page adapter must follow the actual terminal run receipt.
These hosts observe callbacks only: NodePlay navigation, check-ins, Companion,
other activity types and complete route activation remain open.

Validation: canonical identity (299 source files plus CSS), production frontend
type/build, generated OpenAPI-client consistency, Rust workspace fmt/check,
65 focused persistence tests (six pre-existing ignored tests), one application
reflection test and four application Recall tests passed. The combined real
Rust browser run passed all 36 tests: ten response-control cases, two Shared
Task regressions, four native question/Recall cases and twenty native playback
contract/reference cases. Every paired source/copied screenshot in this run is
byte-identical; representative desktop and narrow screenshots were also
visually inspected. Report: ignored
`frontend/playwright-report/player-response-final/`.

Rerun against the local Rust stack on 8081 and the current
`e2e/learner-layout-vite.config.ts` evidence server on 8084, from `frontend/`:
`PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-response-live.spec.ts e2e/canonical-player-shared-live.spec.ts e2e/canonical-player-answer-live.spec.ts e2e/canonical-playback-contract-live.spec.ts e2e/canonical-playback-reference-live.spec.ts --reporter=line,html`.
Restart the evidence server after base Vite configuration changes: an existing
process was observed serving the old Recall call sites until restarted. Initial
test-fixture/locator errors were corrected; interrupted disposable maps were
removed. No production or unrelated worktree artifacts were changed.

### Item/tool grant activation prerequisites

Pinned source checked before connecting the next copied controls:
`resources/js/features/world/{item-grant-activity,tool-grant-activity,activity-utils}.tsx`,
`features/world/api.ts`, `features/items/item-inventory.ts`,
`features/tools/{tool-selection,tool-visuals}.ts` and `lib/media-url.ts` under
`resources/js/`. Server owners are
`app/Http/Controllers/{LearningItemActivityController,LearningWorldController}.php`,
`app/Learning/Services/{LearnerActivityAccessService,LearningItemGrantService,LearningToolGrantService}.php`;
source tests include `tests/Feature/LearningWorldItemsTest.php`. These fourteen
files match pinned `main` `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`.

| Copied dependency | Existing Rust evidence | Required activation work |
| --- | --- | --- |
| Source `assertCanPlay` before either grant | `backend/crates/persistence/src/{learner_item_grant,learner_tool_grant}.rs`; `/learner/play-runs/{run}/activities/{reference}/grant-items` and `/grant-tool` | Verified repair below: both writers reuse `PostgresLearnerNodeAvailability` before any grant or stored receipt is returned. |
| Item roll and complete inventory | `LearnerItemGrantResult`; `GET /learner/shell` bounded, non-truncating inventory | Map the actual roll and then actual inventory; a failed inventory read must not render fabricated success or substitute only the newly granted items. Retrying the same run must reuse its stored roll. |
| Tool grant and existing ownership | `LearnerToolGrantResult`, `LearnerShell.tools`, playback `presentation.configured_tool` | Inject the actual run into the source's empty grant payload; map the real returned tool and preserve the copied shared tool store and already-owned continuation. |
| Catalog IDs and quantities | Native UUIDs in playback/catalog/ownership; existing `playback-projection.ts` mappings | Replace only the source numeric identity checks in item configuration parsing and tool ownership testing. Keep numeric quantities, source presentation and UUID identity intact. |
| Completion and duplicate callbacks | Native completion receipts; source Tool Grant may call completion from both the grant callback and the newly-owned effect | Bind/deduplicate actual completion promises without manufacturing progress or navigation. Item-roll progress stamping is aligned below; route continuation remains separate. |

**Verified native prerequisite:** all four ordinary/replay × item/tool grant
regressions first reproduced HTTP 200 from a locked node whose playback read
returned 404. Both repositories now load the existing learner-availability facts
and evaluate the selected node's state/config before granting or returning a
stored roll/already-owned tool. Existing run locks, catalog selection, CSRF,
publication/map access and receipt idempotence remain in place. OpenAPI and its
generated client explicitly describe unavailable-node 404 responses.

`frontend/e2e/canonical-player-grant-contract-live.spec.ts` passes against the
rebuilt local Rust/PostgreSQL stack for all four combinations. It verifies locked
and hidden nodes, all five publication layers, map access, owner/outsider/anonymous
requests, CSRF, unknown and stale runs, an authorized manual unlock followed by
revocation, and rejection after an item roll or tool ownership already exists.
Denied requests preserve fixture inventory, rolls and progress. Successful
requests remain idempotent, the complete shell inventory reflects the real
quantities, and the run is not advanced by claiming. Local successful grant
requests took 6–9 ms; this is fixture timing, not a production load benchmark.

Validation: four new native grant tests, fourteen existing native player
reference/projection regressions, 65 focused Rust persistence tests (six existing
ignored tests), workspace fmt/check, canonical source identity, frontend
production type/build and generated-client consistency passed. No migrations or
UI files changed. Reports are ignored
`frontend/playwright-report/player-grant-{native,reference}/`; rerun those two
specs with the local stack and existing disposable sessions. Copied grant
component integration is verified below; the complete NodePlay route remains
unavailable until its remaining contracts and owning-page acceptance are complete.

**Verified source item-roll progress:** the follow-up audit of
`LearningItemGrantService::rollAndGrant` found that source rolls stamp ordinary
activity progress completed immediately, without advancing the play run. The
ordinary/replay item tests first reproduced missing completed progress in Rust.
`learner_item_grant.rs` now reuses the existing `mark_activity_completed` helper
inside the roll/holding transaction. It runs for either newly recorded outcome;
stored-roll retries return without rewriting the progress timestamp. ADR-034
and the generated OpenAPI contract describe this distinction from route
completion. No schema migration is needed.

The native grant tests now verify completed progress in the active playback
document before Continue, no premature run advancement, preservation of the
first timestamp after explicit completion, and a new run granting again without
changing that first timestamp. Tool grants still leave completion to their
existing completion command. All 18 native grant/reference tests, 65 focused
Rust persistence tests (six existing ignored tests), workspace fmt/check,
canonical identity, frontend production type/build and client consistency
passed. Report: ignored `frontend/playwright-report/player-grant-progress/`.
The deterministic native item fixtures exercise guaranteed-success rolls.

**Copied grant control integration:** the whole pinned `ItemGrantActivity` and
`ToolGrantActivity`, including their original stores, visuals and shared controls,
now use `frontend/src/platform/playback-grant-api.ts` through the exact
`world-api.ts` transport resolver. Item grants read the actual complete
`GET /learner/shell` inventory after the native command; a failed read propagates
the source error even when the roll has already persisted. Refresh retries the
same stored roll without increasing holdings again. Tool grants forward the
real bound run and map the actual catalog tool into the copied tool store.

`grant-source-transform.ts` is a guarded build-time compatibility seam applied
only to the two exact component paths by Vite. It replaces item numeric-ID
coercion/testing and the tool positive-numeric-ID test with opaque UUID checks,
and adds `props.playRunId` to the source tool request. Quantity parsing, JSX,
CSS, presentation, controls and all canonical files stay unchanged. The source
tool speed range is 1–250 (`AdminActivityRules.php`); an initial fixture using
zero correctly produced unavailable playback and was corrected.

`playback-completion.ts` validates actual completion receipts and shares one
promise/result for an activity/request inside its document binding. Source tool
grant callbacks and the newly-owned effect therefore cannot advance twice.
Failed requests are evicted and retryable; replacement bindings cannot reuse an
old receipt. Question/reflection completion reuses the receipt validation but
does not opt into grant-specific completion caching. The
future owning page must release/replace its binding with a fresh authoritative
document when moving or restarting, including graph cycles; this component
integration does not implement that lifecycle or authorize stale-receipt reuse
across navigation. Recall completion still keeps its actual nullable progress.

`frontend/e2e/canonical-player-grant-live.spec.ts` mounts whole copied and pinned
main controls through the test-only `canonical-player-grant.{html,tsx}` host,
using separate actual principals and runs against Rust/PostgreSQL. Both source
trees share the documented UUID/transport seam; these are component comparisons,
not independent Laravel backend or complete NodePlay parity evidence. The host
observes completion/movement and unmounts the control, without fabricating the
next page, check-in, Companion or media behavior.

The ten cases cover 1440×900 and 390×844: successful item rolls with complete
inventory replacement and refresh idempotence; an actual stored failed roll
with automatic completion and unchanged holdings; inventory exceeding the real
100-item shell bound, source error and recovery; tool take, actual stale-run
error and retry; and already-owned continuation without a grant request. Failed
roll fixtures represent persisted failed outcomes, not a claim that a new
random draw was forced. Loading barriers delay requests and then continue to
the actual Rust server; no grant or completion response is mocked. They also
verify UUID/unbound/type/origin guards, failed completion retry, shared requests,
binding replacement, actual next-activity receipts and persistence, copied tool
selection, bounded controls and absence of Laravel requests/browser errors.

All eighteen paired loading/success/error/owned screenshots in the final
passing run were byte-identical; desktop item and narrow tool captures were
visually inspected. This is light-appearance fallback-visual evidence, not media
delivery acceptance. Source item Continue and already-owned tool completion
callbacks lack an inline failure handler; preserving those source callbacks
does not waive the owning player's error/recovery acceptance requirement.

**Verified nullable-tool read repair:** source
`ToolGrantActivityConfiguration.php` and `AdminActivityRules.php` allow a null
tool selection, and `tool-grant-activity.tsx` then shows its missing-configuration
state with Take tool disabled. Both files were checked against the pinned main
SHA. A Rust regression and both browser viewports reproduced rejection of that
source-valid configuration: each real playback request returned 503 before the
repair. `learner_playback.rs::tool_grant_safe_config` now preserves an absent or
null selection as null, while still rejecting numeric, empty, malformed and
non-scalar catalog references. `LearnerPlaybackPresentation.configured_tool`
was already nullable; OpenAPI and generated-client documentation now explicitly
describe its disabled-control meaning. No UI or schema migration is needed.

The two additional browser cases mount the whole source control at 1440×900
and 390×844, compare its fallback visual and disabled bounded Take tool control,
and verify no automatic grant/completion. Direct native attempts through the
typed adapters still return 404, with no tool ownership, completed activity or
run advancement. All twelve grant browser cases pass on the rebuilt healthy
local stack. All twenty source/copied screenshot pairs are byte-identical;
both unconfigured-tool viewports were also visually inspected. The new Rust
regression covers absent/null versus malformed references; 66 focused
persistence tests pass (six existing ignored tests). The eighteen native
grant/reference regressions, workspace fmt/check, canonical identity and
production frontend type/build also pass. Reports: ignored
`frontend/playwright-report/player-grant-nullable/` and
`frontend/playwright-report/player-grant-nullable-native/`; rerun the grant UI
spec and the two native specs with the same commands below. These checks close
the nullable-tool read gap, not complete NodePlay acceptance.

Validation for the configured grant integration: 22 copied grant/response/shared
browser cases and 18 native grant/reference cases passed in separate completed
runs; 65 focused Rust persistence tests passed (six existing ignored tests),
workspace fmt/check, canonical identity, frontend production type/build and
generated-client consistency passed. The working main React/CSS tree also
matches the pin. Reports: ignored
`frontend/playwright-report/player-grant-{final,native-final}/`.
An earlier combined process ended with SIGTERM; it is not counted as a passed
run, and its identified disposable fixture was removed before rerunning.
Rerun from `frontend/` against the local Rust stack and the 8084 evidence server:
`PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-grant-live.spec.ts e2e/canonical-player-response-live.spec.ts e2e/canonical-player-shared-live.spec.ts --reporter=line,html`,
then `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-grant-contract-live.spec.ts e2e/canonical-playback-reference-live.spec.ts --reporter=line,html`.

### Obstacle control contract prerequisites

Source checked against pinned `main` before activating the next copied controls:
`resources/js/features/world/{item-obstacle-activity,obstacle-activity,activity-utils}.tsx`,
`features/world/api.ts`, `features/items/item-inventory.ts`,
`features/tools/{tool-selection,tool-visuals}.ts`,
`features/sounds/sound-player.ts`, `components/app-side-action-bar.tsx`,
`components/ui/button.tsx`, `hooks/{use-appearance.tsx,use-platform-translation.ts}`,
`lib/{media-url,utils}.ts` and the existing shared-layout dependency tree.
The Laravel owners are `app/Http/Controllers/{LearningItemActivityController,LearningWorldController}.php`
and `app/Learning/Services/{LearnerActivityAccessService,ItemObstacleService,ObstacleToolService,LearnerProgressService}.php`.
The native regression verifies those six server files against the pin; canonical
identity verification covers the copied frontend tree.

| Source requirement | Rust evidence / adapter work | Acceptance status |
| --- | --- | --- |
| `assertCanPlay` before place, continue and tool use, including existing slots/clears | `learner_item_obstacle.rs`, `learner_obstacle_tool.rs`, existing `PostgresLearnerNodeAvailability` | Repaired: ordinary and replay writers evaluate the selected node before returning or changing private state. |
| Whole inventory after an item drop | `/learner/play-runs/{run}/activities/{reference}/item-obstacle-slots/{index}` and `LearnerItemObstacleResult.inventory` | Repaired: sentinel read of 101 entries rejects an oversized inventory with 503 and rolls back the command, rather than silently returning only 100. |
| Reached progress for item placement/unmet continuation and persistent useful tool clears; completed progress for met item continuation | Shared `mark_activity_reached`/`mark_activity_completed` in `learner_playback.rs`; private playback activity/state projection | Repaired in the same transaction, preserving first completion and preventing a reached event from downgrading earlier completion. Explicit completion still owns run advancement. |
| Source item UUID drag/drop and configured slot identity | Existing actual catalog IDs in `playback-projection.ts`; command takes a verified catalog slug and slot index | Verified at the whole-control boundary below: guarded UUID identity/run seams and typed command responses reuse the existing inventory/state mappers. No generated numeric aliases. |
| Source tool selection/use and retained clear | Actual shell tools, `use-obstacle-tool`, `LearnerObstacleToolResult`; copied tool store | Verified at the whole-control boundary below: resolve the selected owned UUID from the actual shell, bind the run, and retain useful/unhelpful behavior and actual completion receipts. |
| Initial item/clear state, sound and media | `private_state.activities/item_obstacles/obstacle_resolutions`, configured catalog/sound projections, existing sound preferences and media contracts | Copied-control tests below cover refresh, lock/reset/persistent/non-persistent behavior, actual sound playback and static public asset bytes. Managed/protected media acceptance remains open. The source does not consume `filledAt`; its omission from the native slot projection must not be replaced by an invented timestamp. |

**Verified native regressions:**
`frontend/e2e/canonical-player-obstacle-contract-live.spec.ts` first reproduced
all ten access/inventory failures: an unavailable node still accepted a command,
and an oversized inventory still returned HTTP 200 with a truncated list. Six
additional source-progress cases reproduced absent progress rows after successful
commands. The implementation now checks the existing learner-specific policy,
rejects an oversized complete-inventory response inside the transaction, and
retains the ordinary progress that the source writes. No new tables, migrations,
client-selected quantities or source UI changes were introduced.

All sixteen native cases now pass for ordinary and replay runs. They cover
locked/hidden nodes, all five publication layers, map access, owner/outsider/
anonymous requests, CSRF, unknown/stale runs, authorized manual unlock followed
by revocation, repeated filled slots and existing clears. Oversized responses
preserve prior holdings, slots, pass, progress and timestamps; recovery consumes
exactly once. Progress checks cover unmet continuation, persistent versus
non-persistent tool use, preservation of previous completion, resumed private
playback state, and explicit item completion preserving the original stamp.
These are native prerequisites, not obstacle UI or full NodePlay acceptance.

Verification: sixteen new native obstacle cases, eighteen existing native
grant/reference cases, 66 focused Rust persistence tests (six existing ignored
tests), workspace fmt/check, canonical source identity and frontend production
type/build pass. OpenAPI documents the availability, progress and atomic
inventory-bound behavior; the generated client is kept consistent. Reports are
ignored `frontend/playwright-report/player-obstacle-{native,reference}/`.
Successful command samples were 6–8 ms except one 763 ms ordinary tool-use
sample. A focused repeat passed at 8 ms (ignored report
`player-obstacle-timing/`); the outlier's cause was not established, so these
fixture timings are not a production performance claim.
Rerun from `frontend/`: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-obstacle-contract-live.spec.ts --reporter=line,html`,
then `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-grant-contract-live.spec.ts e2e/canonical-playback-reference-live.spec.ts --reporter=line,html`.


### Whole copied obstacle controls and source action bar

`frontend/src/platform/playback-obstacle-api.ts` connects only the three exact
same-origin source obstacle commands to the existing typed Rust client.
`obstacle-source-transform.ts`, applied to the two exact canonical component
paths by `frontend/vite.config.ts`, retains their whole JSX/styles and replaces
only numeric catalog/sound identity coercion and missing play-run payloads.
The copied tree remains byte-identical to the pin. Unknown URLs, malformed IDs,
unbound runs, wrong activity types and unresolved catalog references fail;
the adapter does not synthesize slots, holdings, useful-tool results or receipts.

| Source operation | Rust mapping | Verification / remaining boundary |
| --- | --- | --- |
| Item drag from whole `AppSideActionBar` to configured obstacle slot | Actual source `DataTransfer` UUID → configured item slug; typed `POST /learner/play-runs/{run}/activities/id:{activity}/item-obstacle-slots/{index}` | Source item store receives the actual complete inventory and slot state; rejected/stale commands preserve quantities, retries and refresh consume only once. |
| Item Continue | Typed `POST .../item-obstacle/continue`, then existing uncached `completePlaybackActivity` | Preserve native met/lock/reset state and actual completion/next-activity receipt. No guessed next activity or completion timestamp. |
| Select/use an equipped tool | Actual shell-owned UUID → its slug; typed `POST .../use-obstacle-tool` | Native ownership/playability checks remain authoritative; whole source control retains unhelpful/useful feedback and persistent versus transient behavior. |
| Existing persistent clear | Private native obstacle resolution → source `progress.obstacleCleared` | Source Continue emits movement without a completion callback. The test records this; owning-page reach/navigation integration remains required before full player acceptance. |
| Source sounds and item images | Actual configured sound UUID, sound preferences and unchanged `sound-player.ts`; root public assets | Browser audio `play()` genuinely resolves, volume/loop match the configured effect, images decode, and delivered static bytes match public files. This does not prove protected/managed media authorization. |

`frontend/e2e/canonical-player-obstacle-live.spec.ts` mounts whole pinned-main
and canonical controls plus their whole `AppSideActionBar` on separate actual
Rust learner/run fixtures. The reference tree shares only the documented typed
transport/identity boundary; it is not an independent Laravel-server test.
The evidence-only `/learning/obstacle-evidence` URL preserves the source action
bar's actual path visibility check and refresh. The host observes component
callbacks; it does not replace or claim the full NodePlay, check-in or Companion
lifecycle. Fourteen cases cover ordinary items, reset-on-entry items, a locked
item obstacle, persistent/transient tools, retained-clear revisit and stale-run
tool failure/retry, each at 1440×900 and 390×844. Controls are checked for visible
viewport bounds. Drag/drop uses the source inventory's real drag-start payload;
physical touch dragging remains unverified.

Forty-six source/canonical screenshot pairs are retained in ignored
`frontend/playwright-report/player-obstacle-ui/`. Thirty-one pairs are
pixel-identical; fifteen differ only along action-bar edges (at most 52 pixels,
maximum RGB-channel difference 1/255). Main content text and bounds match;
representative desktop and narrow renders were visually inspected. No source
styles or focus behavior were changed to eliminate raster differences.

**Open source defect:** `ObstacleActivity` uses `try/finally` without an error
catch. A failed tool request releases pending state and allows retry but leaves
an unhandled rejection and no inline error. Both whole source and copied control
show this behavior. It is recorded, not waived; it cannot be counted as complete
error acceptance. The full production NodePlay route remains explicitly
unavailable while the remaining whole-page contracts/lifecycle are unfinished.

The shared grant regression now introduces inventory overflow after mounting
the real playback document: the repaired common inventory reader correctly
returns 503 for an oversized initial document. The test separately verifies that
read rejection and a later grant/inventory failure, then recovery from the
persisted grant without duplicate holdings. A read-time rejection is not a
successful partial player document.

Verification: fourteen obstacle browser cases and fourteen existing grant/
Shared Task cases pass, alongside canonical identity (299 files plus CSS),
production frontend type/build, generated OpenAPI client consistency, Rust
workspace fmt/check and 66 focused persistence tests (six existing ignored).
The shared report is ignored `frontend/playwright-report/player-obstacle-shared-regression/`.
The expired-session run failed with 401 before fixtures; local disposable
sessions were renewed using the documented bootstrap before the passing rerun.

Rerun from `frontend/` against local Rust and the 8084 learner-layout evidence
server: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-obstacle-live.spec.ts --reporter=line,html`,
then `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-grant-live.spec.ts e2e/canonical-player-shared-live.spec.ts --reporter=line,html`.

### Message-control source contract audit (activation pending)

The next player dependency is the whole `resources/js/features/world/message-activities.tsx`
(`MessagePromptActivity`, `MessageWallActivity`), with `InputError`,
`PaginationControls`, `Button`, appearance/translation hooks and `activity-utils`.
Server ownership is pinned `LearnerMessageController`, `LoadLearnerMessages`,
`CreateLearnerMessage`, `CreateLearnerMessageResponse`,
`MarkLearnerMessageResponseHelpful`, `MessageActivityConfiguration`,
`MessageTopicForActivity` and `LearnerActivityAccessService` under `app/`.
No message UI is activated by this audit or the prerequisite repair.

| Source requirement | Existing native contract | Required work before whole-control activation |
| --- | --- | --- |
| Prompt read/contribution, peers versus private support | `learner_peer_message.rs`, `learner_support.rs`; typed `/peer-message` and `/support-request` | Map actual topic/title/contributed state and support visibility; inspect every source-consumed field, do not invent messages or pagination. |
| Wall read, newest page shuffled; narrow 3/desktop 10 rows | `/peer-wall`, `LearnerPeerMessageWall` | Repaired and verified below: requested out-of-range page, 12-row API bound and exact source response ordering. |
| `hasResponded` survives a hidden/older own response | Source separate existence query; native page query now includes an indexed own-response existence check | Verified for both hidden and older omitted replies; hidden writing stays absent from the response payload. |
| Responses disabled | Source omits responses and rejects both response/helpfulness writes | Repaired: omit response writing and reject both command types when responses are disabled. |
| Reply target validation and idempotence | Native `respond` insert/select then wall read | Repaired: lock/validate the target before insertion; reject unknown, hidden, own, support or other-topic targets with 404; preserve existing response body/type on retry. |
| One helpful response per message | Source locks message then response | Repaired: native writer locks parent before response; concurrent choices serialize and false/unmark remains valid. |
| Access and lifecycle | Source `assertCanPlay`; native peer route contexts and support route/replay contexts | Access repair below covers these existing contexts. Peer replay and other eligible run kinds still require verification before binding UI; ordinary optional completion is repaired below. |
| Source requests omit run identity | Existing scoped playback binding | Add only exact message read/write routes with the actual bound run and typed mappings; unknown/stale operations stay unavailable. |
| Failures and whole-page ownership | Source inline prompt/reply/helpfulness errors; wall close completion callback | Test preserved drafts, pagination/refetch, actual completion and failure at both viewports; full NodePlay lifecycle remains separate acceptance work. |

**Verified native message-wall prerequisite repair:**
`frontend/e2e/canonical-player-message-contract-live.spec.ts` reproduced all six
failures before implementation, including a 503 from competing helpful choices.
After repair, six cases plus the two existing native message prompt/wall
reference cases pass against the rebuilt local Rust/PostgreSQL stack. Coverage
includes bounded 3/10/12-row pages, an empty out-of-range page, latest-three plus
older helpful ordering, hidden/older own-response status, no hidden writing or
author identifiers, disabled response reads/writes, target rejection without
writes, original-body idempotence, wrong-run ownership, CSRF, concurrent helpful
selection and clearing. Parent-message locking follows the pinned source;
response reads stay batched and the private existence check uses the existing
message/responder unique index rather than extra requests per row.

Source checks verified nine named PHP/React owners against the pin. OpenAPI now
records the reader/error behavior and corrects wall `maxItems` from 10 to the
already supported API bound of 12; generated client evidence is consistent.
Canonical identity, frontend production type/build, Rust fmt/workspace check,
the application message validation test and 66 persistence tests pass (six
existing ignored). No migration or canonical presentation change was needed.
Reports: ignored `frontend/playwright-report/player-message-contract{,-baseline}/`.
Rerun from `frontend/`: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-message-contract-live.spec.ts e2e/canonical-playback-reference-live.spec.ts --grep 'native message|native message_' --reporter=line,html`.
This establishes the named backend contracts only; message UI, remaining access
policy/run kinds and whole NodePlay acceptance remain incomplete.

### Message read/write access prerequisites

The next source comparison is the controller's `assertCanPlay` call through
`LearnerActivityAccessService` and `LearningNodeStateResolver`. The peer context
previously joined the current activity/topic without publication, map-role or
node policy checks. The support route/replay queries checked publication and
roles but omitted evaluated node availability. Existing cached contributions
must not bypass source access checks.

`learner_peer_message.rs` now resolves the start/progress node and its exact
MapAsset, checks publication at map/node/asset/route/activity levels and current
map roles, then reuses `PostgresLearnerNodeAvailability` before every peer
read, contribution, reply or helpfulness operation. `learner_support.rs` now
projects the node identity/state/configuration in both existing route and replay
contexts and applies the same evaluator before reading private content or
returning/creating a request. The route query also verifies the start/progress
node and asset relationship. No new policy language, permission bypass or
frontend-calculated access was introduced.

Four native regressions cover peer prompt, peer wall, private support prompt
and existing support replay. Before repair each returned 200 from a locked
node. They require rejection of locked/hidden and scheduled-locked nodes, every
unpublished content layer, removed map access and completed runs, with message
and response rows unchanged. Manual unlock permits a read; revocation denies it
again. Wrong-owner/unknown runs remain unavailable and an accessible retry
succeeds without replacing the original contribution.

Verification: the four access regressions first failed with 200 instead of
404. All ten message-contract cases and two existing message reference cases
now pass against the rebuilt healthy Rust stack (12 tests). Canonical identity,
frontend production type/build, generated-client consistency, Rust workspace
check/format and 66 focused persistence tests pass (six existing ignored).
The replay-completion fixture was corrected to satisfy the existing
status/completed-at database invariant before the final passing run. Reports
are ignored `frontend/playwright-report/player-message-access{,-baseline}/`;
the message-contract rerun command above covers this extension too.

This is not peer-replay or full-player acceptance. The peer repository still
has only an ordinary run context. The source optional-support completion
mismatch identified here is repaired below. Replay selection among multiple
nodes sharing an asset requires the broader recorded run/node-identity audit.
No missing context is replaced with fabricated data.

### Optional message completion and current access

Pinned `message-activities.tsx` exposes “Not now” for both peer and private
support prompts and a close action for a message wall. These call the owning
`node-play.tsx::markCompleted` callback without requiring a message. The source
owners are `LearningWorldController::markActivity` and `LearnerProgressService`;
the completion regression verifies all four files against the pin.

`learner_playback.rs::complete_current_message_activity` previously required a
saved support request and omitted evaluated node availability. The ordinary
message-completion path now accepts either prompt audience without writing a
message, verifies the start/progress node identity and uses the existing
availability evaluator before any progress, evidence or run mutation. Existing
publication, role, topic/asset and authored-next-activity checks remain intact.
A missing or unavailable authored destination still rejects completion rather
than turning it into a successful terminal.

Six source-derived native cases cover peer prompt, support prompt and wall,
each with an authored next activity or terminal. Before repair, all three
next-activity cases advanced from a locked node and empty support-terminal
completion returned 404; peer/wall terminal completion already passed. The
cases verify locked/hidden/scheduled denial without progress/evidence changes,
unpublished-destination rejection, owner/CSRF boundaries, completion with no
message rows, actual completion stamps, native next/terminal receipts and a
rejected stale retry preserving the original stamp/count. These contracts
support the future whole copied control callbacks; they do not activate a
partial NodePlay or prove replay lifecycle acceptance.

Verification: all sixteen message-contract cases plus two existing message
reference cases pass (18 total), along with canonical identity, production
frontend type/build, OpenAPI client consistency, Rust workspace check/format
and 66 focused persistence tests (six existing ignored). The corrected baseline
was rerun against an isolated image built from `349d8a88`: three unavailable-node
completions returned 200 and empty support-terminal completion returned 404;
the two existing peer/wall terminal cases passed. An earlier baseline fixture
omitted a required next-activity description and is not counted as behavioral
evidence. The isolated service was removed after verification; the current
local development backend remains on the repaired build. Reports are ignored
`frontend/playwright-report/player-message-completion{,-baseline}/`.
The existing message-contract rerun command covers all six completion cases.


### Whole copied message controls: ordinary-run adapters

Pinned main is still `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`.
The complete copied `resources/js/features/world/message-activities.tsx`
remains the presentation owner, including both `MessagePromptActivity` and
`MessageWallActivity`. Dependencies are `features/world/{api,activity-utils}`,
`components/{input-error,pagination-controls,ui/button}`, appearance and platform
translation hooks, `lib/utils`, source learning types and canonical CSS.
The PHP owners and native prerequisites are recorded immediately above.

| Source seam | Typed Rust adapter and actual contract | Boundary / failure behavior |
| --- | --- | --- |
| Six exact `/learning/activities/{id}/messages...` request expressions omit the run | `message-source-transform.ts` adds the actual page-prop run to those six URLs; guarded exact-file Vite transformation adds `usePage` to the two whole controls | Only identity/transport expressions change. Canonical bytes, JSX, local state, styling and controls remain intact; unmatched source shape fails the build. |
| Peer prompt GET/POST | `playback-message-api.ts` → `/learner/play-runs/{run}/activities/id:{activity}/peer-message` | Project actual `has_contributed` and `topic_title`. The peer prompt never consumes messages, pagination or topic ID; do not fabricate these unused fields. |
| Private support GET/POST | Same adapter → `/support-request` | Project actual contribution state, nullable own request and its reply IDs/bodies. Null request becomes an empty messages collection; no peer data or invented support response. |
| Wall GET and source pagination | Same adapter → `/peer-wall?page=...&per_page=...` | Map every consumed message/response flag, body, UUID and all four pagination values. Preserve source 3-row narrow/10-row desktop pages and native 12-row maximum; forward AbortSignal. |
| Reply POST; helpful mark/clear PATCH | Native `/peer-wall/messages/{message}/responses` and `.../{response}/helpfulness` | Preserve actual response type/body and boolean mark, CSRF, native authorization and idempotence. Unknown/duplicate query keys, invalid/unbound run IDs and unsupported operations reject explicitly. No Laravel request fallback. |
| Prompt continue/skip and wall close callback | Existing uncached `completePlaybackActivity` and actual completion receipt | Advance only after native success; no fabricated progress or message requirement. Full copied NodePlay/check-in/route ownership is still pending. |

`world-api.ts` dispatches only these exact source-shaped routes. Both copied
and pinned-main reference modules use the documented transport seam; browser
comparison proves presentation/local interaction preservation, while native
contract tests above independently verify backend semantics. The test-only
`canonical-player-message.{html,tsx}` host binds a real Rust playback document,
loads actual translations and observes completion/destination callbacks. It
does not replace the whole owning player or claim full-route activation.

`canonical-player-message-live.spec.ts` uses two independent real learner runs
and disposable PostgreSQL fixtures, with no response mocks. It covers loading,
peer/private submission, optional support skip, latest-three private replies,
empty and paginated walls, typed peer response persistence, helpful mark/clear
and refresh, failed reads, failed writes retaining drafts and recovery. Controls
are checked for visible bounds at 1440×900 and 390×844; source/canonical text,
bounds and screenshot pairs are attached. Guards reject foreign URLs, missing
or unbound runs and unknown query fields. Successful callbacks are checked
against actual native receipts and persisted route state. Fixtures are removed
through the scoped local author API with only their own transition/principal
cleanup; no production data is used.

**Open source defects, not waived:** the wall's GET catch sets state to null,
then renders the same copy as a genuinely empty wall. The source close handler
sets `closing` before awaiting completion and has no catch/finally. A real
unavailable-node completion rejects with 404, leaves the close control disabled
and produces an unhandled rejection without advancing native or local state.
Reload after restored access permits successful completion. The browser cases
preserve and record these defects on both source and canonical controls; full
player error acceptance must address recovery at its authorized boundary.
Prompt skip/previous-contribution continuation similarly has no local error
catch by source inspection and needs owning-route failure coverage. Visual
review also shows a desktop wall card crossing the component's right edge and
being clipped by its overflow container in both source and canonical renders;
this remains an open layout limitation, not a canonical-source modification.
Only the previously explicitly accepted Welcome clipping is waived.

This is an ordinary-run component prerequisite. Peer replay open/read/complete,
replay node identity, other remaining activity controls, anonymous playback and
the whole player lifecycle remain incomplete. Production NodePlay stays
explicitly unavailable; these component checks do not count it as migrated.

Verification passed: 299 canonical source files plus CSS, frontend production
type/build, generated OpenAPI client drift, Rust workspace format/check and
126 persistence unit tests (six existing database tests ignored). The 22 real
Rust message browser cases passed in 51.5 seconds; 38 existing Shared Task,
question/reflection/review, grant and obstacle cases also passed with the shared
transport dispatch. All 68 screenshot pairs were compared: 64 are pixel-identical;
four differ only around controls by at most 4/255 per channel (at most 1532
pixels in a pair). Prompt/support/wall renders were visually inspected at both
viewports. Known source limitations above remain open, regardless of test pass.
No canonical UI, backend, OpenAPI or database migration changed in this adapter
slice. Both interrupted and final message fixtures were removed.

Reports are ignored `frontend/playwright-report/player-message-ui/` and
`player-message-shared-regression/`. With the real local Rust stack on 8081,
existing disposable sessions and the whole-source evidence Vite server on 8084
(`npx vite --host 127.0.0.1 --port 8084 --strictPort --config e2e/learner-layout-vite.config.ts`),
rerun from `frontend/`:
`PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-message-live.spec.ts --reporter=line,html`.

### NPC dialogue source contracts and command access

The next complete control is pinned
`resources/js/features/world/npc-dialogue-player.tsx`, including its scene,
question, reflection, typing and navigation implementations. Dependencies include
`features/world/api`, `features/sounds/dialogue-typing-sound-player`,
`features/tools/tool-selection`, `components/ui/button`, appearance/translation
hooks, source learning types, source page props and CSS. Server owners are
`LearningWorldController::{updateNpcDialogueState,answerNpcDialogue,grantNpcDialogueTool}`,
`LearnerJournalController::storeDialogueReflection`,
`LearnerActivityPlayStateService`, `NpcDialogueAnswerService`,
`LearnerNodeAnswerEventService` and `LearnerActivityAccessService` under `app/`.
No NPC presentation is activated by this prerequisite.

| Source requirement | Existing Rust evidence | Concrete remaining integration work |
| --- | --- | --- |
| Complete graph, private cursor/history and typing sound definitions | `learner_playback{,_presentation,_private_state}.rs`, existing `playback-projection.ts` | Preserve real node/tool/sound UUIDs through exact source numeric-identity seams; test typing/media behavior, history restore and local controls. |
| Local forward/back stores current node and last 40 history entries | Source `updateNpcDialogueState`; native `/npc-dialogue/{continue,back}` own server navigation | These are not interchangeable requests. Define a bounded, authorized state mapping preserving source navigation and history, rather than silently dropping state writes or recreating navigation UI. |
| Answer validates authored question/answer, stores answer and applies authored node events | Source `NpcDialogueAnswerService` and `LearnerNodeAnswerEventService`; native `/npc-dialogue/answer` now stores evidence and applies events as verified below | The real selected-answer receipt is available. Still reconcile source skipping the answer display node with native cursor movement. No fabricated successful answer projection. |
| Tool grant on the current source dialogue node, including initial node and already-owned skip | Source `grantNpcDialogueTool`; native grants a configured tool when advancing into a node | Complete initial/current-node grant semantics and inventory refresh before binding copied grant controls. Preserve actual configured identity and managed media. |
| Private reflection and authored route exit | Existing `/npc-dialogue/reflection`, generic completion/receipts | Reconcile source reflection/exit behavior and labelled end transitions. Failed reflection atomicity is repaired below; invalid question/absent next edge must not create or change journal content. Whole callback failure coverage remains required. |
| Current node access before every command | Existing `learner_npc_dialogue.rs` checked publication and map roles but omitted computed availability | Repair below reuses the shared evaluator for ordinary and existing replay command contexts before state/tool/reflection writes. Replay node identity among multiple nodes sharing an asset remains part of the broader unresolved run-binding audit. |

The eight new native access regressions reproduced successful writes from a
locked node for continue, answer, back and reflection in both ordinary and
replay runs. `learner_npc_dialogue.rs` now projects the owning node ID/state/
visual configuration, checks that ordinary start and progress refer to the
same node, and evaluates current availability before state initialization or
any command mutation. It loads the existing availability facts once per command,
not per graph node; publication, map roles, ownership, CSRF, graph edge checks
and transaction boundaries remain in place. OpenAPI descriptions now record
these access requirements for all four operations.

`canonical-player-npc-contract-live.spec.ts` uses disposable local author-created
maps, actual route/replay rows and the real Rust API. It checks locked/hidden/
scheduled rejection, each publication layer, removed roles, revoked manual
unlock, completed runs, wrong owners/unknown runs, absent CSRF and ordinary
start/progress node mismatch. Failed commands must leave exact cursor/history,
tool holdings, reflection and fixture journal rows unchanged. An active manual
unlock permits the real command, with its actual target/history and tool or
private reflection persistence. Fixtures and journal/tool records are removed.
This verifies the existing native command access boundary, not whole copied
NPC control parity or replay identity in a multi-node asset.

Verification: eight access cases failed before the repair with HTTP 200 instead
of 404 on a locked node. All eight now pass, together with the existing native
NPC playback identity/graph/private-state regression (nine tests, 21.9 seconds)
against the rebuilt local backend. Canonical identity, production frontend
type/build, generated OpenAPI client consistency, Rust workspace format/check
and 126 persistence unit tests pass (six existing database tests ignored).
The readiness endpoint reports healthy. No source UI or migration changed;
this backend-only slice has no new visual-parity claim. Reports are ignored
`frontend/playwright-report/player-npc-access{,-baseline}/`. Rerun from
`frontend/`: `PLAYWRIGHT_HTML_OPEN=never npx playwright test e2e/canonical-player-npc-contract-live.spec.ts e2e/canonical-playback-reference-live.spec.ts --grep 'native NPC|native npc_dialogue' --reporter=line,html`.

### NPC reflection rejection is atomic

The NPC audit identified a concrete mismatch with the existing native operation's
atomicity promise: `save_current_dialogue_reflection` resolved its next edge only
after inserting a private reflection and appending journal markdown. A missing
edge therefore returned 404 while committing those writes; an invalid authored
question could also leave a newly created empty journal page. Initializing the
dialogue cursor before rejecting a wrong initial node could leave state behind.

The same ordinary/replay integration fixtures reproduced journal/reflection
changes after a rejected missing-edge command in both run kinds. The repository
was repaired to validate the question and authored next edge before writes and
roll back every rejected transaction, including provisional cursor initialization.
The source completion contract below now supersedes rejection of a missing edge:
a terminal reflection saves successfully and keeps its current cursor. Invalid
questions and unauthorized requests still roll back atomically.

The focused regression extension checks missing next edges, blank/oversized
authored questions and wrong initial node without any pre-existing dialogue
state. Rejected calls preserve exact cursor/history, tool, reflection and journal
rows. One fixture begins without a journal page; the replay fixture begins with
existing private markdown and verifies that successful recovery retains it.
The previously verified access/CSRF/publication/run guards remain covered.
OpenAPI now states the no-mutation guarantee explicitly. Remaining source
reflection mapping and whole NPC/NodePlay acceptance are still pending.

Verification: both missing-edge baseline cases returned 404 with changed private
rows. After repair, all nine native NPC access/playback cases pass in 20.8 seconds,
including malformed-question, provisional-state rollback and successful retry
checks. Canonical source identity, frontend production type/build, generated
client consistency, Rust workspace format/check and 126 persistence unit tests
pass (six existing database tests ignored). The rebuilt local service is ready;
no canonical presentation or database migration changed. Reports are ignored
`frontend/playwright-report/player-npc-reflection{,-baseline}/`; the NPC rerun
command above covers these cases. Next: complete the audited source cursor,
cursor-to-answer handoff, initial-node grant and reflection/exit contracts before adding
whole-control adapters; do not reinterpret these native repairs as UI completion.

### NPC answer evidence and authored node events

Pinned source owners are `app/Learning/Services/{NpcDialogueAnswerService,LearnerNodeAnswerEventService,LearningNodeStateResolver}.php`,
`app/Models/NpcDialogueAnswer.php`,
`database/migrations/2026_07_08_000002_create_npc_dialogue_answers_table.php`,
`resources/js/features/world/npc-dialogue-player.tsx` and the controller/access
owners above. The copied question posts the selected authored answer, consumes
its real `answerNodeId`, clears local history and moves to that answer's outgoing
node. The source service also stores answer evidence and applies configured
`events.hideNodeIds` / `events.unlockNodeIds`; advancing only a Rust cursor does
not fulfill that contract.

| Required contract | Native evidence / implementation boundary |
| --- | --- |
| Stored selected answer, authored label and correctness, nullable feedback | Extend the existing authorized `/npc-dialogue/answer` transaction with a private answer snapshot. Keep existing top-level cursor fields and add a typed `answer` receipt sourced from the validated authored row. Source always records null feedback here. |
| Authored hide/unlock effects, first event timestamp and discovery | Native authoring already validates UUID arrays of at most 100 targets per kind within the owning World. Use bounded batched target validation, normalized private event rows and existing discovery records; preserve first timestamps on repeated answers. Missing deleted targets are skipped as in source; malformed/out-of-World configuration rejects atomically. |
| Current evaluated availability after answer | Reuse existing domain facts `is_hidden_by_answer` / `has_answer_unlock`, now backed by `learner_node_answer_events`. Load both event kinds in one principal-scoped query; do not duplicate state policy in the browser. Existing hidden/schedule precedence remains authoritative. |
| Ownership and retention | Answer records cascade with their question/activity, as in source. Target-node events survive deletion of the source answer/activity, with nullable provenance references, and disappear with their target/principal. Preserve real target effects without fabricated deleted authoring records. |
| Failure/transaction semantics | Authenticated current-run authority, publication, map roles, node availability, selected-edge validation and CSRF remain required. Reject invalid targets before any answer/event/cursor write. No new anonymous writer or frontend activation. |

The initial ordinary/replay regression failed on the absent source answer
receipt. The extended cases verify persisted snapshots, real World availability
and peer isolation.
Whole copied dialogue adaptation still requires the separate cursor, initial
grant, reflection/exit and media contracts already listed above.

**Verified native contract:** `learner_npc_answer.rs` records the actual authored
answer and applies both effect kinds inside the already-authorized NPC command
transaction. The response adds typed `answer` facts while preserving the existing
cursor fields. Migrations `0110` and `0111` establish private evidence/events and
owner/reference indexes. Target lookup is one bounded query for at most 200
references, followed by batched event/discovery upserts per nonempty kind; there
are no per-target SQL calls. Availability adds one indexed principal query for
both kinds and reuses the existing domain precedence. Both forward migrations
were applied to the local Rust application database and verified in
`_sqlx_migrations`; no Laravel or production migration was run.

`canonical-player-npc-answer-evidence.ts`, invoked by the existing ordinary/replay
NPC contract cases, verifies actual answer snapshots and World reads. It covers
unknown/disconnected answers, malformed/oversized event lists, existing
foreign-World targets, deleted and duplicate targets, private hide/unlock effects,
hide-over-unlock and schedule precedence, principal isolation, stale retries,
second-answer history/provenance, first event/discovery timestamps, retention
after selected-answer/activity deletion and cleanup with target deletion.
The access/CSRF/publication/failure checks now also assert that no answer/event
records change on rejection. Source file identity is checked against the pin.

Validation passed: the two initial cases failed on missing answer receipts;
all nine NPC native integration cases now pass, together with four existing
World availability/identity browser cases at 1440×900 and 390×844. Both answer
cases passed again after migration `0111`. Canonical identity (299 files plus
CSS), frontend production type/build, OpenAPI client consistency, Rust workspace
check/format, 126 persistence tests (six existing ignored), 13 availability-domain
tests and the embedded-migration uniqueness test passed. Local readiness is
healthy and test maps/evidence/events were cleaned up. There is no new visual
parity claim for the still-unavailable NPC player.

Reports: ignored `frontend/playwright-report/player-npc-answer{,-baseline,-index}/`
and `player-npc-answer-world-regression/`. The NPC rerun command above covers the
new assertions. The final eight measured World reads took 8–13 ms and returned
40272–44638 bytes; the earlier run during a concurrent build included a 925 ms
outlier. These are local observations, not an SLA. The active World/Paths
availability notes and ADR-028 now reference the implemented native facts
without claiming whole route-family acceptance.

### NPC cursor/history transport contract

The whole pinned player persists forward/back navigation through
`LearningWorldController::updateNpcDialogueState` and
`LearnerActivityPlayStateService::updateNpcDialogueState`. Its actual UI requests
carry a non-null authored node ID; the source controller accepts at most 40
history entries. Reaching an end/null destination instead invokes completion. Its source helper accepts null
for normalization, but the copied navigation controls do not persist a null
cursor. Preserve those controls and their local history; do not translate them
into an unrelated native Next/Back UI.

A narrow `POST /learner/play-runs/{run}/activities/{activity}/npc-dialogue/cursor`
now validates the actual proposed cursor/history against the authorized native
state. Allowed requests are exact retries, a recorded history pop, an authored
monologue/answer `out` edge with the corresponding history, and the source's
already-owned configured-tool skip without a history push. A question cannot be
answered through a cursor write, and a reflection must be saved through its
existing command. The answer-to-next handoff may preserve the cleared history;
reflection-to-next is an exact retry of the reflection command's stored result.

This endpoint must not grant tools, mark progress or record answers/reflections.
It reuses publication, ownership, node availability and CSRF guards, rejects
unknown/foreign nodes and malformed/oversized history, and rolls back provisional
state on rejection. The whole source's asynchronous persistence calls will need
a binding-scoped ordered transport adapter; silently dropping or reordering
writes is not acceptable. Initial/current-node grants and end/exit completion
remain separate contracts before full control activation. The source local
history can exceed its controller limit; this remains an open source acceptance
limitation, not an authorized silent truncation.

**Verified native contract:** `learner_npc_dialogue.rs` in API/application/
persistence and OpenAPI `updateLearnerNpcDialogueCursor` implement these checks.
`canonical-player-npc-contract-live.spec.ts` covers ordinary and replay runs,
publication/role/availability/ownership/CSRF guards, exact retry and back,
question/reflection bypass rejection, owned-tool skipping, answer/reflection
handoffs, 40/41-entry bounds, and rollback of rejected initialization. The two
baseline cursor cases failed with the missing endpoint; all 11 native NPC
contract/reference cases then passed against the rebuilt local Rust service.
Canonical identity, frontend production type/build, generated client drift,
Rust workspace fmt/check and 126 persistence tests passed (6 ignored). Evidence:
ignored `frontend/playwright-report/player-npc-cursor/`. This is API integration
evidence, not whole-player browser acceptance; the copied player remains
unavailable pending its remaining contracts and both-viewport UI evidence.

### NPC initial/current-node tool grant

Pinned-source dependencies: whole `features/world/npc-dialogue-player.tsx`,
`LearningWorldController::grantNpcDialogueTool`, `LearningToolGrantService::
grantFromNpcDialogueNode` and shared tool inventory/media projection. The copied
player requests the configured tool on first display, including the initial
node; it consumes the returned `tool` to update the shared inventory and grant
notice. A tool already owned causes a source-authored skip instead.

| Required source behavior | Existing Rust evidence | Required adapter/contract |
| --- | --- | --- |
| Grant configured tool on initial/current monologue or question | `grant_configured_tool_for_node` in persistence `learner_npc_dialogue.rs` already resolves published tools and maps media, but only runs on native advancement | Add a run/activity/node-bound command that reuses this helper and requires the requested node to be the actual current cursor. No browser-supplied tool identity. |
| Returned tool and inventory update | Existing `LearnerTool`, shared tool mapper and copied inventory event mechanism | Return actual `granted_tool` in `LearnerNpcDialogueState`, preserving current cursor/history; map to source `{tool}` during whole-player activation. |
| Idempotence and access failure | Existing current-dialogue ownership/publication/role/availability and CSRF guards | Reuse all guards, initialize authored start transactionally, roll back invalid node/config/publication without provisional state or inventory writes; no answer/reflection/progress writes. |
| Media | Existing `learner_media::learner_tool` | Reuse managed media URLs; never copy raw storage paths into source props. |

The whole source catches grant failures and clears its notice without surfacing
an error or retry. This is an open source behavior for browser acceptance, not
permission to fabricate a successful grant or mark the complete player ready.

**Verified:** `POST /learner/play-runs/{run}/activities/{activity}/npc-dialogue/
nodes/{node}/grant-tool` implements this contract via existing Rust grant logic;
OpenAPI `grantLearnerNpcDialogueTool` and the generated client describe it.
The two baseline grant tests failed against the absent route; all 13 native NPC
integration/reference cases passed after implementation. The added ordinary/
replay cases verify initial and existing cursors, both grant-capable node types,
current-node identity, missing/malformed/unpublished configuration, all shared
access guards, concurrent idempotent retries preserving acquisition time,
unchanged cursor and rollback of invalid initialization. They also prove that
answer/reflection/end nodes cannot grant, even with configured tool data.
Canonical identity, frontend type/build, generated API drift, Rust workspace
fmt/check and 126 persistence tests passed (6 ignored). Local report:
`frontend/playwright-report/player-npc-grant/` (ignored).

The next audited gaps were first-node fallback without an explicit entry,
end/null completion before cursor persistence, and dialogue-specific activity
exit selection. The following contract repair resolves those native gaps;
whole copied-player transport and browser acceptance remain separate.

### NPC source completion and fallback entry contract

The pinned whole NPC player's `firstNpcDialogueNodeId`, `moveToNode` and
`npcExitTransition` own this behavior. Source `LearnerJournalController`
saves the reflection separately before the player invokes completion. Rust
already has owner-scoped completion/evidence/route advancement; reuse it.

| Source requirement | Rust gap and bounded implementation |
| --- | --- |
| Start at explicit entry or first authored non-answer/non-end node | Share the same ordered fallback between native reads and state initialization; no synthetic node/edge. |
| Complete before persisting an end cursor, or when there is no next node | Resolve the actual current authored node and its `out` edge under the owned run lock. Allow only terminal monologue/answer, already-owned configured-tool question skip, saved terminal reflection, or stored end. Reject nonterminal or unanswered/unreflected nodes. Recheck current node access. |
| Specific `dialogue-end-{id}` exit, then first completed-trigger fallback | Select from stored activity transitions in source order; validate the actual next activity before progress/evidence writes. Replay remains terminal under its existing isolated contract. |
| Reflection with no outgoing edge still saves before completion | Record its actual authored node identity on the private reflection, retain its cursor, and require that persisted per-run evidence to finish. A reflection at another node/run is insufficient. Preserve atomic rollback on invalid reflection data. |
| Failure or retry | No provisional state, progress or evidence on rejection; a completed/stale run cannot write another receipt. Missing contracts keep whole NodePlay unavailable. |

These native contracts precede the ordered copied-player adapter and whole-source
browser evidence. No JSX, styles or source-local interactions are being edited.

**Verified native implementation:** `learner_npc_dialogue::{initial_node_id,
completion_exit}` shares source entry ordering with the playback read and state
initializer. `learner_playback::complete_current_activity` uses the resolved
exit with its existing progress/evidence and destination-validation transaction.
Migration `0112_npc_reflection_node.sql` adds nullable, indexed authored-node
provenance to private reflections; existing records stay unchanged, and authored
node deletion preserves their text by nulling provenance. Terminal reflection
save retains the current cursor and completion checks the exact node/run.

The two source-completion baseline cases returned 404 for legitimate end exits.
After repair all 28 NPC and shared native playback integration/reference cases
passed against the rebuilt local service. The completion fixtures exercise
ordinary/replay end and null exits, specific-over-fallback routing, explicit
terminal exits, stored end cursors, first-node fallback read/initialization,
owned-tool question skips, reflection evidence and stale retries. They reject
locked/hidden/scheduled/unpublished/role-denied access, a nonterminal cursor,
an unanswered question, an unsaved or differently scoped reflection, a foreign
owner, missing CSRF and an unpublished destination without changing progress.

Canonical identity, frontend type/build, generated OpenAPI/client drift,
Rust workspace fmt/check, 126 persistence tests (6 ignored) and the embedded
migration-version check passed. Migration 112 and its index were verified in
the local database. Both completion cases also passed a focused retention rerun:
deleting the authored reflection node nulls provenance while preserving the
saved question and reflection text. Reports are ignored
`frontend/playwright-report/player-npc-completion{,-baseline,-retention}/`.
These are native integration checks;
whole-source UI at both viewports is still required.

**Next copied-player binding requirements:** `learner_playback_presentation.rs`
previously retained node `config.toolId` as the authored public tool slug, while
source `NpcDialogueActivity` compares catalog IDs. The projection repair below
resolves actual catalog UUIDs; do not rely on test UUID-shaped slugs.
Keep numeric presentation values numeric while adapting only current/history,
tool and typing-sound-set identities. Preserve the whole source module and
serialize its cursor/grant/answer/reflection/completion requests per bound run
so optimistic local moves cannot reorder persisted state. Initial grants,
answer receipts, terminal exits and failure behavior must then be exercised by
the actual copied control before whole NodePlay activation.

### NPC configured-tool identity projection

Source `NpcDialogueActivity` compares `config.toolId` with `auth.tools[].id`;
Rust authoring stores tool slugs. Both native current-dialogue and graph-node
reads must resolve existing references to the actual catalog UUID, without
changing stored authoring data or numeric scene/typing configuration. Resolve
this in the existing bounded node query with a tool join, not per-node queries
or a browser-generated numeric-ID table. Retain unresolved authored references
so actual node-bound grants can fail normally; never fabricate a catalog entry.
Shared managed-media rewriting remains applied to the resulting configuration.
The regression uses a human-readable tool slug distinct from its UUID in a real
Rust-backed document and checks both projections plus unchanged storage.

**Verified:** the baseline failed with a slug where the copied control requires
the tool UUID. After the bounded join/shared projection repair, all five focused
NPC reference/grant/completion integration cases passed. An unresolved slug
remains unchanged in both reads, its real grant request returns 404, and no
provisional cursor remains. A focused Rust test covers numeric scene values,
managed-media rewriting and missing references. All 127 persistence tests
passed (6 ignored), with workspace fmt/check, canonical identity, frontend
production type/build and generated API drift checks passing. Reports are
ignored `frontend/playwright-report/player-npc-tool-reference{,-baseline}/`.
No migration, canonical file or player activation changed in this projection
slice.

The remaining whole-control adapter must bind each source URL to its actual
run/activity/node, preserve opaque IDs and serialize cursor, grant, answer,
reflection and completion operations within that document binding. Exercise
rapid navigation, reload and stale-node failures rather than assuming request
ordering from local React state. Source catches/discards some persistence and
grant errors; record observed failure behavior in the both-viewport evidence
without manufacturing receipts or claiming successful persistence.

### Whole copied NPC control transport and browser acceptance

Source owners at the pin: complete `features/world/npc-dialogue-player.tsx`,
`features/sounds/dialogue-typing-sound-player.ts`, `features/tools/tool-selection.ts`,
`components/ui/button.tsx`, `hooks/{use-appearance.tsx,use-platform-translation.ts}`,
`lib/utils.ts`, `types/index.ts` and canonical CSS. The complete module retains
its scene, character/asset layers, typing effect, keyboard handling, answer and
reflection controls, local history and inventory effects. Exact guarded build
substitutions adapt only four URL/run seams and four identifier coercions.

| Source request/prop | Typed Rust binding |
| --- | --- |
| Current node/history, configured tool and typing-sound-set IDs | Preserve actual string identities; numeric dimensions, speed, opacity and positioning keep source numeric helpers. Initial state uses the real saved dialogue projection. |
| `/learning/activities/{id}/npc-dialogue-state` | Bound `updateLearnerNpcDialogueCursor`; send actual proposed node/history and verify response membership. |
| `/learning/npc-dialogue-nodes/{id}/grant-tool` | Bound `grantLearnerNpcDialogueTool`; map actual returned catalog tool into the copied inventory event mechanism. |
| Node answer and reflection URLs | Existing commands with optional `expected_node_id`, supplied by the copied URL adapter and checked under the current cursor lock. Never apply stale-screen text or an answer to another node. |
| Parent completion callback | Existing Rust completion, queued after prior node writes; compare the real receipt with the source-selected exit. |
| Ordering/failures | One queue per activity/document binding. A failed optimistic cursor write prevents subsequent queued success claims until reload; rejected grants/answers/reflections preserve source retry/back behavior under the native guards. Source error handling stays intact; no synthetic completion or generic transport emulation. |
| Read/media/inventory dependencies | Real playback, shell, translations and sound-preference endpoints; existing managed/static media delivery and whole copied typing/tool helpers. |

Test-only `canonical-player-npc.{html,tsx}` mounts the complete copied or pinned
main control with real Rust props and observes its parent callbacks. It does
not implement the owning NodePlay/check-in/navigation lifecycle or activate
that route. The normal resolver remains unavailable pending whole-route gates.

**Verified NPC control evidence:** `canonical-player-npc-live.spec.ts` passed
18 real Rust/PostgreSQL cases (nine scenarios at each required viewport):
forward/back and resumed history, authored question to private reflection and
terminal completion, initial tool grant, owned-tool skip, ordered rapid cursor
writes, completion waiting for pending writes, rejected cursor/grant/stale
reflection, and unavailable projection. Actual SVG loading, typing sound bytes
and playback volume, inventory updates, bounded visible controls, URL/run/node
guards and absence of Laravel requests are asserted. The evidence host uses
two isolated learner/map fixtures and the complete pinned main module for its
comparison; it is component-level evidence, not full NodePlay route acceptance.
The ignored `frontend/playwright-report/player-npc-ui-final/` contains 42
source/canonical screenshot pairs: 41 pixel-identical; the sole difference is
at most 1/255 in a 6×3-pixel text-antialiasing area. Desktop scene/question and
narrow question/reflection screenshots were visually inspected.

The native stale-node regression first returned 200 instead of 404 for both
answer and reflection. The locked expected-node check now rejects a stale
source URL before answer, cursor, journal or reflection writes; native callers
omitting the optional field retain their established behavior. The focused
native guard suite also checks malformed expected UUIDs return 422 with no
writes, ordinary/replay ownership, availability, publication, roles and CSRF.

**Open inherited source defects:** failed cursor persistence leaves optimistic
local navigation without an inline error; a failed grant removes its notice
without error/retry UI; reflection submission retains its draft but rejects
without a catch/inline error. The adapter emits operation-unavailable events
and blocks later cursor-dependent success claims after a failed cursor. These
source defects are recorded, not waived or redesigned; whole-route error and
recovery acceptance remains open. The parent lifecycle must still reconcile
actual next-activity receipts, replay exits and refreshed documents.

Verification also passed canonical identity (299 JS/TS files plus CSS), production
frontend type/build, generated OpenAPI client drift, Rust workspace fmt/check
and 127 persistence tests (six opt-in database tests ignored; real database
behavior is covered by the live suites). The 60 shared player browser checks
passed in separate batches: 14 obstacles, 12 responses/Shared Task, and 34
grants/messages; the updated 12 NPC native guard cases passed alongside the
response batch. The preceding combined shared run was terminated by SIGTERM
without an assertion failure; its exact disposable map/catalog fixture was
cleaned and these completed batches supersede that interrupted result.
Rerun from `frontend/` with the local Rust stack on 8081 and the existing
`e2e/learner-layout-vite.config.ts` evidence server on 8084: run
`canonical-player-npc-live.spec.ts` and `canonical-player-npc-contract-live.spec.ts`,
then the five `canonical-player-{grant,obstacle,response,shared,message}-live.spec.ts`
files serially. Reports are retained under ignored
`frontend/playwright-report/player-npc-{ui-final,shared-obstacle,shared-response,shared-grant-message}/`.

### Markdown player source contract reconciliation

Pinned source: complete `features/world/markdown-activity.tsx`,
`features/platform-info/markdown-renderer.tsx`, `features/world/activity-utils.tsx`,
`components/ui/button.tsx`, appearance/translation hooks, `lib/{media-url,utils}.ts`,
source types and CSS. `LearningActivitySerializer::learnerConfig` preserves the
stored page graph. `MarkdownActivityConfiguration` and `AdminActivityRules`
bound individual IDs/titles/bodies to 100/160/20000 characters but impose no
30-page/60-edge cap. The Rust authoring form currently does impose those caps;
that is a separate outstanding authoring contract gap, not a source rule.

| Source dependency | Rust evidence / required boundary |
| --- | --- |
| Complete ordered pages and edges, string identities, body and visual values | Shared `learner_playback.rs::markdown_safe_config` feeds current activity and navigation graph. Existing `.take(30/60)`, trimming, de-duplication and dangling-edge removal can change the source's first-match traversal and prematurely complete a page graph. Replace silent changes with intact bounded reads; oversized/malformed reads must fail explicitly. |
| Page/back history, first authored start, missing/terminal edges, keyboard behavior and empty view | Whole copied MarkdownActivity owns this local state; refresh starts at its authored first page, not a fabricated persisted cursor. No Markdown cursor endpoint is needed. |
| Completion and parent destination | Reuse bound typed playback completion and its actual receipt; do not acknowledge an optimistic source destination. Parent NodePlay/check-in/navigation remains an open route gate. |
| Markdown media/link URLs | Original renderer and media normalizer remain presentation owners. Managed admin-content URLs embedded in body text currently bypass recursive whole-string media rewriting. A narrowly scoped renderer transport seam must map only exact managed paths; preserve body text and all unrelated URLs. Existing learner-media endpoint independently verifies saved publication/role references. |
| Failure, unavailable and source comparison | Real Rust fixtures must prove long graph preservation, traversal/back/refresh, completion denial, empty state and managed media at both viewports. Preserve source failures without counting them as accepted route recovery. |

Implemented read boundary: preserve up to 1000 pages, 4000 edges and 2 MiB of
projected text, with the source's individual field limits; exceedance rejects
the whole read. The source's empty-string/default semantics, duplicate IDs and
first dangling edge remain intact. The initial regression failed on 31→30 page
loss. Rust authoring's smaller 30/60 limits remain open for its own route family.

The `?learner-markdown` renderer import scopes the URL facade to Markdown
playback. Only the original renderer's media normalization and link URL sink
receive exact managed-path rewrites; other uses of the shared renderer,
authored body text (including visible inline code), external/custom/malformed
URLs and source JSX remain untouched. `playback-markdown-api.ts` reuses the
existing document binding and deduplicated typed completion receipt.

The initial real browser failure also proved Markdown completion could write
after its node became locked. Completion now evaluates native availability and
validates ordinary start-node identity and the complete Markdown configuration
under the run transaction before progress/evidence writes. Source Markdown has
no completion catch/pending/inline-error UI; the failure evidence must retain
its last page without manufacturing a receipt or navigation. That inherited
source defect is not waived, and parent route/check-in/replay navigation and
anonymous acceptance remain open.

**Map-scoped Markdown video prerequisite:** source
`pages/settings/worlds/{edit-markdown-activity,markdown-activity-fields}.tsx`
uses `use-node-image-upload.ts` → `/settings/worlds/node-images` →
`AdminWorldController::uploadNodeImage`, `AdminWorldRules::uploadNodeImage`,
`NodeImageUploadService`, `ProtectedMapMedia`, and `ProtectedMapMediaController`.
These eight inspected source dependencies match the pin. The pinned
`tests/Feature/Settings/AdminWorldsTest.php` was inspected with `git show`
because the current branch has additional tests: its Markdown test preserves
a WEBM body reference, but does not prove browser video playback.

The source accepts 50 MiB files and GIF/JPEG/JPG/M4V/MOV/MP4/OGG/OGV/PNG/SVG/WEBM/WEBP
extensions, checks map edit scope on upload, and protects map-bound delivery
through map view access. Its delivery URL retains the extension; the copied
renderer uses that extension to select the whole video or image element.

| Boundary | Rust evidence / adapter | Verification and remaining work |
| --- | --- | --- |
| Scoped upload and unsaved preview | `api/src/admin_world_map_visual_media.rs`, `/admin/world-builder/maps/{map_id}/visual-media`; migration `0113_scoped_video_media.sql` records uploader/map binding atomically with each new upload | Existing 50 MiB/map-editor/CSRF checks retained; detected MP4/M4V, QuickTime, WebM and Theora Ogg added. Real format samples and wrong-map/uploader/CSRF/invalid-file rejection covered. Legacy images without an originating-map record retain their previous creator/scope preview behavior. Generic image-library upload remains image-only. |
| Saved references and explicit cleanup | Existing `persistence/src/admin_world_markdown.rs::{media_references,synchronize_media_references}` and native Markdown create/update; new scoped `DELETE .../visual-media/{asset_id}` | Actual authored replacement/removal revokes learner delivery. Only the original uploader with matching map scope may delete an unused upload. Asset row locking and a fresh reference check prevent deletion of saved media; storage failure retains the registry entry for retry. Browser checks inspect the test-owned object before/after deletion. |
| Learner delivery | `api/src/learner_media_assets.rs`, shared `api/src/video_media.rs`, `MediaStore::{size,get_range}` | Existing saved-reference/publication/role authorization runs before byte or length delivery. Valid single byte ranges return 206, invalid ranges 416; range reads use bounded object-store reads. Real WebM and MP4 browser decoding/playback and replacement are covered. |
| Copied video classification | `LearnerPlaybackPresentation.markdown_media`, `learner_playback_presentation.rs::enrich`, `playback-context.ts`, `playback-markdown-api.ts`, `markdown-source-transform.ts` | One query for actual saved Markdown image/video references on the authorized graph, capped at 4096 entries with whole-read rejection on overflow. Active document binding validates exact managed URLs and supplies MIME classification at the original renderer's `mediaKind` seam. Reload/replacement releases obsolete classification. No fabricated extension, body rewrite or per-element metadata requests. |
| Source comparison | `frontend/e2e/canonical-player-video-live.spec.ts`, existing whole Markdown evidence host and source identity checks | Copied and pinned-main trees render the same source video controls at 1440×900 and 390×844. Source JSX/CSS remain unchanged. This host does not activate or emulate the parent NodePlay lifecycle. |

The oversized-file regression additionally exposed two earlier transport
ceilings: Nginx's default and Rust's global 5 MiB limit prevented the scoped
50 MiB parser from being reached. `frontend/nginx.conf` now permits 50 MiB plus
16 KiB framing only on the scoped upload path. `api/src/request_body_limit.rs`
uses Axum's matched route and POST method to grant that same ceiling; other
Rust requests keep their prior global limit. Its regression verifies the
matching POST, oversized request, wrong method and unrelated route. The real
proxy test uses an 8,504,754-byte MP4 and a rejected 50 MiB + 1-byte file.

The baseline rejected a genuine WebM upload with 422. After implementation,
the real Rust journey covers upload, creator preview/download/ranges, native
Markdown save/read, actual video decoding/playback, WebM-to-MP4 replacement,
removal, referenced-delete rejection and explicit object cleanup. Wrong-map
preview/deletion, other-user operations, missing CSRF, guest access on a
learner-only map, unpublication and invalid ranges are rejected. MIME comes
from detected bytes rather than a browser-declared filename/type. Detection is
container recognition, not a promise that every codec inside those containers
can play in every browser.

Both initial video source/copy screenshot pairs are byte-identical and were
visually reviewed: video/native controls and navigation stay bounded at both
viewports. The 40-case real Rust/PostgreSQL batch includes 14 Markdown, 14
reference, 10 response and two video checks. Its ignored evidence is
`frontend/playwright-report/player-video-regression/`. The final scoped-delete
transaction and extended proxy/video checks passed again in
`frontend/playwright-report/player-video-verified/`; 18 NPC checks also passed
with the extended shared document binding. Local video playback reads measured
4,792 bytes and approximately 12–17 ms for these single-media fixtures; this is
a local measurement, not a load-test claim. Canonical identity (299 JS/TS files
plus CSS), production type/build, generated OpenAPI drift, Rust workspace
fmt/check, 182 API tests and 129 persistence tests passed. Two API and six
persistence database tests are opt-in/ignored; the browser suites provide the
real PostgreSQL evidence. Migration 0113 is recorded successful in the local
application database; both Compose images build and Nginx configuration and
Rust readiness checks pass.

Remaining media acceptance is explicit: static/external video delivery,
anonymous/public journeys, copied authoring upload/preview integration, and
map-deletion/abandoned-upload cleanup still need their owning route evidence.
The originating-map policy repair below closes the reproduced cross-map
privacy failure. Migration 0114 retains a nullable origin record when its map
is deleted; those uploads are denied rather than treated as generic library
media. Registry/objects remain until explicit cleanup, so this does not claim
a complete orphan cleanup policy. The existing Markdown writer silently limits references to 24;
remove that truncation with bounded atomic reference synchronization before
complete authoring/media acceptance. Its 30-page/60-edge form limits also
remain source parity gaps. Storage and PostgreSQL are not one distributed
transaction; a database failure after object removal leaves a registry entry
that scoped cleanup can retry. Only a normal delete proves physical removal.
Source completion error presentation, parent NodePlay lifecycle, replay
binding and anonymous acceptance remain separate open dependencies. No route
is marked complete by this prerequisite, and production NodePlay remains
explicitly unavailable.

**Originating-map privacy repair:** pinned
`app/Http/Controllers/ProtectedMapMediaController.php` delegates to
`app/Learning/Services/LearningMapAccessService.php::canViewMap`; both files
match the recorded pin. Source media access uses its originating map's role
visibility, even when the URL is pasted into another map. Rust's existing
saved-reference policy alone did not preserve that constraint: the regression
created a private-map WebM, saved its URL through the native Markdown writer on
a public map, and an anonymous range request incorrectly returned 206.

`learner_media_assets.rs` now requires both the existing visible saved reference
and the recorded origin's role access for scoped uploads. The extra predicate
uses the indexed upload/asset relation in the same read; no per-image policy
request is added. Generic reusable-library assets without an upload-origin
record keep their existing policy. `0114_preserve_scoped_media_origin.sql`
changes map deletion to retain an explicit null origin; learner delivery and
creator preview cannot reinterpret such an orphan as unscoped media. This
preserves denial after deletion without deleting an object still referenced
elsewhere. The source role service itself does not require the originating
map to be published; the existing destination/reference publication guard
remains in effect.

`frontend/e2e/canonical-scoped-media-access-live.spec.ts` is the source-derived
real API/PostgreSQL regression for private→public copying, authorized learner
access, public-origin access, role revocation, administrator access, map
deletion and absence of leaked range length. Its cleanup removes only its
owned maps and orphan fixture; it does not pretend to implement a production
orphan collector. All 17 real browser/API cases passed: this regression plus
the 14 copied Markdown and two video lifecycle cases at both viewports. The
report is `frontend/playwright-report/scoped-media-origin-verified/`. Migration
0114 is recorded successful, readiness passes, and canonical identity,
frontend type/build, generated OpenAPI drift, Rust workspace fmt/check, 182 API
tests and 129 persistence tests pass (two API and six persistence opt-in tests
remain ignored). The previously reproduced anonymous 206 now returns 404 with
no Content-Range; allowed learner/public/admin reads still return the actual
bytes. Cross-map references cannot bypass role revocation or deleted origins.

**Verified read/control slice:** 14 Markdown browser cases passed across
1440×900 and 390×844: source start-edge selection, keyboard/back/refresh,
31 pages and 61 edges, empty state, whole-read overflow, ordinary and replay
completion, and both kinds of denied completion. Actual managed SVG bytes,
rendered dimensions, mapped image/link URLs, unchanged visible inline-code URL,
and delivery rejection after map unpublication are asserted. Both learners
use separate real runs; cross-owner reads reject. The copied component invokes
native completion and retains its original failure behavior. No Laravel HTTP
request or fabricated parent navigation occurs.

The 14 shared playback-reference checks and 10 response checks passed with
those cases (38 total). All 26 Markdown screenshot pairs are byte-identical;
desktop/narrow media renders were visually inspected and control bounds pass.
The ignored report is `frontend/playwright-report/player-markdown-verified/`.
Rerun using the Rust stack on 8081 and the learner-layout Vite evidence server
on 8084: `npx playwright test e2e/canonical-player-markdown-live.spec.ts
e2e/canonical-playback-reference-live.spec.ts e2e/canonical-player-response-live.spec.ts
--reporter=line,html`. Restart that evidence server after changing its Vite
configuration; a stale running process does not prove the new seams are loaded.
Canonical identity, production frontend type/build, OpenAPI client drift,
Rust workspace fmt/check and 129 persistence tests passed (six opt-in database
tests ignored; the browser suites provide real PostgreSQL coverage). The old
truncation unit expectation was replaced with exact-source preservation and
whole-read rejection checks, including Unicode and aggregate text budgets.


## Status and purpose

This is the active development/test implementation plan for replacing the
Laravel/Inertia application with separately deployable React/TypeScript and
Rust/Axum applications. The active completion register governs canonical
frontend acceptance. Laravel retains production ownership; this goal does not
authorize production traffic or data cutover.

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

### Mandatory source-first slice workflow

Before selecting or implementing a replatforming slice, treat the Laravel
application as the behavioral and presentation reference. For the proposed
journey, inspect its route declaration, controller/action, authorization,
validation, serializers/queries/actions, relevant models and migrations,
source React/Inertia page and focused tests. Use this evidence to define one
fresh Rust-owned schema/SQL migration set and a typed Rust contract; do not
replay Laravel migrations or import legacy identifiers/data.

For every frontend-facing slice, resolve the source baseline from the current
`main` commit before writing code. Record that commit and the exact
`resources/js` files/components being lifted in the slice evidence. A copied,
older or already-adapted component in the replatform branch is not evidence
that it still matches `main`; compare it with `git show main:<path>` when the
worktree is not on `main`.

Then lift and adapt the original React component tree and its URL/history,
loading, error, navigation and accessibility behavior around the typed client.
Do not replace an original control, navigation structure or visual hierarchy
with substitute UI merely because its backend is incomplete. A route stays
unavailable until its complete Rust contract exists. Verify the coherent slice
with focused Rust/contract coverage, generated-client checks, production build,
and browser checks at desktop and 390px. Before committing, directly compare
the running Rust route with the recorded `main` source route at both viewports:
its hierarchy, controls, labels, grouping, graph/canvas viewport, empty/loading
states, navigation and responsive overflow must match unless an explicit
product decision says otherwise. Browser assertions must prove the important
source elements are visible and reachable, not merely present in the DOM.
Record that parity evidence, commit, and push the slice to
`replatform-discovery` before beginning the next one.

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

### Canonical-frontend reset audit — 17 November 2026

**Status: reset complete.** The canonical source tree is copied under
`frontend/canonical-source/**` and is the active frontend source baseline.
This remains the binding register for route-family activation. Any former
reconstructed presentation files are retired: they are not source, migration
targets, or visual-parity evidence.

**Canonical source:** current `main` at
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`, resolved on 17 November 2026.
The source contains 299 files under `resources/js` and its one Tailwind entry
stylesheet at `resources/css/app.css`. Standalone platform code is limited to
the route resolver, Vite bootstrap, typed Rust client, and narrowly audited
compatibility facades; it is not a presentation-source tree.

#### Audit method and classification

The register below was derived from the pinned page tree, the Laravel route
declarations/controllers and the current Rust router, OpenAPI and module/test
trees. The Rust service currently exposes 398 versioned OpenAPI operations;
test-bearing modules exist in 78 API, 115 application and 59 persistence
modules. That is implementation evidence, not a claim that a source Inertia
page can consume the Rust response without an adapter.

For a source family, a contract is classified as follows:

| Class | Meaning | Reset behavior |
| --- | --- | --- |
| **R — reusable** | A Rust API route, application/persistence boundary, OpenAPI operation and focused Rust test already cover the underlying actor/action/data boundary. | Retain the Rust code and bind a narrow source transport/page-prop adapter after the exact source page tree is copied. |
| **P — partial** | Rust implements a useful portion, but does not yet project the complete source page props, match a source command/error/pagination/media shape, or have the required source-route browser proof. | Keep the copied page structurally intact; implement only the named missing contract/adapter. Do not replace controls or compose a substitute screen. |
| **M — missing** | No Rust contract exists for the source behavior, or the behavior is deliberately excluded by a recorded product decision. | Preserve the source route’s explicit unavailable/loading surface until a separately approved backend slice supplies the contract. Never invent client-side policy or a success state. |

#### Exact pinned source route/page register

Each path below is part of the exact source copy. Comma-separated entries are
separate source files and must not be selectively reimplemented. Files under
`pages/settings/worlds` that are fields/helpers are listed with the page that
owns their component tree.

| Source route family and exact page files | Shared component/dependency tree that must move whole | Laravel/Inertia/Wayfinder and page-prop seams | Rust classification and evidence | Reset disposition |
| --- | --- | --- | --- | --- |
| Public entry and information: `pages/welcome.tsx`, `pages/source.tsx`, `pages/info/{about,data-protection,imprint,show}.tsx` | `layouts/{app-layout,auth-layout}.tsx`, `components/{app-*,platform-logo,source-code-link}`, `features/{platform-info,platform-presentation}` | `Head`, `Link`, `usePage.publicPresentation`, `usePage.platformInfo`, source-link/page URLs | **P** — public presentation/content/search/world reads are registered in `backend/crates/api/src/main.rs` under `/api/v1/public/*`, with `application/src/{public_page,public_presentation,public_world,public_search}.rs`; no complete source page-prop aggregate exists. | Copy pages/layouts/styles intact. Add public page/presentation loaders first; show source unavailable state for any missing public projection. |
| Authentication and recovery: `pages/auth/{login,register,forgot-password,reset-password,confirm-password,two-factor-challenge,verify-email}.tsx` | `layouts/auth/**`, `components/{password-input,one-time-code-input,passkey-*,manage-two-factor,two-factor-*}`, `hooks/use-two-factor-auth.ts` | Inertia `useForm`, `router`, `route`, flash/errors; Fortify login/reset/verification props; `@laravel/passkeys` | Login/registration/recovery/password-confirmation/TOTP/passkeys are **R**: `session_commands`, `identity_registration`, `password_recovery`, `account_password_confirmation`, `account_two_factor`, `account_passkey` API/application modules and OpenAPI routes. Email verification/re-notification is **M**: the source verify-email page has no corresponding Rust API operation. | Copy all source files. Build a restricted auth form/session adapter around reusable contracts. Keep the exact verify-email page unavailable until verification/re-notification is implemented; do not route around it. |
| Learner World and playback: `pages/world.tsx`, `pages/learning/node-play.tsx` | `components/{learner-*,platform-feedback-prompt}`, `features/world/**`, `features/{items,learning,messages,sounds,tools}`, `theme/{appearance,cursors,presentation}` | `usePage` world/playback props, `router`, `route`, current-user/nav props, protected/public media and uploads | **P** — reusable APIs include `/api/v1/learner/world`, play-run, route/reset, activity completion, portal, question, reflection, recall, item/tool/obstacle/NPC/shared-task/message/companion routes in `api/src/main.rs`; application/persistence evidence is under `learner_{world,playback,route_run,portal,question,reflection,recall,shared_task,peer_message,companion}.rs`. A single source-shaped World/page-playback aggregate and its exact error/navigation adapter remain missing. | Copy the full World/player tree before binding endpoints. Start with read/current-run adapters; unavailable states must retain source orientation and cannot calculate transitions client-side. |
| Learner desk and records: `pages/{home,bookmarks,paths}.tsx`, `pages/competence/{index,competence-star-layout}.ts` | `features/{home,journal,competence,topics}`, `components/{learner-document-surface,learner-paginated-items,pagination-controls}` | Inertia props, `router`, `route`, page/area query state, journal overlay and export download | **P** — learner desk/search, bookmarks, paths, competence, journal/recall/revisit and preferences are implemented by `learner_{desk_search,bookmark_map,paths,topics,journal,journal_page,journal_export,recall,revisit_run,desk_planning}.rs`; their routes and generated schemas are in `main.rs`/OpenAPI. The exact source page-prop aggregation and source route/history adapter are absent. | Bind copied source pages family by family. Use source loading/empty/error views while a projection is incomplete. |
| Topics and feedback: `pages/topics/{index,show}.tsx`, `pages/feedback.tsx` | `features/topics/**`, `features/platform-presentation`, common navigation/header | `Link`, `router`, `route`, topic page props and feedback flash/errors | **P** — `/learner/topics`, topic overview/trail/maps and `/platform-feedback` are reusable (`learner_topics`, `learner_topic_detail`, `platform_feedback` modules/tests); source detail’s composed page props and navigation mapping still need an adapter. | Copy whole directory/detail/feedback trees; wire read endpoints before any route-local mutation. |
| Organizations and access links: `pages/organizations/{index,show}.tsx`, `pages/access-links/redeem.tsx` | `features/organizations/**`, access-link/current-user/navigation components | `useForm`, `router`, `route`, source redirects and validation/error props | **P** — organization, group and access-link routes are in `main.rs` with `application/src/{organization,learner_group}.rs` and `api/src/access_link.rs`; both source page-prop projection and Inertia redirect/flash compatibility are still missing. | Copy source trees whole; adapt existing commands at one route boundary and preserve source confirmation/error state. |
| General Settings and personal/security pages: `pages/settings/{index,personal,profile,appearance,language,security,about,imprint,data-protection}.tsx` | `layouts/settings/layout.tsx`, `components/{app-*,nav-*,learner-account-controls,delete-user,manage-passkeys,manage-two-factor}`, `features/settings/{settings-workspace-shell,settings-panel-directory,profile-settings-panel,appearance-settings-panel,security-settings-panel,sound-settings-panel}` | global `usePage` auth/settings/presentation/flash props; Inertia form/router/link and `route` helpers | **P** — `/api/v1/me`, profile/image/delete, password confirmation/update, TOTP/passkeys, appearance/language/sound/feedback preferences and information/public-content routes are implemented and tested in the named Rust modules above. The source’s all-settings bootstrap projection, flash lifecycle and route-to-panel mapping are not a Rust contract. | Copy the settings shell and every named source page first. Build one typed Settings bootstrap adapter; never replace nested source navigation with route-local panels. |
| Asset, presentation, localization and platform administration: `pages/settings/{admin-panel,ai,color-palette,journal,languages,presentation}.tsx`, `pages/settings/assets/{index,media,items,tools,sounds,dialogue-sound-sets}.tsx`, `pages/admin/topics.tsx` | `features/settings/{assets-world-objects-panel,asset-library-workspace,cursor-image-settings-panel,language-settings-panel,learning-*,support-*,presentation-localization-panel,access-*,content-api-panel}`, `features/{ai,sounds,topics,content-api}` | Inertia props/forms/router, generated actions/routes, media multipart/download URLs, paginated history/import/export | **P** — reusable Rust modules/endpoints cover assets/media/sounds/typing sets, topics/taxonomy, translations, public presentation/content, AI configuration/content plans, support signals, access/users/roles/groups and journals. Evidence is in the correspondingly named `api`, `application`, `persistence` modules and OpenAPI. Each source page still needs a complete page projection, source URL/flash adapter and exact pagination/error mapping. | Copy all listed pages and shared feature trees as a unit. Authoring/admin capabilities remain source-unavailable until their exact contract mapping is confirmed. |
| World Builder and direct editors: `pages/settings/worlds/{index,edit-map,configure-map,edit-node-activities,edit-markdown-activity,edit-npc-dialogue}.tsx`; all siblings `activity-*.tsx`, `{item,markdown,message,obstacle,portal,shared-task,tool-grant}-activity-fields.tsx`, `edit-node-activity-types.ts`, `use-node-image-upload.ts` | `features/settings/{world-builder-settings-panel,world-map-management-panel,map-asset-editor,map-asset-history-dialog,map-layout-history-dialog,map-import-dialog,map-export-validation-dialog,duplicate-map-dialog}`, `features/admin-worlds/hex-grid-geometry.ts`, world media/theme/scene components | Inertia graph/map/node/activity documents, `router` commands, `route`/Wayfinder links, media upload, history/export/import/download and source direct URLs | **P** — the Rust authoring graph/map/node/asset/activity/portal/template/media/import/export/history contracts are extensive: `admin_world_*`, `admin_activity_*`, `admin_source_records`, `admin_activity_templates` API/application/persistence modules and their OpenAPI routes. Current contracts are reusable only after an exact source adapter maps each source command/document. No current standalone component is parity evidence. | Copy this complete source family whole. Mount the original source routes before adding adapters. For each page, use the source unavailable/read-error UI until its named read/command matrix is verified; do not embed the page inside a different workspace. |

The source test catalogue that defines behavioral reference remains
`tests/Feature/{Auth,Settings,ContentApi,MapAsset,Organizations,Learning*,
QuestionActivity,SharedTaskActivity,Activity*,Platform*}.php` plus the
route-specific tests under `tests/Feature/Settings/**`. These tests are
reference evidence, not files to port mechanically. Existing standalone
Playwright tests are retained only as Rust/browser-contract evidence after the
reset; they must be relinked to the copied source tree before they can prove
visual parity.

#### Shared-source copy and framework seam inventory

The reset must move these directories exactly from the pinned source; copying
only the pages would repeat the present failure mode:

| Exact source tree | Role in the copied frontend | Adapter boundary allowed after copy |
| --- | --- | --- |
| `resources/js/{components,features,hooks,layouts,theme,types,lib}` | Shared controls, page composition, source visual tokens, accessibility, graph/canvas and media behavior. | Only imports that are framework transport seams; preserve JSX, classes, component nesting and local interaction state. |
| `resources/js/{pages,app.tsx}` and `resources/css/app.css` | Every route document, source layout selection and Tailwind/theme entry. | Replace the bootstrap with a standalone route/page resolver only after the exact page files are present; preserve source URL and layout selection rules. |
| `@inertiajs/react` (`Head`, `Link`, `router`, `useForm`, `usePage`, `createInertiaApp`) | Source navigation, title/history, page props, forms, partial reloads, error/flash lifecycle and application bootstrap. | One audited compatibility facade over React Router plus the typed Rust client. It may expose only source operations backed by a typed adapter; it must not emulate Laravel requests generically. |
| `@/routes` and `@/actions` (Wayfinder-generated helpers) | Route URL/form action construction used throughout pages and components. | Preserve source helper modules where they are pure URLs; replace Laravel-only command dispatch at an explicit route-family transport adapter. Do not mass-edit JSX links. |
| `usePage().props` and global Inertia share props | Current user, permissions, settings navigation, presentation, translations, flash/errors, page-specific documents. | A typed source-page projection per route family. The adapter may rename/case-map Rust wire fields once; it cannot invent omitted policy/data. |
| `lib/{media-upload,media-url,json-response}.ts`, download links and `ConfigImageInput` | Multipart validation, scoped preview, protected/public URLs and download behavior. | Typed Rust upload/download/media adapters that preserve scope and source error placement. No generic raw-media fallback. |
| `@laravel/passkeys` | Browser WebAuthn invocation. | A thin WebAuthn transport adapter around the existing Rust passkey options/confirmation endpoints; retain source prompts and recovery semantics. |

#### Rust reuse register and missing contracts

The following is the implementation reuse boundary. The listed code is not
frontend code and must survive the reset unchanged unless a later contract
audit finds a real behavior defect.

| Capability boundary | Reusable Rust evidence | Classification | Concrete reset requirement |
| --- | --- | --- | --- |
| Identity/session/password/TOTP/passkeys | `backend/crates/api/src/{session_commands,identity_registration,password_recovery,account_password*,account_two_factor,account_passkey}.rs`, matching application/persistence modules and OpenAPI | R except email verification | Add page adapters for source auth forms. Add a separate verification/re-notification backend slice before enabling `verify-email`. |
| Current-user, preferences, notifications and settings access | `current_user`, `account_profile*`, `learner_{appearance_preference,language_preference,sound_preference,desk_planning,platform_translation}`, `admin_settings_notifications` | P | Define one source Settings/current-user page projection; do not let individual copied components fetch/reconstruct permissions. |
| Public presentation/content/search/world | `public_{page,presentation,search,world}` API/application/persistence modules and `/api/v1/public/*` schema | P | Implement public shell/page document loaders with source media URL/presentation fields and error states. |
| Learner exploration, routes, records and playback | `learner_{world,playback,route_run,check_in,bookmark*,paths,topics,topic_detail,journal*,recall*,revisit*,reflection,portal,*}` and `content_api` | P | Adapt source screen documents and commands one family at a time; retain server-owned navigation/transition/reward decisions. |
| Organizations, groups, feedback and access links | `organization`, `learner_group`, `platform_feedback`, `access_link`, `temporary_access_login`, `admin_registration_tokens` | P | Map source forms, flash/redirects and paginated projections; preserve existing Rust authorization. |
| Media, reusable assets, sounds and translations | `admin_{media_assets,asset_catalog,sound,dialogue_typing_sound_set,translation_catalog}`, media-store and learner/public media modules | P | Map source multipart and protected/download URL semantics, including error placement and media-reference scope, before enabling a copied picker. |
| World Builder authoring and AI | `admin_world_*`, `admin_activity_*`, `admin_source_records`, `admin_activity_templates`, `admin_ai_*` API/application/persistence modules | P | Derive exact per-page document/command matrices from copied source; activate only whole copied source routes. |
| Email verification/re-notification | Rust identity data requires verified email, but no verification API operation is present in `contracts/openapi/v1.yaml` or `api/src/main.rs`. | M | Keep source verification page unavailable and record a dedicated identity slice; never bypass verification in the copied client. |

#### Safe reset boundary and execution order

The reset preserved `backend/**`, `contracts/**`, migrations, infrastructure,
Rust tests, generated API evidence, and public assets. It replaced the old
presentation tree with the complete pinned source copy and kept only the
minimal standalone platform adapter. Future work must reverify copied-file
identity, run production frontend verification, and prove that a route resolver
mounts canonical source rather than a replacement implementation. A route
without a recorded Rust projection remains explicitly unavailable.

### Canonical Welcome activation contract matrix — 17 November 2026

**Scope:** `resources/js/pages/welcome.tsx` at pinned `main`
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`, including its directly rendered
appearance toggle, cursor/theme helpers, page navigation and information-link
footer. This is the first route activation after the canonical-source reset;
it does not activate login, registration, World, information or settings
routes.

| Source dependency | Existing Rust evidence | Classification | Welcome-slice rule |
| --- | --- | --- | --- |
| `publicPresentation` (welcome pages, public palette, auth background images, cursors and information-page links) | `GET /api/v1/public/presentation`, `api/src/public_presentation.rs`, `application/src/public_presentation.rs` | Partial | Reuse the read model. The Welcome adapter may perform the one documented snake_case-to-source-shape mapping; it must not provide administration data or defaults that conceal an unavailable projection. |
| `auth.user` truthiness | `GET /api/v1/session`, `api/src/session_status.rs` | Partial | Welcome needs only the actual authenticated/not-authenticated state, but the source prop is nested under `auth.user`. Do not fetch or invent profile data for this page. |
| Authenticated `appearance` | `GET /api/v1/me`, `api/src/current_user.rs`, `application/src/current_user.rs` | Partial | The source page needs the current account’s resolved light/dark preference, but `/me` is not an anonymous public document. Do not invoke the appearance writer. |
| Guest `appearance` | Source `Appearance::forGuest()` and canonical `theme/appearance.ts` | Reusable source fallback | Supply the source-defined `system` value only; browser storage and system-media resolution remain source-local behavior. |
| Appearance write in canonical `theme/appearance-persistence.ts` | `PATCH /api/v1/learner/appearance`, `api/src/learner_appearance_preference.rs` | Reusable but out of scope | The copied Welcome page renders its appearance toggle only for anonymous visitors, whose source behavior is browser-local. This slice does not mount a settings writer, alias this transport, or call the Rust writer. |
| Appearance-toggle fixed labels | canonical `hooks/use-platform-translation.ts` fallback arguments | Reusable source fallback | Use the source’s own English fallback with an empty public translation map; no private translation read or fabricated catalog is permitted. |
| `login()` / `register()` Wayfinder helpers and all Welcome destinations | Laravel-generated helpers are not part of the pinned `resources/js` tree; Rust auth and public route families are separately audited | Missing outside this slice | A Welcome-only facade may preserve the exact `/login` and `/register` URL strings. Every destination resolves to the explicit unavailable state until its own route projection is approved. |

**Required projection:** add at most one anonymous-safe, read-only
`GET /api/v1/public/welcome` document that aggregates the existing public
presentation read with the session-derived user marker and, only for an
authenticated session, the existing application appearance preference. It
returns no profile, roles, permissions, credentials, settings-write capability
or translation catalog. A failed dependency must remain an unavailable
response, never a fallback success document.

**Known inherited source defect (accepted for this activation):** at
390×844, the pinned source Welcome page’s unauthenticated header has a
384.8px navigation beginning at x=132.7; its Login control extends to x=398.0
and the source page’s `overflow-hidden` clips it. This is not a Rust adapter
or page-projection defect. The focused browser regression records the exact
overflow at the pinned source breakpoint and continues to require bounds for
the controls the source keeps visible. A future source-UI change must correct
the main source first, establish a new pinned SHA, and then re-audit it; this
migration slice must not compensate with substitute JSX or CSS.

### Canonical fixed public-information activation contract matrix — 17 November 2026

**Pinned source verified:** `main` resolves to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. This slice mounts the exact
copied `resources/js/pages/info/about.tsx`, `info/imprint.tsx`, and
`info/data-protection.tsx`, each of which renders the complete copied
`features/platform-info/platform-info-page.tsx` public variant. Its named
source dependency tree also includes `features/platform-info/content.ts`,
`features/platform-info/markdown-renderer.tsx`, `hooks/use-appearance.tsx`,
`hooks/use-platform-cursors.ts`, `theme/platform-theme.ts`,
`theme/presentation.ts`, `theme/appearance*.ts`, `theme/cursors.ts`,
`lib/utils.ts`, `lib/media-url.ts`, `components/input-error.tsx`,
`components/ui/button.tsx`, and the copied app stylesheet. Those whole source
files remain byte-identical under `frontend/canonical-source/**`; only the
standalone platform adapter supplies the documented Inertia/page-prop seam.

| Source dependency / behavior | Rust evidence | Classification | Activation rule |
| --- | --- | --- | --- |
| Shared `auth`, resolved `appearance`, public palette, auth/welcome backgrounds, cursor configuration and ordered information-navigation links | `GET /api/v1/public/welcome`; `backend/crates/api/src/public_welcome.rs`; `backend/crates/application/src/public_presentation.rs`; `backend/crates/persistence/src/public_presentation.rs` | Reusable | Reuse the bounded Welcome projection exactly as already audited. The adapter uses the existing snake_case-to-source-shape mapper and exposes only the authenticated marker, never a profile, role, capability or settings-write permission. |
| `platformInfoContent.key` and `platformInfoContent.markdown` selected by each fixed source route | `GET /api/v1/public/pages/{slug}`; `backend/crates/api/src/public_pages.rs`; `backend/crates/application/src/public_page.rs`; `backend/crates/persistence/src/public_page.rs`; `PublicPage` in `contracts/openapi/v1.yaml` | Reusable | Fetch the published fixed-page document independently. A `404` or `503` is an explicit unavailable page; do not fall back to copied static text or an unverified presentation value. `PublicPage.title` remains transport metadata because this exact source component takes its visible title from the presentation configuration. |
| `canEditPlatformInfo`, update metadata and source `useForm` initialization | Public source route explicitly passes `canEditPlatformInfo: false`; Rust fixed-page endpoint deliberately exposes neither author identity nor editing authority | Reusable, read-only | Supply `false` plus null update metadata. The narrow facade provides only the local form shape evaluated before the source’s public/settings branch; its `patch` throws the explicit unavailable operation and cannot issue Laravel or generic form HTTP. |
| Public header links and copied Markdown renderer | Exact copied `PlatformInfoPage` source plus the bounded projection above | Reusable | Preserve source JSX, URLs, theme/style functions, responsive classes and Markdown/media safe-link behavior unchanged. Browser evidence covers `/about`, `/imprint`, and `/data-protection` at 1440×900 and 390×844, including a bounded Home control and source navigation back to Welcome. |
| Configured `pages/info/show.tsx` at `/info/{page}` | Public presentation contains ordered configured page settings, but no audited source-shaped Rust projection proves the Laravel controller’s configured-page admission rule together with its content override | Partial — not activated | `/info/:page` stays on the explicit canonical unavailable state and makes no public API request. A later slice must audit the source controller’s configuration membership condition and add a bounded projection only if the existing reads cannot prove it. |

**Adapter boundary:** `frontend/src/platform/public-information-route.tsx` makes only
the two documented read calls and maps their data in
`public-information-projection.ts`; `welcome-inertia.tsx` adds no write
transport. `canonical-resolver.tsx` activates only `/about`, `/imprint` and
`/data-protection`. The copied source files, configured `/info/:page`, source
page, authentication forms and every settings/editor path remain outside this
slice.

**Source-browser evidence:**
`frontend/e2e/canonical-public-information.spec.ts` records all three fixed
pages at both required viewports, their bounded visible Home control and
source-owned navigation, the published-page `404` unavailable state, and the
unprojected configured-page no-request unavailable state. No inherited clipping
or other source defect was observed for that tested visible control at 390×844.

### Canonical Source Code activation contract matrix — 17 November 2026

**Pinned source verified:** `main` resolves to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. This slice mounts the exact copied
`resources/js/pages/source.tsx`, including its whole named dependency set:
`hooks/use-appearance.tsx`, `hooks/use-platform-cursors.ts`,
`theme/platform-theme.ts`, `theme/presentation.ts`, `theme/appearance*.ts`,
`theme/cursors.ts`, the copied source style tree and its Lucide icons. The
source page itself, including link filtering, external-link controls, browser
history Back behavior, styling and responsive classes, is unchanged.

| Source dependency / behavior | Rust evidence | Classification | Activation rule |
| --- | --- | --- | --- |
| Shared `auth`, resolved `appearance`, public palette, welcome background and cursors | `GET /api/v1/public/welcome`; `backend/crates/api/src/public_welcome.rs`; public-presentation application/persistence read modules | Reusable | Reuse the existing bounded public Welcome read and its audited source-prop mapper. It carries only the authenticated marker and resolved appearance needed by the copied page, not an account or session emulation. |
| `publicPresentation.sourceLinks.origin` and `.custom` | `GET /api/v1/public/source-links`; `backend/crates/api/src/public_source_links.rs`; `backend/crates/application/src/public_source_links.rs`; `backend/crates/persistence/src/public_source_links.rs`; `PublicSourceLinks` in `contracts/openapi/v1.yaml` | Reusable | Map Rust `origin` directly and `modified_sources` only to the source field name `custom`. The endpoint requires an origin link; any unavailable dependency produces the explicit unavailable state, never a made-up attribution link. |
| Source-page custom-link filtering and “Modified sources” group | Exact copied `visibleSourceLinks` and `SourceButton` implementation | Reusable | Preserve the copied source behavior: blank source links are hidden by the page and the group is absent when there are no custom links. External links retain their source `target="_blank"` and `rel="noreferrer"`. |
| Back control | Exact copied `goBack` browser-history function | Reusable source behavior | Do not replace it with a router-specific abstraction. Browser evidence enters from Welcome, verifies the bounded Back control and confirms it returns to the copied Welcome route. |

**Adapter boundary:** `frontend/src/platform/source-code-route.tsx` makes only
the existing two read calls. `source-code-projection.ts` performs the sole
source-shaped transport mapping; it does not add a Laravel session, generic
Inertia transport, source-link editing or any Rust writer. The resolver mounts
only `/source`; all other unprojected destinations retain the canonical
unavailable state.

**Source-browser evidence:** `frontend/e2e/canonical-source-code.spec.ts`
proves the origin and modified-source controls, no-custom grouping behavior,
source-owned Back navigation and the source-links unavailable state at
1440×900 and 390×844. The tested visible controls are bounded at both
viewports; no source defect was observed for this route.

### Canonical Login activation contract matrix — 17 November 2026

**Pinned source verified:** `main` resolves to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. This slice mounts the complete
copied `pages/auth/login.tsx` within copied `layouts/auth-layout.tsx` and
`layouts/auth/auth-simple-layout.tsx`, with their named controls, passkey
alternative, appearance/cursor/theme hooks, password input and source layout
unchanged.

| Source dependency | Rust evidence | Activation rule |
| --- | --- | --- |
| Public auth presentation and guest appearance | `GET /api/v1/public/welcome` | Reuse the bounded public projection to render the copied auth layout. A failed read is explicit Login unavailability. |
| Password submit and Remember me | `GET /api/v1/security/csrf`, `POST /api/v1/session/login`, `session_commands.rs`, OpenAPI `LoginRequest`/`SessionStatus` | The route-specific form adapter performs one same-origin CSRF issuance then one JSON login submission. It is not an Inertia or generic form transport. Successful login follows the source destination `/world`; 401 and 503 remain visible in the copied source error region. |
| Laravel route helpers and page component identity | `auth-routes.ts`, source `Login.layout` values | Preserve source URLs through narrow helpers and provide `auth/login` page identity so the copied auth theme resolves its Login presentation. |

`frontend/e2e/canonical-login.spec.ts` proves first-click CSRF then session
submission, request shape, 503 visibility, and bounded submit controls at
1440×900 and 390×844 with mocked session responses. That evidence establishes
client submission ordering, not real-server first-attempt acceptance after a
rate-limit window expires. The native expiry defect discovered during whole
learner-layout verification is covered by the repair below. This original
activation did not activate registration, recovery, MFA or generic form transport.

### Native login rate-limit expiry repair

The earlier report that the first login says unavailable and the second succeeds
has a reproduced Rust cause. Both functions in
`backend/crates/api/src/login_rate_limit.rs` deleted expired records in one
writable SQL CTE and tried to insert/update the same key in another. The first
post-expiry reservation returned no row, producing native 429 even though the
old window had expired; the next request could insert successfully. Isolated
PostgreSQL regressions for both client-IP and account windows failed before
the change at exactly that first post-expiry assertion.

The same single-statement reservation now renews the target key atomically in
`ON CONFLICT`, setting count 1 and a new one-minute deadline when expired.
Cleanup excludes that target key and still removes other expired keys. Active
windows keep their original start/deadline and five-attempt burst; unrelated
active keys remain unchanged. Successful authentication still clears only the
account limiter, never the client-IP limiter. The outer Governor limit,
proxy-controlled IP, keyed digests, CSRF and generic credential responses are
unchanged. No schema, OpenAPI or copied frontend source changed.

Five focused Rust tests pass, including both live-PostgreSQL expiry regressions,
fresh and renewed five-attempt bounds, cleanup isolation and successful-password
reset boundaries. The database tests shadow both limiter tables with temporary
tables on isolated single-connection pools; they never edit real login records.
Twenty focused API session/authentication regressions, workspace check/fmt,
canonical-source identity, frontend type verification and generated client drift
checks also pass.

`frontend/e2e/canonical-login-expiry.spec.ts` exercises the actual local Rust
service and copied Login. It establishes a real client window, waits for its
one-minute expiry, then submits once at 1440×900 and 390×844, without retries,
IP spoofing or limiter resets. Traces are disabled and screenshots are taken
before filling credentials. It verifies native 200, one request, authenticated
`/me`, source `/world` navigation and session cleanup. The rebuilt-container run passes all five browser checks (the timed real
expiry scenario plus four existing canonical Login regressions). Evidence is
retained in `frontend/playwright-report/login-expiry`; both post-expiry browser
submissions returned 200 on their single click. The local backend image was
rebuilt and its normal session endpoint and container health verified; no
production deployment or rate-limit reset was performed.

### Canonical Login passkey activation — 17 November 2026

**Pinned source verified:** `main` resolves to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. The exact copied
`components/passkey-verify.tsx` remains the Login control owner; no passkey
JSX, copy, spinner, separator, error placement, route or responsive class was
recreated. This slice replaces only its `@laravel/passkeys/react` transport
import with a narrowly typed platform facade.

| Source dependency / behavior | Rust evidence | Activation rule |
| --- | --- | --- |
| Discoverable WebAuthn option ceremony | `POST /api/v1/session/passkey/options`; `account_passkey::login_options`; OpenAPI `startPasskeyLogin` / `PasskeyOptions` | The facade first obtains the same-origin Rust CSRF token, then starts only this documented anonymous ceremony. It passes Rust’s options unchanged to the maintained `@simplewebauthn/browser` client. |
| Browser assertion and successful session | `POST /api/v1/session/passkey`; `account_passkey::login`; OpenAPI `completePasskeyLogin` / `WebAuthnCredential` / `PasskeyLoginResponse` | The browser-produced credential is sent to only the typed Rust completion endpoint. Rust alone verifies it, updates its credential counter and creates the server-side session. Its source-shaped response supplies the source passkey configuration’s `/` default destination, which the copied `PasskeyVerify` follows instead of its component fallback. |
| Unsupported browser, rejection, rate limit and service failure | Copied component’s support gate/error region; OpenAPI `401`/`403`/`429`/`503` | Unsupported browsers retain the copied hidden-control behavior. Rejection remains visible in the copied error region; `503` is explicitly “Passkey authentication is currently unavailable.” No Laravel default URL, CSRF cookie convention, session, or generic passkey client remains active. |
| Password-confirmation and passkey-registration operations | Existing `account/passkeys/**` Rust API operations | Not activated by this Login slice. The facade refuses supplied custom passkey routes explicitly; the copied confirmation/settings source stays unavailable until its separately audited page projection is mounted. |

`frontend/e2e/canonical-passkey-login.spec.ts` provides source-derived browser
evidence at 1440×900 and 390×844. It supplies a browser WebAuthn assertion,
proves the CSRF/options/assertion request chain and Rust request shape, checks
the source-owned success navigation and bounded control, and verifies visible
Rust service unavailability. The tests use only a browser credential mock; the
Rust API’s server-side ceremony/credential verification remains covered by its
focused passkey tests.

### Canonical Registration activation — 17 November 2026

The exact copied `pages/auth/register.tsx` is mounted in the copied auth
layout. Its name, email, invitation token, appearance, password and password
confirmation fields use only `GET /api/v1/security/csrf` then the existing
typed `POST /api/v1/registration` contract (`identity_registration.rs` and
`IdentityRegistrationRequest`). The narrow form facade admits only this
explicit action in addition to Login; it is not generic Inertia transport.
`canonical-register.spec.ts` proves the invitation submission and bounded
Create account control and source Fortify `/home` completion at 1440×900 and 390×844. Recovery and other auth pages
remain unavailable pending their own audited contracts.

### Canonical Forgot Password activation — 17 November 2026

The exact copied `pages/auth/forgot-password.tsx` is mounted through the
copied auth layout. Its sole form action is `GET /security/csrf` followed by
the existing typed `POST /password/forgot` contract; success reloads the same
source route with its source status message. `canonical-forgot-password.spec.ts`
proves this source behavior and bounded submit control at both required
viewports. The copied reset route consumes its token through the existing typed
command, then follows Fortify’s source Login destination with the copied Login
status “Your password has been reset.” rather than the former `/world` fallback;
`canonical-reset-password.spec.ts` proves that status and destination at both
viewports.

### Canonical password-confirmation activation — 17 November 2026

The exact copied `pages/auth/confirm-password.tsx` is mounted at its source
`/user/confirm-password` URL with copied auth layout, password input and
`PasskeyVerify` control intact. `GET /api/v1/session` preserves the source
anonymous redirect to Welcome; `GET /public/welcome` remains the bounded auth
presentation projection. The copied password form uses only `GET /security/csrf`
and the existing typed `POST /account/password/confirmation` contract. Its
password and passkey successes follow Laravel’s configured `/home` fallback;
a local, same-origin `return_to` path is accepted only when it is an absolute
non-network path, preserving a future source intended-destination handoff
without an open redirect. The named passkey confirmation actions map only to
`POST /account/passkeys/confirmation/options` and
`POST /account/passkeys/confirmation`; their WebAuthn credential is verified
server-side and opens the existing Rust confirmation window. `403`/`422` and
`503` stay visible in the copied control’s error region. No Settings route or
passkey-management page is activated. `canonical-confirm-password.spec.ts`
proves password and passkey completion, rejection, anonymous routing and
bounded password controls at 1440×900 and 390×844.

### Canonical two-factor challenge activation — 17 November 2026

**Pinned source verified:** `main` resolves to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. This slice mounts the exact copied
`pages/auth/two-factor-challenge.tsx`, its whole directly-used dependency tree
`layouts/auth-layout.tsx`, `layouts/auth/auth-simple-layout.tsx`,
`components/{one-time-code-input,input-error}.tsx`, `components/ui/{button,input}.tsx`,
and `hooks/use-two-factor-auth.ts`. Those files remain byte-identical under
`frontend/canonical-source/**`.

| Source dependency / behavior | Rust evidence | Activation rule |
| --- | --- | --- |
| Pending password-login state | `POST /api/v1/session/login`, `GET /api/v1/session`, `session_commands.rs`, `session_status.rs`, and OpenAPI `SessionStatus` | A `two_factor_required: true` login response is the only successful transition into `/two-factor-challenge`; it does not create an authenticated session. The destination is otherwise source-unavailable at the command boundary. |
| Authenticator and recovery-code submit | `GET /api/v1/security/csrf`, `POST /api/v1/session/two-factor`, `session_commands::complete_two_factor`, and OpenAPI `TwoFactorChallengeRequest` | The restricted auth form facade admits exactly this action, preserves the source `code`/`recovery_code` field names and sends one same-origin CSRF header plus one typed request. It is not generic Inertia transport. |
| Challenge expiry/rejection/rate-limit and identity outage | OpenAPI `401`/`429`/`503` responses and the pending-challenge freshness/verification tests in `session_commands.rs` | Rejection is placed in the copied source field-error region as “The authentication code is invalid or expired.” A `503` is visibly “Two-factor authentication is currently unavailable.” The adapter fabricates neither an authenticated state nor a replacement recovery path. |
| Source mode switch and source layout copy | Exact copied `setLayoutProps`, `OneTimeCodeInput`, recovery-code toggle, and auth layout | `two-factor-layout.tsx` is a narrow presentation bridge only: it carries the copied component’s title/description update into the unchanged copied auth layout. The account enrollment/recovery-management route descriptors are import-only facades and reject explicitly; Settings TOTP management is not mounted by this login slice. |

`frontend/e2e/canonical-two-factor-challenge.spec.ts` records the source
authentication-code and recovery-code modes, digit filtering, request shapes,
success navigation, rejection and `503` state at 1440×900 and 390×844, with
bounded visible controls. `canonical-login.spec.ts` additionally proves that a
Rust `two_factor_required` response enters the copied challenge rather than
being rendered as an invalid-password error. No TOTP enrollment/settings,
email verification, generic Inertia transport, or World route is
activated by this slice.

### Canonical public/auth bootstrap completion audit — 17 November 2026

The pinned `main` SHA remains `32c3113a5bc688c9944c20942cdf40a6a5d57d7f` and
the canonical verifier still proves all 299 copied source files plus
`resources/css/app.css` are byte-identical. The public/auth bootstrap boundary
is complete only at the following route/contract level:

| Canonical source route family | Current disposition and evidence |
| --- | --- |
| `/`, `/about`, `/imprint`, `/data-protection`, `/source` | Mounted exact copied public pages through the bounded public Welcome/page/source-link projections. Their dedicated browser specs cover source controls, read failure and both required viewports. |
| `/login`, `/register`, `/forgot-password`, `/reset-password/{token}` | Mounted copied auth pages using only typed Rust session/registration/recovery contracts. Login covers password, passkey and pending TOTP; registration follows `/home`; reset follows copied Login status at `/login`. |
| `/two-factor-challenge`, `/user/confirm-password` | Mounted copied challenge/confirmation pages with their exact source controls, typed Rust CSRF/session/WebAuthn contracts, anonymous guard or pending-challenge behavior, and 1440×900/390×844 coverage. |
| `/info/{page}` and `/email/verify` (including verification commands/deep links) | Explicitly unavailable: source configured-information admission and email verification/re-notification have no audited Rust page projection/contract. The resolver makes no API call or success claim; `canonical-public-auth-unavailable.spec.ts` proves the visible unavailable state at both required viewports. |
| Learner `/home` and `/world` destinations | Intentionally not part of the public/auth bootstrap: source-compliant successful auth completion may navigate to them, but they remain their own learner route-family migration slices and render the explicit unavailable state until then. |

This phase does not activate Laravel HTTP, Laravel session decoding, generic
Inertia posts, arbitrary Wayfinder actions, verification writes, passkey/TOTP
Settings management, or learner content. Those operations either already have
separate Rust contracts awaiting their source page family or remain explicitly
unavailable; none is silently represented as successful bootstrap behavior.

### Canonical learner World read-route activation — 18 November 2026

**Acceptance correction:** this historical entry describes an incomplete read
activation. The active completion register above governs remaining work.
The original relative-import and pagination claims were contradicted by the
new browser regression and repaired in the group subworkflow. Activity
outlines, identity and empty/error semantics were repaired in the verified
entries above. Shared layout and playback remain open; this entry is not
full-route acceptance.

**Pinned source verified:** `main` resolves to
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. The mounted source entry is the
byte-identical copied `resources/js/pages/world.tsx`, including its complete
direct tree: `features/world/{world-map,node-detail-drawer,activity-panel,
world-search,group-control,map-control-theme,theme,active-activity,types}`;
`features/{sounds/sound-player,tools/tool-selection}`; `hooks/{use-appearance,
use-platform-translation}`; `types/{learning,learning-search}`; map-media and
interaction helpers; shared UI primitives; and the canonical stylesheet.
`frontend/src/platform/world-route.tsx` imports that entry only via
`frontend/canonical-source/resources/js/pages/world.tsx`; it imports no
`original-*`, `lifted-*`, or `extracted-*` presentation file.

| Source dependency / behavior | Rust contract and adapter evidence | Read-route rule |
| --- | --- | --- |
| Authenticated World, maps, nodes, learner state, safe map media and route-start summaries | `GET /api/v1/learner/world`; `api/src/learner_world.rs`; `application/src/learner_world.rs`; `persistence/src/{learner_world,public_world}.rs`; OpenAPI `getLearnerWorld` / `LearnerWorldSnapshot` | Reused as a bounded read. The initial numeric-handle approach was incorrect because source persists those identities. The verified graph adapter above now maps real UUIDs and complete published outlines; it joins progress by identity rather than ambiguous activity slugs. |
| Map-to-topic navigation | `PublicMap.topic`, `PublicMapTopic`; `persistence/src/public_world.rs`; OpenAPI `PublicMapTopic` | The learner/public map projection now returns only the published topic slug/title needed to retain the copied “Back to …” control. It does not disclose topic drafts or grant topic access. Its destination remains explicit-unavailable until Topics is activated. |
| Current authenticated marker and private appearance | `GET /api/v1/me`; `api/src/current_user.rs`; OpenAPI `getCurrentUser` / `CurrentUser` | Required successful read. The copied page receives only an authenticated marker and appearance value; its copied `useAppearance` keeps the source browser preference behavior. This read route never calls the appearance writer, and name, email, roles and capabilities are not injected into source props. |
| UI translations | `GET /api/v1/learner/platform-translations`; `api/src/learner_platform_translation.rs`; OpenAPI `getLearnerPlatformTranslations` | Reused to preserve copied labels. A failed read makes World unavailable rather than silently presenting an unverified language projection. |
| Source sound preference controls | `GET /api/v1/learner/sound-preferences`; `api/src/learner_sound_preference.rs`; OpenAPI `getLearnerSoundPreferences` | Reused as a read-only volume/mute projection for copied map sounds. The adapter maps only the three source values and never calls its preference writer. |
| Initial group control and its bounded pagination read | `GET /api/v1/learner/groups`; `api/src/learner_group.rs`; OpenAPI `getLearnerGroups` | Reused and mapped only at the source field-name seam. Opaque Rust UUID group/message identities stay opaque at runtime; the copied component only uses them for equality/keys. |
| World search | `GET /api/v1/learner/search`; `api/src/learner_desk_search.rs`; OpenAPI `searchLearnerDesk` | `world-api.ts` maps only the copied page's legacy search URL to this typed Rust read. Search result map/node selection remains slug-based; no synthetic server identity is sent. |
| Group messages/votes/resolution | Activated through the existing Rust contracts by the group repair recorded in the active register above. | Both relative and aliased World transport imports use the platform adapter; source group UI is unchanged. |
| Bookmarks, tool use, route reset and activity start/playback | Existing command families remain unactivated. Unmapped operations raise the adapter's explicit unavailable state. | `/learning/nodes/{id}/play`, portal travel, map-asset editing and all playback still require full canonical activation. |
| Empty, authentication, authorization and dependency failures | World handler/OpenAPI `401`, `403`, `404`, `503`; route adapter failure boundary | `404` maps to the copied source's exact empty-World view. `401`, `403`, `503`, missing companion reads or network failure render the bounded explicit World-unavailable state; none becomes an empty or successful map. |

The copied component does not read map access-role lists or portal/activity
authoring documents while rendering this read-only surface, so the adapter
does not invent empty values for them. Activity outlines exist solely to retain
the source drawer's real route-start labels and local URL formation; playback
data/configuration is not projected. `frontend/e2e/canonical-world.spec.ts`
records map visibility, bounded source controls, the copied node drawer,
unavailable bookmark/playback behavior, loading, empty, permission-unavailable
and API-failure states at 1440×900 and 390×844. The source verifier continues
to prove all 299 copied modules/styles are byte-identical.

### Canonical shared current-user and Settings bootstrap audit — 17 November 2026

**Status: audited; activation not yet started.** The canonical baseline remains
the exact `main` commit `32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. Its
`resources/js/**` and `resources/css/app.css` copies under
`frontend/canonical-source/**` are immutable. Existing standalone Settings
screens, including their Playwright tests, demonstrate a Rust capability only;
they are not a source-UI implementation and must not be imported into a
canonical route activation.

#### Source composition and page-prop boundary

The primary source Settings route is `/settings` (with `panel` and nested query
keys), not a collection of substitute `/settings/*` pages. The root is
`resources/js/pages/settings/index.tsx`; it selects whole source panels and
must retain its `SettingsNestedWorkspace` hierarchy, sidebar/top-bar,
URL-owned selection and source-visible navigation. Direct source pages
`settings/{profile,appearance,language,security,about,imprint,data-protection}.tsx`
are separate documents that may be enabled only when their own prop/form matrix
is complete. The copied `layouts/settings/layout.tsx` is a legacy source layout
used by direct pages; it is not permission to replace the root workspace.

| Source responsibility | Exact pinned source paths | Required source inputs / behavior | Rust disposition at audit |
| --- | --- | --- | --- |
| Shared page props and account chrome | `resources/js/types/{global,auth}.ts`; `components/{nav-user,user-menu-content,user-info,learner-account-controls}.tsx`; `hooks/{use-appearance,use-platform-translation}.tsx`; `theme/{appearance,presentation}.ts` | `auth.user`, `auth.canViewMediaPaths`, appearance, localization, presentation palette/cursors, current URL; the source `User` also declares legacy numeric `id`, role, verification/timestamps and optional avatar/profile image. | **Partial.** `GET /api/v1/me` is authenticated and returns Rust `subject_id`, name, email, username, avatar URL, appearance, roles, capabilities, `can_view_media_paths` and server-filtered `settings_access`. It cannot be cast to the Laravel user: it lacks the legacy numeric id, role enum, verification/timestamp fields and `auth.items/tools`. A Settings adapter must map only fields actually consumed by a mounted source component and keep all uncontracted values out of the component tree. |
| Settings root, navigation and chrome | `pages/settings/index.tsx`; `features/settings/{settings-navigation,settings-workspace-shell,settings-panel-directory,settings-corner-navigation,settings-access-navigation-state,settings-access-types}.ts(x)`; `components/settings-configuration-shell.tsx` | Source navigation needs complete per-resource `{read,update,delete}` access capability records, current user, bounded notification summary, public presentation/settings palette, URL panel state and every selected-panel document listed below. | **Missing bootstrap projection.** `/api/v1/me.settings_access` is deliberately only boolean read visibility and cannot safely become the root's update/delete map. `GET /api/v1/admin/settings/notifications` is reusable but separately authorized and contains only counts plus up to four report thumbnails. No single Rust Settings document currently joins these sources or defines 401/403/503 behavior. |
| Personal source workspace | `pages/settings/personal.tsx`; `features/settings/{profile-settings-panel,appearance-settings-panel,language-settings-panel,sound-settings-panel,security-settings-panel}.tsx`; `components/{delete-user,manage-passkeys,manage-two-factor,passkey-*,two-factor-*}.tsx` | `PersonalSettingsProps`: `availableLanguages`, `initialSection`, locale, `mustVerifyEmail`, sound preferences, feedback-prompt status, optional flash status, password rules, TOTP flags, passkey flags and summaries. Its eight nested panels own source forms, security dialogs and URL selection. | **Partial by operation, missing as document.** Profile, appearance, language, sound, feedback preference, password confirmation/update, profile deletion, TOTP and passkey operations have bounded Rust contracts. No read projection provides their source-shaped aggregate, `passwordRules`, source flash lifecycle or a verified-email flag. Do not mount the root Personal panel until that aggregate and its source-form seams are explicit. |
| Direct personal pages | `pages/settings/{profile,appearance,language,security}.tsx` plus the same whole panels above | Profile needs `mustVerifyEmail` and status; Language needs available language list and locale; Security needs password rules, TOTP/passkey flags and summaries; Appearance needs source appearance persistence. | **Mixed.** Appearance is the earliest candidate because its copied page has no route prop. Language, profile and security await their documented typed reads and narrowly allowed forms. A successful direct page must not imply that `/settings?panel=personal` is active. |
| Information in Settings | `pages/settings/{about,imprint,data-protection}.tsx`; `features/platform-info/{platform-info-page,content,markdown-renderer}.tsx` | Authenticated settings variant of the already copied information surface and its presentation/content props. | **Reusable read dependency; inactive.** Public information projection exists for public routes, but the settings variant still depends on authenticated shared Settings props and needs a route-local audit. It is not included in the first bootstrap slice. |
| Administration/authoring root panels | `pages/settings/index.tsx`; `features/settings/{access-*,assets-world-objects-panel,content-api-panel,learning-companion-*,learning-support-panel,presentation-localization-panel,world-builder-settings-panel,world-map-management-panel}.tsx`; pages under `pages/settings/{admin-panel,ai,color-palette,journal,languages,presentation,assets/**,worlds/**}.tsx` | The root type requires access groups/links/tokens/users/roles, AI, companion, asset and sound catalogs, language admin, learning-support, presentation, map graph/selected map/selected node and their pagination/error/flash details. | **Individually partial, bootstrap-absent.** Rust/OpenAPI provide bounded endpoint families below, but no route may receive fabricated empty arrays or old standalone data just to render the source root. Every listed panel remains explicit unavailable until its page document and command mapping are audited. World Builder follows the canonical route-family activation gate below; historical backend work is reuse evidence only. |

#### Existing Rust/OpenAPI contract register

All paths below are implemented evidence, not authorization to invent a
Laravel-shaped page prop. Named API handlers and generated OpenAPI operations
must continue to be the only transport inputs for their future typed adapter.

| Source need | Existing Rust/OpenAPI evidence | Classification and activation rule |
| --- | --- | --- |
| Authenticated principal, appearance and Settings visibility | `GET /api/v1/me`; `backend/crates/api/src/current_user.rs`; `application/src/current_user.rs`; `persistence/src/current_user.rs`; OpenAPI `getCurrentUser` / `CurrentUser` | **Reusable partial.** Provides only safe current-subject chrome and boolean read visibility. It does not provide source numeric identity, precise access levels, flash, localization or a Settings document. |
| Profile read/write/image/delete | `GET/PATCH/DELETE /api/v1/account/profile`, `POST /api/v1/account/profile/image`, profile-image read; `api/src/account_profile*.rs`; OpenAPI `getAccountProfile`, `updateAccountProfile`, `deleteAccountProfile`, `uploadAccountProfileImage` | **Reusable partial.** Keep the source validation/error placement and destructive-password confirmation; a future adapter must map UUID image staging and no current source numeric media identity. |
| Appearance, language, sound and feedback-prompt preferences | `PATCH /api/v1/learner/appearance`; `GET/PATCH /api/v1/learner/language-preference`; `GET/PATCH /api/v1/learner/sound-preferences`; `GET/PATCH /api/v1/learner/feedback-prompt-preference`; `learner_{appearance_preference,language_preference,sound_preference}.rs`, `feedback_prompt_preference.rs` and matching OpenAPI | **Reusable operations, partial reads.** The language endpoint must be paired with the authoritative available-language catalog; no source fallback locale list may be fabricated. The feedback source link `/feedback` stays unavailable until its route family is activated. |
| Password update and confirmation window | `POST /api/v1/account/password/confirmation`, password-change contract and `account_password*.rs`, already mounted confirmation route adapter | **Reusable partial.** The future Settings form may use only a dedicated typed action that preserves source errors and confirmation recovery; it cannot widen the public/auth form facade into generic Inertia. |
| Two-factor and passkeys | `/api/v1/account/two-factor/{setup,confirm,recovery-codes}` and delete; `/api/v1/account/passkeys/{confirmation/options,confirmation,options}` plus list/register/delete; `account_two_factor.rs`, `account_passkey.rs`, matching OpenAPI | **Reusable operations, document absent.** Source lists need passkey summaries and flags; TOTP state needs source-compatible management status. Reuse existing WebAuthn transport only after the Settings component’s complete lifecycle is audited. |
| Administrator notification menu | `GET /api/v1/admin/settings/notifications`; `api/src/admin_settings_notifications.rs`; OpenAPI `getAdminSettingsNotifications` | **Reusable bounded read.** It remains a separately permission-filtered request and must render a source-visible unavailable/error result rather than a zero-count success if it fails or is unauthorized. |
| Administration resource families | `admin_{registration_tokens,users,roles,learning_groups,media_assets,asset_catalog,sound,dialogue_typing_sound_set,translation_catalog,public_presentation,ai_settings,world_*,activity_*,source_records,activity_templates}.rs`; `learner_{support_signals,journal*,topics}.rs`; `organization`, `access_link`, `platform_feedback`, `journal_feedback_review` modules and their OpenAPI operations | **Partial by page family.** Operations and many reads exist, but none establishes the whole `SettingsIndexProps` document, source pagination/query-state or form/flash semantics. They remain unavailable from canonical Settings until route-family matrices are accepted. |

#### Executable activation order and unavailable rules

1. Add one narrowly typed authenticated Settings bootstrap adapter. It must read
   only current-user and presentation inputs needed by the copied shell, map
   Rust identity deliberately (never coerce a UUID into a Laravel numeric id),
   fetch the notification summary only when the server-derived visibility makes
   it eligible, and surface 401/403/503 as a source-contained unavailable
   state. It must not mount the root `pages/settings/index.tsx` until every
   selected root-panel prop has an audited projection.
2. Activate the copied direct `pages/settings/appearance.tsx` first, using the
   existing authenticated appearance projection/write seam. Its page remains
   unavailable on failed current-user/appearance dependency; no default user or
   “saved” flash is invented. Capture source controls and toggle behavior at
   1440×900 and 390×844.
3. Build one Personal document read contract from the named existing profile,
   language, sound, feedback, security and credential reads; record exactly
   which fields are source-shaped and which source operations map to Rust. Then
   activate the complete copied `PersonalSettingsContent` as a whole, not a
   recreated tab panel. Profile, language, sound, feedback, security and
   deletion are separate command slices with focused source-derived browser
   evidence.
4. Only after the Personal document and root read/navigation contracts exist,
   activate copied `pages/settings/index.tsx` with the source personal section
   and explicit unavailable cards for all other panel keys. The adapter must
   preserve `panel`/nested URL state, source navigation filtering and narrow
   selector; it may not fill `SettingsIndexProps` with empty administration
   models.
5. Continue administration, assets, learning support and World Builder using
   their separate exact-source audits. The root settings route must leave an
   uncontracted destination visibly unavailable, not navigate to a reconstructed
   standalone page or imply a successful Rust action.

**Required evidence per activation:** canonical identity check; contract
matrix with OpenAPI operation and error mapping; anonymous, unauthorized and
dependency-unavailable behavior; source-derived browser proof at 1440×900 and
390×844 including bounded visible controls and URL/back/refresh semantics; and
focused frontend, Rust, OpenAPI and browser verification. This audit changes no
canonical UI or endpoint.

### Canonical direct Appearance Settings activation — 17 November 2026

The first Settings activation mounts the unchanged copied
`resources/js/pages/settings/appearance.tsx` at its source
`/settings/appearance` path. It includes the complete directly rendered source
tree: `features/settings/appearance-settings-panel.tsx`,
`components/{appearance-tabs,settings-configuration-shell}.tsx`,
`hooks/{use-appearance,use-platform-translation}.tsx`,
`theme/{appearance,presentation}.ts`, and the copied stylesheet. The root
`pages/settings/index.tsx`, Personal workspace and every administration panel
remain inactive; `/settings` itself remains explicitly unavailable until its
complete page document exists.

| Source dependency / behavior | Rust contract / adapter | Rule |
| --- | --- | --- |
| Authenticated appearance and route admission | `GET /api/v1/me`, `getCurrentUser`, `CurrentUser.appearance`, `api/src/current_user.rs` | The adapter requires a successful authenticated current-user read. `401`, `403`, `503`, network failure or a missing payload render the explicit Appearance unavailable state; no guest/default account is presented as Settings. |
| Source Settings palette | `GET /api/v1/public/welcome`, `WelcomePageProjection.publicPresentation.settings_palette` | The adapter reads the existing bounded public presentation projection and maps every snake-case Settings palette field once to the copied `PublicPresentationSettings` shape. A failed presentation read is unavailable, not a copied default palette. |
| Source Light/Dark controls | `GET /api/v1/security/csrf`, `PATCH /api/v1/learner/appearance`, `updateLearnerAppearance`, `learner_appearance_preference.rs` | `appearance-persistence.ts` is the sole narrow seam for copied `theme/appearance-persistence.ts`. It batches the source’s resolved light/dark mode and submits one CSRF-protected typed Rust write. It does not emulate an Inertia form or any unrelated settings write. |
| Write outage behavior | Existing copied `useAppearance`/appearance persistence behavior | The source applies the requested display mode locally and exposes no save-status/error control. The adapter deliberately preserves that inherited behavior after a failed Rust write; it neither claims persistence succeeded nor substitutes an invented banner. The route-load dependency failure remains explicitly visible. |
| Back destination | Copied `SettingsConfigurationShell` link to `/settings` | The source URL remains intact. Since the root Settings document is not activated, following it reaches the global explicit unavailable state rather than a reconstructed workspace. |

Focused regression evidence is
`frontend/e2e/canonical-settings-appearance.spec.ts`: it proves the exact
copied headings, source Light/Dark controls, public Settings palette mapping,
typed Rust request body, source-preserved write-outage behavior, bounded
controls at 1440×900 and 390×844, and current-user dependency-unavailable
state. `check:canonical-source`, generated OpenAPI/type/build checks and the
focused Rust current-user tests must remain green for this slice.

### Canonical direct Language Settings activation — 17 November 2026

The unchanged copied `resources/js/pages/settings/language.tsx` is mounted at
its source `/settings/language` URL with its whole direct source tree:
`features/settings/language-settings-panel.tsx`, source Select/button/form
layout, `settings-configuration-shell.tsx`, translation and appearance hooks,
and source styling. It remains a direct source document; it does not activate
the root Settings workspace, Personal nested panel, or any other Settings
writer.

| Source dependency / behavior | Rust contract / adapter | Rule |
| --- | --- | --- |
| Enabled locales and current locale | `GET /api/v1/learner/language-preference`, `getLearnerLanguagePreference`, `LearnerLanguagePreference`, `learner_language_preference.rs` | The adapter maps only `available_languages.{code,name,native_name}` to the source camel-case prop and passes its returned locale verbatim. It does not invent a locale list. |
| Platform-control translation catalog | `GET /api/v1/learner/platform-translations`, `getLearnerPlatformTranslations` | The source translation hook receives the server-selected locale/catalog instead of a default-English substitute. This preserves source fallback strings only for absent individual catalog keys. |
| Shared authenticated chrome/theme | Existing `GET /api/v1/me` and `GET /api/v1/public/welcome` mappings from the Appearance slice | Current appearance, source Settings palette and authenticated admission use the same bounded read rules; every one of the four required reads must succeed. |
| Source `router.patch('/settings/language')` save | `GET /api/v1/security/csrf`; `PATCH /api/v1/learner/language-preference`, `updateLearnerLanguagePreference` | The Inertia facade recognizes exactly this URL and this `{locale}` body, obtains a same-origin CSRF token, then invokes the typed Rust command. A successful command reloads this exact route so the copied stateful panel receives refreshed source props, equivalent to its source Inertia visit. It is not a generic router/form implementation. |
| Invalid/unauthorized/unavailable write and read | OpenAPI `400`/`401`/`403`/`503` | A failed page read is explicit unavailable. The copied source panel has no inline save-error slot; on a failed write its source selection remains dirty/retryable and no success flash or fabricated error banner is added. |

`frontend/e2e/canonical-settings-language.spec.ts` covers source headings and
bounded controls at 1440×900 and 390×844, source Select/save behavior, the
typed `{locale:'de'}` request, refresh after success, source-preserved retry
after a `503`, and read-unavailable behavior. The source back target remains
`/settings`, which is deliberately unavailable until the separately audited
root document is activated.

### Canonical direct Profile Settings activation — 17 November 2026

The unchanged copied `resources/js/pages/settings/profile.tsx` is mounted at
its source `/settings/profile` URL, together with the complete direct source
tree it renders: `features/settings/profile-settings-panel.tsx`,
`components/settings-configuration-shell.tsx`, source image controls,
translation/appearance hooks, settings design tokens and source styling. It is
not the incomplete Personal document or the root Settings workspace.

| Source dependency / behavior | Rust contract / adapter | Rule |
| --- | --- | --- |
| Profile inputs and owner-scoped current-user chrome | `GET /api/v1/account/profile` (`getAccountProfile`, `AccountProfile`) plus `GET /api/v1/me` (`getCurrentUser`, `CurrentUser`) | The route projection maps only the fields consumed by the copied panel: name, normalized email, nullable username, profile image route, avatar route and `can_view_media_paths`. It never casts the Rust UUID subject to the source's obsolete numeric user ID or fabricates unconsumed Laravel user fields. |
| Settings palette, appearance and translated copy | `GET /api/v1/public/welcome` and `GET /api/v1/learner/platform-translations` | The existing presentation projection supplies the source Settings palette; the translation hook receives the server-selected catalog and the current-user appearance is synchronized by the source hook. All four reads must succeed, otherwise the route displays a bounded explicit unavailable state. |
| Source profile form write | `GET /api/v1/security/csrf`; `PATCH /api/v1/account/profile` (`updateAccountProfile`, `UpdateAccountProfileRequest`) | The dedicated `ProfileController.update.form()` facade admits only this source form. Its adapter sends exactly `{name,email,username,profile_image_id}` through the typed Rust client and reloads this source document only after success. It is not a reusable Inertia form transport. |
| Source per-field validation slots | `ProfileValidationProblem` on the Profile update `422` contract; `account_profile.rs` | Rust now validates source-equivalent name, email and public-username bounds/format before dispatch and returns a field-keyed bounded error. Distinct identity-email, public-username and owner-staged-image conflicts map to the matching copied field. The adapter renders those exact error slots; it does not recreate validation rules in the browser or assign all failures to an arbitrary field. |
| Source profile-image staging | `POST /api/v1/account/profile/image` (`uploadAccountProfileImage`, `ProfileImageUpload`) and owner-checked `/api/v1/profile-images/{id}` | The exact copied upload control receives its returned URL. The narrow media seam retains the staged opaque UUID only for that URL and emits the UUID on the next typed profile save; an arbitrary raw Laravel-storage path cannot be converted into an ID. The copied raw-path input remains source-visible only when Rust's `can_view_media_paths` permits it, but saving such an unprojected path is explicitly rejected in its existing source error slot. |
| Source email-verification branch | Active Rust identity lookup admits only active subjects with verified email; no resend-verification projection exists | The direct copied page is deliberately given `mustVerifyEmail: false`. No nonexistent verification state, route or success flash is fabricated. The source branch remains unavailable until the identity verification lifecycle itself has an audited Settings projection. |
| Read/write/image failure | OpenAPI `401`/`403`/`422`/`503` contracts | A failed required read renders `Profile settings are unavailable.` rather than empty profile data. A `422` stays dirty and displays field feedback; a `503` stays dirty/retryable with no success state. Image-upload failures use the copied image error slot. |

`frontend/e2e/canonical-settings-profile.spec.ts` proves the copied Profile
headings, back destination, controls and reachable bounded controls at both
1440×900 and 390×844; the exact profile-save body; staged-image UUID mapping;
field-level `422`; retry after `503`; and profile-read unavailability. Source
identity is verified by `check:canonical-source` against
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`; the route is mounted exclusively
through `frontend/src/platform/profile-route.tsx` and its documented narrow
facades.

### Canonical direct Settings information activation — 17 November 2026

The unchanged copied `resources/js/pages/settings/{about,imprint,data-protection}.tsx`
documents are mounted at their exact source URLs through the complete copied
`features/platform-info/platform-info-page.tsx` tree, its Markdown renderer,
appearance/presentation hooks, source buttons and source styling. The pinned
`PlatformInfoPageController::showSettings` explicitly supplies
`canEditPlatformInfo: false`; these are read-only direct documents, not the
root Settings workspace or the administrator public-information editor.

| Source dependency / behavior | Rust contract / adapter | Rule |
| --- | --- | --- |
| Authenticated direct-Settings admission and active appearance | `GET /api/v1/me` (`getCurrentUser`, `CurrentUser`) | The route requires a successful actual current-user read before mounting the copied Settings document. It uses only the returned appearance; no legacy source user ID or extra account field is fabricated. |
| Source palette, public presentation and page-prop shape | `GET /api/v1/public/welcome` (`getPublicWelcome`) plus `toWelcomePageProps` | The existing bounded Welcome projection supplies the exact source `auth`, appearance and `publicPresentation` dependencies. Its failure makes the document explicitly unavailable; it does not fall back to copied presentation defaults. |
| Selected information document | `GET /api/v1/public/pages/{slug}` (`getPublicPage`) | The adapter maps only the returned `body` to `platformInfoContent.markdown` for the source slug. The whole source component continues to choose its own static title and render the copied Markdown renderer. |
| Edit capability | Pinned source `PlatformInfoPageController::showSettings` | The adapter always supplies the source-owned `canEditPlatformInfo: false`, exactly as the controller did. The unrelated `GET/PATCH /admin/public-information-pages` contract and source editing branch remain inactive; no editor control is hidden by an invented permission decision. |
| Read failure or unavailable page | Rust `401`/`403`/`404`/`503` and network failures from any required read | The adapter renders the bounded `Settings information is unavailable.` state. It does not mount an empty source document, infer public content, or claim the page can be edited. The copied back URL stays `/settings`, whose root document remains explicitly unavailable. |

`frontend/e2e/canonical-settings-information.spec.ts` proves the exact copied
About, Imprint and Data Protection documents and their source Markdown at
1440×900 and 390×844, including a bounded source back control, the source's
read-only/no-Edit state, and failure of the authenticated page projection.
`check:canonical-source` verifies the mounted source files against
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`; no canonical source file is
changed. The dedicated adapter is
`frontend/src/platform/settings-information-route.tsx`.

### Canonical direct Security Settings activation — 17 November 2026

The unchanged copied `resources/js/pages/settings/security.tsx` is mounted at
its source `/settings/security` URL, together with the complete tree it
directly renders: `security-settings-panel.tsx`, password controls,
`manage-two-factor.tsx`, `two-factor-{setup-modal,recovery-codes}.tsx`,
`manage-passkeys.tsx`, `passkey-{item,register}.tsx`, source Settings shell,
translation/appearance hooks and source styling. The source controller and
`LoadSecuritySettings` query at pinned main
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f` establish that both security
features and confirmation are enabled; neither source feature tree is hidden
to make this page easier to mount.

| Source dependency / behavior | Rust contract / adapter | Rule |
| --- | --- | --- |
| Complete direct-page read props | New `GET /api/v1/account/security`, `account_security.rs`, `AccountSecuritySettings` OpenAPI schema | The bounded owner-only projection supplies only source-consumed non-secret fields: enabled Rust capabilities, `minlength: 12`, confirmation requirement, confirmed TOTP state, and passkey labels/relative usage text. It never returns credentials, setup secrets or recovery codes. It exists because the existing separate `/passkeys` list requires a recent confirmation and uses opaque UUID/timestamp fields, while the source direct-page read does not. |
| Source settings chrome and localized text | Existing `GET /api/v1/me`, `GET /api/v1/public/welcome`, `GET /api/v1/learner/platform-translations` | Every required read must succeed before the copied page mounts. Rust appearance, palette and catalog are mapped once through the existing typed projections; no legacy numeric user identity is supplied. |
| Source password form and its field slots | `GET /api/v1/security/csrf`; `PATCH /api/v1/account/password`; `PasswordValidationProblem` | The narrow `security-password-update` facade sends exactly `{current_password,password,password_confirmation}`. Rust now returns the matching source field key for missing/invalid current password, replacement-length, or confirmation failures; the copied source `InputError` owns rendering. Successful replacement reloads only this direct document. |
| Source TOTP setup, confirmation, disable and recovery codes | Existing typed `/account/two-factor{,/setup,/confirm,/recovery-codes}` operations | The source’s Form actions are individually admitted, not generically emulated. The TOTP transport seam retains an unconfirmed setup secret only in module memory between the source enable form and copied modal, derives its QR SVG from Rust’s provisioning URL, and never persists it. Rust's recent-password requirement redirects only the exact source flow to the existing copied confirmation route with `/settings/security` as its bounded return target. |
| Source passkey list, register and removal controls | Existing `/account/passkeys{,/options,/{passkey_id}}` and `@simplewebauthn/browser` | The dedicated passkey compatibility seam accepts only this owner-scoped registration ceremony. The copied source’s Laravel numeric passkey type is not fabricated: its runtime opaque Rust UUID is carried unchanged through the exact delete facade. Registration uses Rust WebAuthn options/assertion endpoints and sets the source confirmation request's same-origin CSRF meta token only in the live document. |
| Read/write/security-service failure | Rust `401`/`403`/`422`/`429`/`503` contracts | Failed mandatory page reads render `Security settings are unavailable.` The source visible password and setup error slots remain dirty/retryable; a confirmation-required sensitive command uses the copied password-confirmation journey rather than treating it as success. |

`frontend/e2e/canonical-settings-security.spec.ts` proves the exact copied
password form and field validation, complete TOTP setup/confirmation/recovery
surface, passkey UUID deletion and WebAuthn registration request, explicit
read unavailability, and source controls at 1440×900 and 390×844. At 390px
the pinned source `SettingsConfigurationShell` retains its desktop-width grid
and clips the footer Save control beyond the viewport. This is a recorded
**known source defect** (also preserved in browser evidence), not a Rust
adapter redesign or a migration parity claim. `check:canonical-source` keeps
the copied source byte-identical; the only new presentation code is the
narrow `frontend/src/platform/security-route.tsx` and its named transport
facades.

### Canonical Personal Settings workspace activation — 17 November 2026

The copied `pages/settings/personal.tsx` is now mounted only at its canonical
`/settings?panel=personal&personal={section}` branch, before the incomplete
root Settings index is activated. Its complete source workspace (Profile,
Appearance, Language, Notifications, Feedback, Sound, Security and Delete
account sections) receives one aggregate from the already audited profile,
security, language, translation, sound and feedback reads plus `GET /me` and
`GET /public/welcome`. Any failed required read renders the bounded Personal
unavailable state; no root administration prop is fabricated.

The adapter preserves the source tab URL selection and admits only three added
source transport seams: sound preferences to `PATCH /learner/sound-preferences`,
feedback invitations to `PATCH /learner/feedback-prompt-preference`, and the
copied destructive confirmation form to `DELETE /account/profile`. Existing
Profile, Appearance, Language and Security facades are reused unchanged.
`canonical-settings-personal.spec.ts` records URL selection and source tabs at
1440×900/390×844, the sound request mapping, and read unavailability. Root
`pages/settings/index.tsx` and every administration panel remained unavailable
until the following separately verified root-shell activation.

### Canonical root Settings shell — Personal-only activation — 17 November 2026

The exact copied `resources/js/pages/settings/index.tsx` now owns canonical
`/settings` and the source's Personal-compatible legacy panel aliases
(`personal`, `appearance`, `notifications`, `profile`, `security`). It is
loaded as one source module through `frontend/src/platform/settings-root-route.tsx`;
no copied component is renamed, reconstructed or selectively substituted. The
adapter shares `frontend/src/platform/personal-settings-projection.ts` with the
prior Personal route, so its selected Personal workspace receives the same
complete audited document rather than a new or fabricated prop set.

| Source root input / behavior | Rust contract and adapter evidence | Availability rule |
| --- | --- | --- |
| Per-resource `{read, update, delete}` map and administrative visibility used by `settings-navigation.ts` and `index.tsx` | Authenticated `GET /api/v1/settings/bootstrap`, `getSettingsBootstrap`, `SettingsBootstrap`, `SettingsAccessCapability`; `api/src/settings_bootstrap.rs` derives only display levels from the current `AuthorizedPrincipal`. It exposes no role-permission scopes and every downstream API route reauthorizes. | `401`, `403`, `503`, malformed/missing data or a network failure render the bounded root Settings unavailable state. The older `/me.settings_access` boolean map remains a lower-detail current-user visibility projection and is not recast as this map. |
| Source Settings notification bell | The same bootstrap request runs the existing bounded `AdminSettingsNotificationsQuery`; OpenAPI now carries opaque report UUID keys in `AdminSettingsNotificationOrganization`. The adapter preserves that UUID for React's source key rather than inventing a Laravel numeric identifier. | Notification data is never replaced with a zero-count success after an unavailable dependency. Bootstrap failure makes the shell unavailable. |
| Source user chrome, public Settings palette and complete Personal panel | Existing owner/public reads: `GET /me`, `/account/profile`, `/account/security`, `/public/welcome`, `/learner/language-preference`, `/learner/platform-translations`, `/learner/sound-preferences`, `/learner/feedback-prompt-preference`. `loadPersonalSettingsProjection` maps only the fields each copied Personal/root component consumes. | A failed required Personal dependency makes the root unavailable. The adapter supplies no Laravel numeric user identifier, generic flash data, admin arrays or old standalone page props. |
| Root sidebar/top bar, source URL ownership, narrow selector and copied corner navigation | `settings-root-route.tsx` mounts the source index whole. Its minimal compatibility boundary adds only the copied shell's lifecycle subscription, exact typed logout command and the dormant media-route rejection needed to load the source module. It does not add generic Inertia visits/forms or Laravel transport. | `panel` values outside the complete Personal family never mount the source index, never issue Personal reads and show the explicit unavailable state. Thus AI, Access, assets, Learning Support, World Builder, presentation, translations, API and information panels cannot look successfully loaded from empty props. |

The source index imports all source administration panels as part of its own
module graph. The root adapter therefore loads that exact module lazily, while
the admission guard prevents an incomplete selection from evaluating its panel
document. This preserves the source root hierarchy without broadening the
platform facade solely to make every dormant Laravel mutation executable.

`frontend/e2e/canonical-settings-personal.spec.ts` now proves the root's source
top bar/sidebar and Personal tab selection at 1440×900 and 390×844, including
the narrow selector's visible bounded control, typed sound request, required
Personal-read failure, bootstrap failure, and an unprojected admin selection
that makes no Personal API read. Rust's focused bootstrap unit test proves
read/update/delete display projection and the absence of scope leakage.

### Canonical World Builder activation plan - 17 November 2026

**Status: not activated.** The exact World Builder frontend already exists only
under `frontend/canonical-source/resources/js/**`, copied from pinned `main`
`32c3113a5bc688c9944c20942cdf40a6a5d57d7f`. The active standalone resolver
intentionally rejects `/settings?panel=admin-world-builder` before it mounts
the copied Settings index because there is no audited page projection for that
route family yet.

This replaces the former P0/parity backlog and every claim based on
`original-*`, `lifted-*`, `extracted-*`, or bespoke standalone World
Builder presentation. Those files and their browser tests are not a migration
plan or visual evidence. The Rust endpoints behind
`/api/v1/admin/world-builder/**` remain reusable capability evidence; they
are not frontend activation evidence.

#### Canonical route boundary

The source route is exactly:

```text
/settings?panel=admin-world-builder
  -> pages/settings/index.tsx
  -> features/settings/world-builder-settings-panel.tsx
  -> Graph | Review | Structural | selected-map workspace
```

The copied source files and their direct source-owned destinations are:

| Source boundary | Copied source paths |
| --- | --- |
| Settings route and nesting | `pages/settings/index.tsx`; `components/settings-configuration-shell.tsx`; `features/settings/world-builder-settings-panel.tsx` |
| Graph and inspectors | `pages/settings/worlds/index.tsx` |
| Structural workspace | `features/settings/world-map-management-panel.tsx` |
| Graph dialogs | `features/settings/{duplicate-map-dialog,map-export-validation-dialog,map-import-dialog}.tsx` |
| Direct authoring destinations | `pages/settings/worlds/{edit-map,configure-map,edit-node-activities,edit-markdown-activity,edit-npc-dialogue}.tsx` and their complete sibling helpers |
| Shared source dependencies | `components/{input-error,learner-paginated-items,pagination-controls}.tsx`, `components/ui/**`, `hooks/{use-appearance,use-platform-translation}.tsx`, `lib/{json-response,media-upload,media-url,utils}.ts`, `theme/**`, and copied `resources/css/app.css` |

All of these stay byte-identical inside `frontend/canonical-source/**`.
Platform code may mount a source module and replace only its explicitly
audited Inertia, Wayfinder, page-prop, media, or typed-Rust transport seam. It
must not copy a component out to a new `lifted-*` file, edit the canonical
copy, or use a reconstructed component as a fallback.

#### Current boundary and reusable Rust evidence

| Need | Current evidence | Activation rule |
| --- | --- | --- |
| Canonical route admission | `frontend/src/platform/canonical-resolver.tsx` and `settings-root-route.tsx` mount the copied Settings root for Personal-only aliases and reject every administration panel. | World Builder stays explicitly unavailable until a complete source-shaped route projection is registered. Do not bypass the root by embedding a substitute workspace. |
| Graph/read data | `GET /api/v1/admin/world-builder`; `backend/crates/api/src/main.rs`; generated `AdminWorldGraph` schema and Rust graph tests. | Audit every source `WorldGraph` field, including map/node descriptions and slugs, review counts, portal endpoints and nullable activities, before a Graph branch is admitted. |
| Map/node documents | Existing scoped map and node reads plus `admin_world_*` application/persistence modules and OpenAPI operations. | Use only after their source page/document/URL/error mapping is written; a successful generic editor read is not a source route projection. |
| Review queue | Existing typed review-queue endpoint and pagination contract. | Audit the source four-item pagination, destination URLs, loading/empty/retry/error presentation before enabling the copied Review branch. |
| Commands, media, import/export and history | Existing typed authoring commands and OpenAPI schemas. | Bind one complete copied source destination at a time. A command may not be exposed just because its endpoint exists. |
| Authorization and failure | Rust remains the sole scope and policy owner. | `401`, `403`, scoped `404`, `503`, malformed data, and network failure must select a documented source-compatible unavailable/error branch; they must never become an empty successful model. |

#### Activation register and order

The work is ordered by complete canonical source boundaries, not old P0 labels
or isolated visual widgets.

1. **World Builder route admission audit.** Trace the copied Settings-root
   invocation and every prop passed to `WorldBuilderSettingsPanel`. Record
   exact source files, prop shape, navigation/query ownership, direct runtime
   imports, existing Rust/OpenAPI evidence, missing fields, and the unavailable
   state. No UI is activated in this audit.
2. **Read-only Graph route.** Mount the copied root/panel/graph composition as
   whole modules only after one graph projection supplies every required field.
   Include normal, loading, empty, permission-unavailable, read-error,
   selected-map, and selected-portal source states; destinations without a
   complete route projection remain explicitly unavailable.
3. **Copied Review branch.** Activate it only after its complete read,
   pagination, retry/error, and map/node/activity destination matrix exists.
4. **Copied Structural branch.** Activate the exact source layout only after
   selected-map, selected-MapAsset, no-map, and configuration destination
   documents are available. Do not substitute legacy authoring surfaces in its
   content slots.
5. **Direct copied editor routes.** Activate `configure-map`,
   `edit-map`, activity, Markdown, and NPC routes one complete source route
   at a time. Map their full read/write/history/media contract before
   admitting a route; unimplemented subflows stay source-unavailable.
6. **Remaining dialogs and mutations.** Activate duplicate, create, import,
   export, details/history, and media actions only with the source component
   mounted whole and its command/error/CSRF/download contract covered.

#### Required evidence for every activation

- Reverify that `main` resolves to the pinned SHA and that the canonical-copy
  verifier still reports byte identity.
- Record a source-to-Rust contract matrix: source path and input, exact Rust
  endpoint/schema/error, narrow adapter, missing contract, and unavailable
  rule.
- Prove the copied source hierarchy, labels, URLs, visible/bounded controls,
  loading/empty/error behavior, and responsive layout at **1440x900** and
  **390x844**. Browser tests must import or mount the canonical module, never
  a reconstructed replacement.
- Run the focused frontend build/type checks, relevant Rust/OpenAPI tests, and
  source-derived browser tests before committing. Preserve unrelated worktree
  changes.
- A route is complete only when its complete source boundary and every exposed
  destination contract are verified. Backend availability alone is not
  frontend parity.

#### Prohibitions

Do not recreate the graph, cards, inspectors, mobile layout, dialogs, form
markup, or navigation in platform code. Do not selectively copy source
fragments. Do not invent page props, empty maps, fake permissions, generic
Inertia/Laravel transport, or success data. Do not call a historical
standalone/e2e assertion source parity merely because it passes. Laravel remains
the production owner until this canonical route activation evidence exists.

### Retired standalone frontend audit

The standalone/reconstructed frontend audit and its implementation sequence were
removed after the canonical frontend reset. The canonical-source activation
register above is the sole frontend execution plan. Existing Rust contracts and
tests remain reusable only after the source route that consumes them is
independently audited.

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
same source Learning Support section navigator. The shared top bar and learner
header consume the app's single typed current-user projection for their
source-shaped account controls: current identity display name, optional public
username and an owner-scoped profile-image URL. They do not issue a separate
identity read per workspace, so moving between available child workspaces does
not discard the parent source hierarchy. The source
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
selected or uploaded reusable visual referenced. Global map-link storage and
API now preserve the source's distinct node-to-node links, including their
nullable activity endpoints. The copied Portal authoring control remains
unavailable until its complete canonical source route and transport matrix are
verified.

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

The World-details backend contract is available for a later canonical source
route activation. `PATCH
/api/v1/admin/world-builder/world/details` requires the distinct global
`world_map_access.ru` grant, locks the current World, rejects a stale
`updated_at` value, stores the pre-change title/description as an immutable
revision, and then changes only those two fields. `GET
/api/v1/admin/world-builder/world/versions` provides the bounded newest-first
history page; its CSRF-protected restore endpoint first snapshots the current
details and then restores the selected same-World revision. The copied dialog
remains unavailable until its complete source route is admitted.

### World Builder map-visuals slice — 8 November 2026

`PATCH /api/v1/admin/world-builder/maps/{map_id}/visuals` now migrates the
Laravel Map Configuration visuals as a complete map-scoped authoring slice.
It accepts only the source dark/light theme vocabulary: map, title-panel,
MapAsset-side-panel and control colors, a background image, and bounded
positioned decorative layers. The writer retains unrelated legacy configuration
while merging recognized fields, replaces the submitted layer list atomically,
and uses the source `world_maps.ru` all/own/assigned/direct-editor check.

Map-owned reusable-media references are synchronized on save, copied when a
map is duplicated, removed when it is deleted, and delivered to learners only
for a published role-visible map. The copied Map Configuration route remains
unavailable until its complete canonical source projection is verified.

### Canonical direct-editor route rule

Historical reconstructed Map Configuration, MapAsset, and Activity Editor
implementation notes were removed with the old frontend plan. Their Rust
endpoints, application modules, persistence tests, and OpenAPI operations
remain backend evidence only. Each copied direct editor route is activated only
under the canonical World Builder plan: mount its whole copied source module,
record its complete contract matrix, and leave it unavailable until every
required read, write, media, history, and error seam is verified.

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

The Rust NPC dialogue graph contract creates a dedicated dialogue activity and
default end node, preserves independent graph layout and transitions, resolves
tool slugs and typing-sound sets server-side, and permits same-world answer
hide/unlock events only. Its copied canonical editor route remains unavailable
until the route-level activation matrix is verified.

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
| World                                 | Original map renderer, alpha-aware interaction, asset visual, map search, node drawer, bookmark control, route-start cards, journal trigger, localized source learner navigation, Personal Notifications destination, current-user account-menu shape, owned inventory/tool-belt with map-node use, configured NPC dialogue tool grants, and the original floating Groups control. Groups retain the source member-only reader, bounded source message history, help-request/other-member resolution and member-majority staff-chat consent commands through Rust-owned contracts. | Other unsupported World behavior whose complete contract is not available yet |
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
| `/world`                                                                  | `/world`                      | Available           | Public exploration plus signed-in, server-authorized start/reset controls for supported `open_practice`, question, reflection/review, Markdown, tool-grant, item-grant, item-obstacle, base-obstacle, NPC-dialogue, shared-task, Portal and Message Prompt/Wall starts. The signed-in source-derived learner controls retain the Personal Notifications destination, current identity display name/avatar and username-plus-email account menu from the shared current-user projection; their fixed learner-navigation and account-control copy reads the existing bounded platform catalog. The floating Groups control reads only the learner's own bounded group page, sends member messages/help requests, permits only another member to resolve a help request, and records one source-majority staff-chat consent vote. Broader World behavior remains incomplete.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/learning/search?query={term}`                                           | —                             | Not available       | Search is retained inside the lifted `/world` surface; no substitute standalone search page is exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `/learning/nodes/{node}/play?run={uuid}`                                  | Same path                     | Available           | Signed-in playback for server-owned `open_practice`, question, base/explain/transfer reflection and standalone `review`, Markdown, tool-grant, item-grant, item-obstacle and base-obstacle runs, plus private one-question recall, due revisit and historical replay runs. After an ordinary route activity completes, the lifted optional source check-in accepts the learner's optional feeling, note and later-direction; choosing no values performs no write. Question options are read from a learner-safe projection; the Rust writer evaluates selected keys and records private attempts without advancing the run, so source feedback and independent retries remain available. The feedback surface supplies the original confidence and keep/remove-recall controls. A recall run derives its question from the learner-owned queue, schedules the source interval after answer, and completes without route progression, evidence or a check-in. A historical replay instead marks the activity complete as the source direct-entry path does, but cannot advance a route, create route-run evidence, or satisfy a recall/revisit queue. The generic completion command then finalizes ordinary route attempts and resolves their authored branch. Markdown follows its safe bounded authored page graph before using that generic server-owned completion command. A tool-grant command derives the active activity and its configured public tool reference server-side, makes ownership idempotent, and completion rechecks ownership before it advances. An item-grant command derives the active activity, probability and configured public item references server-side, persists one random roll per opaque play run, and only that result can complete the activity; a new run can roll and increment holdings again. Item/base obstacles retain their configured consumption or owned-tool resolution rules. Reflection first writes only to private journal/reflection records, then explicitly completes its active run. The lifted source explain/transfer presentation includes response focus, optional initial/later confidence, changed context, bounded authored cues, after-save guidance, optional independent response and private response comparison. Both an authored review intent and the standalone `review` type supply the original bounded earlier-note reader, optional confidence, authored cue and learner-outcome controls. The response provides authorized node/map/route orientation labels and bounded authored check-in context used by the lifted original learning-context panel; the node path segment preserves the source URL family, while the opaque run UUID remains the only API authority. Revisit, recall and replay runs intentionally omit this ordinary check-in pause. |
| `/journal`                                                                | `/journal` → `/home?journal=1` | Available | The authenticated source redirect opens the lifted Journal overlay on the Learning Desk. Signed-in learners can read, search, create, edit and delete their own paginated private journal pages in that overlay. The original bounded Learning trail reads recent private check-ins, preserves its source map destination and reopens an activity only through a CSRF-protected opaque replay run. Due private revisit invitations use the original Journal panel and can open a server-owned opaque revisit run or be deferred/hidden. The original owner-only Markdown Export and source-default light/dark paper presentation are available. The original platform-catalog behavior now also covers one-time feedback-request state, revisit timing and check-in direction copy; the narrow editor owns its own scroll so its feedback controls remain reachable. Authorized Learning Support staff can configure that presentation through the lifted Journal settings page; uploaded and selected reusable visuals are protected by saved references and projected through the authenticated learner-media route. Focused Rust journal contract tests, generated-client/build checks and a source-derived desktop/390px browser fixture cover this boundary. |
| `/bookmarks`                                                              | `/bookmarks`                  | Available           | Signed-in learners can open the source-derived personal bookmark map beneath the shared fixed learner-surface header, inspect a saved place's original map and published-topic context, return to its topic or World location, and remove it. Rust omits the topic link when the map has no published topic. Its fixed loading, map, empty-state and panel copy resolves through the platform catalog; map, node and topic names remain server-owned content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `/topics`, `/topics/{topic}`                                              | Same path                     | Available | Signed-in learners can use the lifted source directory and all four source detail sections: Trail, Routes, Maps and Overview. The directory returns its server-authorized `content_topics.ru` capability only as the source-shaped manage-topics affordance; the admin route independently enforces that same permission. Directory, detail navigation, Trail competence/learning-area/reflection copy, Route filters/empty states, Maps/Overview copy, and pagination controls resolve through the Rust platform catalog. The Trail restores the source’s complete bounded evidence reading, including objectives, cues, independent-check/review/calibration context and safe source links. Routes use the existing CSRF-protected server-owned start command and opaque run URL. The source Trail’s competence drill-down preserves the source topic as its Star Map return context; its recent-reflection, competence-evidence and return controls reopen an activity only through the shared CSRF-protected opaque replay command. Its reflection comparison retains the source Journal link, which follows the authenticated standalone `/journal` redirect. Focused Rust topic tests, generated-client checking, and desktop/390px browser evidence cover the current contract. |
| `/home`                                                                   | `/home`                       | Partially available | The lifted source Learning Desk search, Recall Queue, Return when useful, Continue learning, Recent traces, Recent reflections, Pinned for later/Saved places rail and Possible connections section, beneath the shared learner header, list only source-authorized information. Its source-shaped heading, focus control, available-area labels and search label, placeholder, action, empty-state and pagination copy resolve through the bounded platform catalog. The search retains its source debounce, five-result panel, first-result submit and pagination; its authenticated contract orders published topics, then current-World maps, then visible places without reusing the public asset search or exposing a standalone search page. The other sections list only private questions the learner explicitly kept, due private returns the learner chose, visible in-progress routes, recent completed routes, the learner's four most recent visible private check-ins, and the learner's visible private bookmarks. Continue and recent route rows retain their source map-place art, map/topic/location links, bounded authored learning-area links, purpose, time guide, dates and placement explanation. An in-progress row uses its current activity's authored context; a completed row uses its start activity, matching the source serializer. The original local area navigation shows only available sections, retains the selected section in the `area` URL parameter, recognizes the source Support area, and moves focus to its heading after an intentional switch. Its local per-account/browser Focus view hides the secondary pinned rail without changing learner state. Completed entries sharing a visible active place are suppressed, preserving one clear next step. The rail selects an active bookmarked place when present, otherwise the newest saved place, and retains original World context links. Possible connections excludes the pin, presents up to three remaining saved places, and retains its source empty guidance when a learner needs more context. Route actions reuse the established World read model and CSRF-protected route-start command: it resumes an unfinished opaque run or creates a new opaque run for a completed route. A reflection opens only through the shared CSRF-protected historical-replay command, which returns an opaque replay run. Related check-ins retain up to three validated authored learning-area links and their published map-topic return context. The original optional purpose/time filters narrow only visible in-progress routes; an explicit CSRF-protected save stores their private application preference across sessions without creating a recommendation or deadline. Recall questions open through an opaque recall run and may be deferred one day or removed; returns open only through a server-owned opaque revisit run and may be deferred or hidden. Private staff replies to a learner's message-prompt support request appear only through the learner's owned, visible support-response projection. |
| `/paths`                                                                  | `/paths`                      | Partially available | Signed-in learners can use the lifted source Paths page and shared learner header, filter the server-owned eligible routes by learning purpose or available time, page through the bounded results, and enter a route through the existing CSRF-protected opaque-run command. Each result retains the source Paths card’s topic, learning-area, map and place orientation links, image, time guide, route context, new/in-progress/completed status and current-step reader; the start command remains server-owned. Its fixed platform copy and shared route-card labels resolve through the Rust platform catalog, and the shared learner selector exposes every administrator-enabled locale while broader fixed-copy consumption is migrated surface by surface. The source’s direct Inertia link is deliberately mapped to that already-established typed command; it does not expose a client-forged destination. |
| `/competence?topic={slug}&from={slug}`                                    | Same path                     | Partially available | Signed-in learners can use the lifted source Star Map, its guide, qualitative selected-topic reader, private evidence ledger, learning pulse and bounded review history. The original `topic` selection and `from` return-context query semantics reuse the existing authorized topic reader, including the source “not on your map yet” explanation. Topic context links use the existing source-derived topic route. Learning-pulse, review-history and selected-topic return controls reopen their activity only through the same CSRF-protected opaque replay command; the read contract still carries no client-supplied activity destination. |
| `/settings`, `/settings?panel=information`, `/settings/about`, `/settings/imprint`, `/settings/data-protection`, `/settings?panel=personal&personal=appearance`, `/settings?panel=personal&personal=language`, `/settings?panel=personal&personal=feedback`, `/settings?panel=personal&personal=sound`, `/settings?panel=personal&personal=security`, `/settings?panel=personal&personal=delete-account`, `/settings/profile`, `/settings/language`, `/settings/appearance`, `/settings/security`, `/settings/color-palette`, `/settings/assets`, `/settings/assets/media`, `/settings/assets/items`, `/settings/assets/tools`, `/settings/assets/sounds`, `/settings/presentation`, `/settings/languages`, `/settings/journal`, `/settings/ai`, `/settings/admin-panel`, `/settings/groups`, `/settings/worlds` and `/settings/worlds/maps/{map}/(edit|configure)` | Same paths | Available | The source-adapted Personal Profile, Appearance, Language, Feedback and Sound settings surfaces use the source's common eight-section Personal navigation rather than route-specific substitute sidebars; it preserves section order, explanatory copy, destructive styling and keyboard navigation while React URL selection replaces only the original in-page selection mechanism. Laravel's direct Profile, Language, Appearance, Color palette, asset-library, presentation, language-administration, Journal, AI, admin-panel, group and World Builder routes retain their source redirects to the canonical panels; the source admin-panel query keeps the Learning Support workspace's existing learner-message default. Valid source map edit/configure URLs preserve the scoped Rust map UUID and select the matching nodes/configure view. The separately rendered Security URL remains direct and preserves its password-confirmation return path. The source About & legal corner destination preserves its intentionally empty route group; its information pages remain their direct authenticated routes. They persist the signed-in learner's identity-owned name/email, application-owned public username, staged profile image, Light/Dark, enabled application locale, feedback-invitation choice, mute, effects-volume and ambience-volume preferences through their respective data boundaries. The selected enabled locale now loads its bounded platform-copy catalog, while active owned play runs can load filtered activity copy; both preserve fixed English fallbacks and cannot affect graph, answer correctness, media, scoring or access policy. Feedback is opt-in by default and may be declined/re-enabled without changing the separate shared feedback-message record. Security replaces only the authenticated user's credential verifier through the identity-data boundary, and preserves the source recent-password boundary before the screen opens. The source-derived TOTP lifecycle supports QR/manual authenticator setup, six-digit confirmation, login challenge with authenticator or recovery code, remaining recovery-code view/replacement and factor disable. Recovery values have one-use Argon2id verifiers and separately encrypted identity-only display copies; responses are non-cacheable. The source passkey lifecycle supports discoverable passwordless login, recent-confirmation, resident-key registration, owner-scoped list/removal and an identity-only public-credential store. The source Delete account panel preserves its warning, confirmation modal and direct current-password check; it deletes the current principal and identity through the shared resumable workflow, ends the session and returns to the welcome surface. The authenticated About, Imprint and Data protection routes preserve the source settings article and presentation-scoped Markdown editor; a reader without that capability stays read-only. Authenticated password and factor changes are delivered idempotently to the source-shaped application access history through an identity transactional outbox. Other Personal, administration and authoring settings remain unavailable. |
| `/settings?panel=admin-access&access=groups` | Same path | Available | The source-adapted Groups panel remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. It respects the migrated role permission matrix: an authorized role may see or manage all groups, only groups it created, or its assigned manager groups, according to the relevant `groups` and `group_members` scopes. It creates/edits groups, assigns application users, and shows only source-consented staff-visible chat. |
| `/settings?panel=admin-access&access=users` | Same path | Available | The source-adapted Users panel remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. It uses the typed `GET /admin/users` projection: identity-profile/status and application-role summaries, server-calculated assignable roles, bounded invitation summaries and bounded access history without credential verifiers, sessions, invitation plaintext or learner data. Its server-owned update/delete flags preserve the source read-only versus editable state. `PATCH /admin/users/{subject_id}/access` preserves role-hierarchy validation, login disablement, temporary bans, self-lockout protection and access audit through the separate identity/application databases. `DELETE /admin/users/{subject_id}` preserves source self-protection and deprovisions the identity/application pair through a resumable deletion workflow. |
| `/settings?panel=admin-access&access=roles` | Same path | Available | The source-adapted Roles panel remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. It uses `GET`/`POST`/`PATCH`/`DELETE /admin/roles` to preserve the source-shaped role catalogue, hierarchy and complete resource/level/scope permission matrix. Server-owned update/delete flags preserve read-only behavior; source `roles` levels authorize read, create/update and deletion, and system roles cannot be deleted. |
| `/feedback` | Same path | Available | Signed-in learners can use the source-adapted deliberate platform-feedback form, including its bounded platform-catalog fixed copy. Rust accepts only the source category values and a bounded 10–4000-character message, then records it separately from private journal, activity and competence data. |
| `/settings?panel=admin-learning-support&support=learner-messages` | Same path | Available | The capability-gated source Learner Messages workspace uses the lifted Settings top bar, primary/sidebar and account navigation, shared source Learning Support section navigator, nested topic navigation and Needs attention digest. Its typed Rust endpoints preserve the bounded six-message/three-response pages, source filters, private-support reply restriction and staff hide/restore/delete operations for private-support and peer messages. |
| `/settings?panel=admin-learning-support&support=platform-feedback` | Same path | Available | The source-adapted Platform Feedback review queue retains the shared source Learning Support navigator and is available only to application principals with its separate view/review capabilities (initially the migrated platform-administrator role). It pages deliberately shared messages with unreviewed entries first, shows only the needed author identity projection, and preserves the source’s sole action: mark a message reviewed. |
| `/settings?panel=admin-learning-support&support=organization-icons`, `/settings?panel=admin-learning-support&support=competence-topics`, `/settings?panel=admin-learning-support&support=learning-concepts`, `/settings?panel=admin-learning-support&support=journal` | Same paths | Available | Organization-icon moderation, Competence Topics, Concept Library and Journal settings retain their typed Rust moderation/catalog/policy workflows inside the shared lifted Settings and Learning Support shell. The source nested navigator remains available across desktop and narrow layouts rather than replacing each child with a standalone administration page. Rust keeps separate `organization_moderation`, `competence_topics`, `learning_concepts` and journal-policy authorization server-owned; catalog/policy changes never rewrite existing activity or learner-evidence snapshots. |
| `/organizations`, `/organizations/{slug}`, organization membership, join-request, message and icon routes | Rust application database / typed React contract | Available | The source-shaped directory, leader-owned text/deletion and icon upload, membership, join approval, governance transitions, member chat and member icon reporting are migrated with contract, database and local browser evidence. Due random leadership rotates through the documented idempotent backend scheduler command, never on a browser read. The source-shaped moderator queue can view a reported-icon snapshot, dismiss a report, or remove the organization’s current icon through its separate capability. |
| `/learning/groups/*` | Floating World control and `/settings?panel=admin-access&access=groups` | Available | The source-derived member group-chat control and bounded platform-administrator group workspace are implemented through typed Rust contracts. |
| `/settings?panel=admin-access&access=links`, `/access-links/{token}` | Same paths | Available | The source-adapted Access links workspace remains inside the shared lifted Settings and Access Management shell across desktop and narrow layouts. Administrators with the separate access-link capability can create, enable/disable and inspect bounded hashed tool/item grant, registration and temporary-login links. Registration links expose only roles the issuer may assign and create the selected application-role set through the documented compensating identity/application workflow; locally created links from before this contract retain the historical learner fallback. Temporary login creates and signs in a fresh temporary learner with a server-generated unknown verifier. Resource links remain redeemable only by a signed-in learner. Usage, expiry and replay policy are enforced server-side. |
| `/admin/topics` | Same path | Available | The source-adapted Topic Structure workspace preserves its area/topic disclosure, forms, insertion/reordering controls and responsive layout. Typed Rust requests replace only the original Inertia transport; `content_topics` read/create/update authorization and source-shaped validation remain server-owned. |
| `/settings?panel=admin-assets-world-objects` | Same path | Available | The source Settings shell now keeps its six responsive nested sections together: Visuals, Sounds, Dialogue typing, Tools, Items and Cursor images. The source-adapted reusable Visual Library provides bounded search/tag filtering, upload, metadata, replacement, private preview/download and unreferenced deletion through `assets` and `media_paths` permission checks. Its companion source-adapted Sound Library at `asset=sounds` preserves searchable sound selection, icon/volume/duration/loop metadata, managed upload, play/pause/stop preview and sound deletion through the separate `sounds` permissions. The Dialogue typing section preserves its source A–Z sound-set workspace. Audio has opaque storage, normalized reference integrity, author-only preview and anonymous delivery only while a published saved sound still references it; replacing/deleting its final reference reclaims the audio record and bytes. Its source-adapted Cursor images section retains the five source role definitions, optional add/delete/reassignment, image upload/selection, hotspot/size/fallback controls and click-point preview. Saving through `presentation.ru` synchronizes cursor media references transactionally; the anonymous presentation projection rewrites only those active references to the public media route. Reusable activity-template snapshots register managed media URLs as normalized active and immutable-revision references, so a replacement keeps a stable asset identity and deletion cannot strand a saved template or restore point. MapAssets, node visual themes, route visuals, Markdown, Portal, NPC dialogue, Item Grant, Tool Grant, Item Obstacle and Base Obstacle use the same source-adapted picker and synchronize managed visual references on save, import/duplication and cascade deletion. Learner delivery authorizes each managed visual only through its active, published and visible reference; no generic raw protected-media path is exposed. |
| `/settings?panel=admin-translations` | Backend catalog, delivery and scoped learner consumption foundation | Partially available | Authorized `languages` administrators can create disabled locale definitions, rename, enable or disable them through the source-compatible atomic update, export canonical English or a locale’s JSON catalog, and import a bounded two-MiB JSON catalog with optimistic source-version protection. The source-adapted standalone administration workspace consumes that typed Rust contract and preserves the catalog list, create, rename, enable/disable, export and import flows. Enabling a locale immediately adds it to the owner-scoped learner selector; disabling it keeps its catalog editable while excluding it from new selections. The importer persists platform strings and a strict activity learner-copy projection only; graph structure, answer correctness, media, and policy data cannot be written through it. The standalone React app source-adapts the Laravel platform-translation hook: its shared provider reads the enabled private locale's flat platform catalog, refreshes after a language-preference save, and leaves fixed-copy fallbacks intact if a request is unavailable. The lifted learner header and player consume that catalog. The player separately reads filtered activity copy only for its current, owned, active and still-visible route run, then applies only catalog-approved title/introduction, bounded activity configuration strings, Markdown-page copy, question prompt/options and NPC-dialogue node copy; it cannot alter graph structure, answer correctness, media, identifiers or policy. It is never an arbitrary activity reader. Broader fixed-copy consumption remains a surface-by-surface migration task. |
| `/settings?panel=admin-public-pages`, `/settings?panel=admin-color-palettes`, `/settings?panel=admin-translations` | Same paths | Partially available | Public presentation, Color palette and Languages remain inside the shared lifted Settings and Presentation & Localization navigator across desktop and narrow layouts. The source-adapted Public presentation workspace preserves its settings shell, branding control, dark/light authentication and public background controls, welcome-page copy/actions, ordered information-page management (up to 24 source-shaped slug/title/Markdown/dark-light-background entries), upstream and up-to-twelve ordered modified-source links, image upload and reusable-visual selection. The three direct About/Imprint/Data protection routes retain their separate fixed-content editor. Rust authorizes each reader/writer through the source `presentation` permission; saved reusable references protect selected visuals from deletion and an anonymous image is served only while the public presentation references it. Cursor images are available from the source Assets & World Objects section. The Color palettes workspace now preserves both the seven public fields and the sixteen Settings-UI fields, each with dark/light color, opacity and reset controls, plus source-shaped public/login and Settings/Controls previews. Learner, journal and map palette models remain unavailable until their separate contracts exist. |
| Remaining authoring/settings/admin routes | — | Not available | These belong to later authoring and administration slices with their own authorization tests. |
| `/protected-media/*`                                                      | —                             | Intentionally not carried | The Laravel raw map-media URL family is not a greenfield Rust endpoint. Its required behavior is replaced by managed reusable-asset upload, selection, normalized reference integrity, replacement, author preview/download, scoped learner delivery and public delivery only through active published references. The access-link preview, redemption and temporary-login contracts remain available at their source paths as recorded above. |

The ordinary Personal Settings routes now share the lifted source Settings frame
rather than rendering route-local substitute pages: its top bar, global
Settings menu, quick navigation and responsive Personal section navigation
remain present on Profile, Appearance, Language, Notifications, Feedback,
Sound and Delete Account. Security retains its distinct source
password-confirmation route boundary; its typed password, TOTP and passkey
flows remain separate rather than being forced into substitute chrome. Their
existing typed Rust preference, identity and destructive commands remain
unchanged; the browser check covers source keyboard navigation to the
destructive panel as well as desktop and narrow Settings navigation. The
source-shaped notification menu keeps its trigger-aligned, collision-bounded
surface, outside/Escape dismissal and Escape focus return across those
viewports.

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
Source Markdown creation and complete-form updates are available through `POST
/api/v1/admin/world-builder/nodes/{node_id}/markdown-activities` and `PATCH
/api/v1/admin/world-builder/activities/{activity_id}/markdown`. The existing
replatform editor remains subject to the pinned-source direct-lift audit; it
must not be counted as frontend parity until the exact Markdown route and its
field tree are mounted through a Rust transport adapter. The complete-form
writer preserves unrelated configuration and records embedded managed
reusable-media URLs as activity references, so selected images cannot be
deleted while an authored page uses them.
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
lifecycle. The Rust node lifecycle and authoring contracts are reusable backend evidence.
They do not activate the World Builder frontend. The copied source MapAsset
editor stays unavailable until the canonical direct-editor route rule is met.

The node's source `Lock for all users` backend action is also now available
through a scoped typed command. It removes only existing learner tool-unlock
rows for the selected editable node, never learner discovery or support-issued
manual overrides. Its copied source control remains unavailable pending the
complete canonical MapAsset-editor route projection.

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
browser check opens the launcher during an active activity run. Fixed learner
copy (including context labels, AI disclosures and assistance controls) reads
from the scoped platform catalog; a mocked catalog acceptance check verifies
replacement values and the launcher panel at a narrow viewport.

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

### Canonical activity-editor route rule

The historical reconstructed NPC and Markdown editor lift records have been
removed. Rust typed authoring, AI, and Content API contracts remain backend
evidence. The copied NPC and Markdown editor routes must be activated only by
the canonical World Builder plan: whole source route, documented page
projection, narrow typed transport seams, explicit unavailable behavior, and
source-derived browser evidence at both required viewports.

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
The ContentPlan dialog is not currently activated in the standalone frontend.
It remains unavailable until its complete copied source route and Rust contract
matrix are admitted under the canonical World Builder plan.

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
