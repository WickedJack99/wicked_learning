# Architecture Notes

Wicked Learning is a Laravel 13 application with an Inertia 3 and React 19
frontend. The prototype separates reusable learning behavior from the content,
visual identity and media configured by each deployment.

This document records the current implementation boundaries, not proposed
product behavior. Product intent belongs in [product.md](product.md), current
user-visible behavior in [features.md](features.md), and prioritized changes in
[roadmap.md](roadmap.md).

## Request Areas

Laravel routes return Inertia pages for browser workflows and JSON for focused
interactions:

- `routes/web.php` owns public pages, the learner map, search, bookmarks,
  organizations, activity playback, journal actions and learner progress.
- `routes/settings.php` owns personal settings and permission-controlled
  administration, including World Builder and AI authoring.
- `routes/api.php` owns the session-authenticated, versioned Content API.

Controllers should authorize and validate a request, delegate behavior and
return an Inertia response, redirect or JSON response. Learning-domain behavior
belongs under `app/Learning`, AI behavior under `app/Ai`, and the authoring
contract under `app/ContentApi`.

## Core Content Model

The main hierarchy is:

```text
LearningWorld
  -> LearningMap
    -> LearningMapAsset
      -> internal LearningNode compatibility record
        -> LearningActivity routes and transitions
```

`LearningMapAsset` is the product-level object. It owns placement, imagery,
interaction mode and presentation configuration. A focusable MapAsset also owns
the learner-facing title, description and activity routes through a unique
internal `LearningNode` record.

The internal node remains because activity progress, bookmarks, unlock rules and
portal relations were originally modeled against it. Admins should not create or
link MapAssets and nodes as separate concepts. New MapAsset authoring operations
create the compatibility record automatically.

Important world models include:

- `LearningWorld`, `LearningMap` and `LearningMapAsset`
- `LearningNode`, `LearningNodeBookmark` and `LearnerNodeDiscovery`
- `LearningActivity`, `LearningActivityStart` and `ActivityTransition`
- `LearningPortalLink` and `LearnerRouteProgress`
- `LearningTool`, `LearningItem` and `LearningSound`
- `LearningMessageTopic` and `LearnerMessage`

## Map Rendering And Interaction

Both learner and editor surfaces render MapAssets through shared world feature
modules under `resources/js/features/world`.

MapAssets use percentage-based X/Y coordinates, Z depth, width and opacity.
Transparent image interaction is resolved through a cached alpha mask, so hover,
click and overlap checks follow visible pixels at the rendered responsive size.
The same interaction helpers handle focusable, decorative, hide-on-hover and
toggle-state modes.

Visual configuration resolves normal and highlighted image/color values through
the same renderer used by the editor preview. The learner surface does not allow
MapAsset dragging; placement is an explicit World Builder operation.

## Activity Graph And Progress

Activities connect through `ActivityTransition` records. A MapAsset can expose
several `LearningActivityStart` records as learner-facing route choices. A start
points to the first Activity and can carry route-card images and colors.

`LearnerRouteProgress` stores the learner, compatibility node, route start,
current Activity, run key, completion counts and completion time. Activity types
can persist more specific state without putting it into the URL:

- NPC dialogue uses nested nodes, answers and transitions.
- questions store learner answers and branch outcomes.
- reflections can write learner-owned journal data.
- grants and obstacles use backend services for inventory and progress changes.
- message Activities share a MapAsset-scoped `LearningMessageTopic`.
- portals connect Activity playback to another MapAsset or map.

Completed activity progress also stores the indexed state of a learner-chosen
revisit invitation. Its status and due timestamp keep the finite return queue
bounded at query time; the original check-in metadata remains the learner-facing
explanation and compatibility source for existing records. Opening a due return
link marks only its selected activity as a revisit candidate. Completing that
activity records a separate review-attempt record with its attempt context; it
does not silently turn the revisit into an independent competence claim.

Activity types are registered as small data-shaped definitions in
`ActivityTypeRegistry`, allowing the graph editor and Content API to discover
their connectors without hard-coding one linear course model.

## AI And Content API

AI configuration uses:

- `AiProviderCredential` for encrypted provider configuration
- `AiAgentTemplate` for reusable purpose, model and instruction settings
- `AiContentAuthoringRun` for generated drafts, contract versions, warnings,
  provider metadata, token usage and approval state

`AiResponsesClient` owns Responses-style HTTP transport, timeouts, bounded
transient retries and provider request IDs. `AiModelCapabilities` prevents
unsupported generation controls from being sent for known models, while
`AiProviderError` converts provider failures into sanitized categories and
retryable application responses.

The content-authoring workflow sends an administrator brief plus scoped
map context and a strict `ContentPlanContract`. The returned plan is validated
before it is stored as a draft. Explicit approval invokes `ApplyAiContentPlan`,
which revalidates and creates the MapAsset, Activities, route start and
transitions inside one database transaction.

`ContentApiContract` publishes the machine-readable administration contract at
`/api/content/v1/contract`. The same contract drives the Settings documentation
and API console. Read and mutation access use separate permission levels. The
API currently relies on the signed-in web session and CSRF token; it does not
issue public bearer tokens.

## Account, Access And Support Models

Account and access models include:

- `User`, `UserPreference` and `RegistrationToken`
- `AccessRole` and `AccessRolePermission`
- `Organization`, `OrganizationMembership` and organization messages
- `LearningGroup`, group messages and shared-task submissions

Support and reflection models include:

- `LearnerJournalPage` and `LearnerJournalFeedbackRequest`
- `CompetenceTopicDefinition` and learner competence records
- `LearnerReflection`
- `LearningMessageTopic` and moderated `LearnerMessage` records

`LearnerEvidenceEvent` records the activity-specific evidence type, authored
learning purpose, outcome, confidence, attempt and assistance context. When a
route entry timestamp is available, `latency_seconds` records elapsed wall-clock
time from the learner's latest entry into that activity to completion. It is an
internal observation, not a measure of attention and not a learner score.

Roles are configurable permission bundles. Administrative resources use `RO`,
`RU` and `RUD` levels, and map edit access is additionally scoped by the map.

## Frontend Areas

Important React entry points and feature modules are:

- `resources/js/pages/world.tsx` - learner map
- `resources/js/pages/bookmarks.tsx` - personal bookmark map
- `resources/js/pages/learning/node-play.tsx` - Activity playback
- `resources/js/pages/settings/index.tsx` - unified Settings workspace
- `resources/js/pages/settings/worlds/edit-map.tsx` - MapAsset surface
- `resources/js/pages/settings/worlds/configure-map.tsx` - map configuration
- `resources/js/pages/settings/worlds/edit-node-activities.tsx` - Activity graph
- `resources/js/features/world` - map rendering and learner interactions
- `resources/js/features/settings` - shared administration workspaces
- `resources/js/features/ai` - content-authoring client and review dialog
- `resources/js/features/content-api` - API console client
- `resources/js/features/journal`, `tools`, `items` and `sounds` - reusable
  learner feature areas
- `resources/js/theme` - appearance and presentation resolution

Pages should stay focused on route-level composition. Shared configuration
shells, image/sound pickers, graph transformations, map interaction math and API
state belong in reusable components, hooks or feature modules.

## Media, Themes And Localization

Visual assets are referenced through reusable media paths. Shared image inputs
support upload, download, select existing and clear; clearing removes the form
reference and does not delete the underlying reusable file.

Sounds are separate records because their volume, looping, duration and layered
playback behavior differs from image assets. Activities can reference optional
ambience while specialized renderers add other sound layers.

Presentation data is split between authenticated preferences, database-backed
public/settings/journal palettes, map-specific visuals and authored Activity
content. Fixed platform UI strings belong in `lang/en.json` and are read through
the platform translation hook. Authored or access-controlled learning content
must not be copied into the global catalog.

## Implementation Boundaries

Controllers and React pages should remain thin. Preferred backend ownership:

- Actions for writes such as creating a MapAsset or applying an AI plan
- Services for reusable progress, portals, media, interaction and inventory rules
- Queries for access-scoped, read-heavy loading
- Serializers for Inertia and JSON payload shaping
- Form Requests or validation classes for non-trivial contracts

Do not place graph traversal, slug generation, file rules, MapAsset interaction
math, provider transport or multi-step authoring transactions directly in a
controller or page component.

Schema changes use migrations. `DatabaseSeeder` bootstraps the local admin and
an empty world shell but deliberately creates no maps, MapAssets or Activities.
Deployment content should be authored through the application rather than
hard-coded into React.
