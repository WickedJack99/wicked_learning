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
- activity configuration source references, normalized and bounded by
  `ActivitySourceReferenceConfiguration`

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

Shared-task submissions keep their normalized authored task kind in metadata so
later cooperation review can distinguish contribution, question and reflection
without changing the shared-task completion counter or treating the kind as a
quality judgment. An author-controlled sharing flag and a learner-controlled
submission flag are stored in the same metadata. The learner serializer queries
only the latest five opted-in accepted submissions and omits user identity,
keeping the cooperative playback payload bounded and privacy-preserving by
default. Each displayed contribution is limited to a 500-character excerpt;
the stored submission is not rewritten by this presentation bound.
Those contribution details are included only in activity-playback
serialization, not in broad map-node payloads.

The learner Paths query evaluates the existing per-user map and node state
services in bounded candidate chunks, then serializes only the requested page
of routes and its progress. This keeps the Inertia response and hydrated route
models bounded while preserving unlock and reveal rules that are configured in
node JSON and cannot yet be expressed as a portable SQL scope.

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
Queue serializers expose the original check-in time separately from the
indexed ready time, plus a deterministic learner-facing explanation of the
spacing window and the original pause or later choice. This keeps due
explanations understandable without exposing internal schedule state or adding
a second scheduling system.

`LearnerRecallItem` stores explicit private membership of a question in a
learner's recall queue. The queue is separate from activity progress: it links
to an existing question activity without marking a due review, changing route
position or creating a competence event. The desk query loads a bounded set
with its question, activity and map context in one eager load, while the
progress serializer exposes only question IDs needed to render the in-activity
queue control.

`ActivityCompetenceConfiguration` keeps explanation and transfer evidence
conservative: their authored learning purpose is only emitted as that evidence
type when feedback guidance includes an observable criterion. Otherwise the
completion is recorded as participation while the activity itself remains
usable. The optional response-feedback note is serialized as author guidance and
shown only in the post-response comparison pause for explanation, transfer, and
review activities; it is not copied into evidence as an automated judgment.

`ActivitySourceReferenceConfiguration` stores up to five normalized source
references, including an optional 800-character excerpt or location note, in
the activity's existing JSON configuration. The learner activity serializer
exposes them as a separate bounded `sources` collection and removes the
authoring-shaped config key from the learner config. This keeps the first
provenance slice small and inspectable. The scoped activity-review context also
passes those references to the reviewed authoring request without including
learner data. `LearningSourceRecord` stores a bounded authoring catalog with
the same publication metadata plus bounded Concept Library labels. The activity
graph includes only the first page of that catalog; the author picker uses the
permission-controlled paginated endpoint for later pages and title, URL or
publisher search. Copying one into an activity remains a snapshot rather than
a live link.
Authorized activity authors can update or delete catalog records through the
same bounded editor path; those operations do not mutate activity JSON. Source
updates create an immutable `LearningSourceRecordVersion` snapshot before the
current record changes, and the editor can load the latest revisions through a
bounded paginated endpoint. Deleting a catalog record also removes its private
revision history; copied activity references remain unchanged. Source concepts
are stored as bounded JSON labels on the catalog record and copied into
activity reference snapshots; they do not create competence claims or a live
dependency on later catalog changes. AI-draft linkage remains roadmap work.
Restoring a revision uses the same transactional update path, so the
pre-restore current record is also retained in that history.

`LearningConcept` is a small authoring catalog for reusable evidence vocabulary.
Its bounded query supplies active names to the activity graph and all records
to the permission-controlled Concept Library editor. Saving the catalog
upserts normalized names and removes omitted records; activity configuration
continues to store concept labels as a snapshot, so deleting or renaming a
catalog entry cannot change earlier activity or learner evidence data. Source
records may carry the same bounded labels, which are copied into activity
provenance snapshots when a saved source is reused.

Activity types are registered as small data-shaped definitions in
`ActivityTypeRegistry`, allowing the graph editor and Content API to discover
their connectors without hard-coding one linear course model.

## Learning Companion

`PlatformCompanionSetting` stores the platform-level companion defaults, while
nullable `companion_config` JSON on the world, map, node and activity scopes
stores valid overrides. Reusable authored graphs live in
`LearningCompanionDialogue`; `LearningCompanionDialogueAssignment` stores an
allowlisted world, map, node or activity target. The settings controller
returns bounded pages for both graph management and target selection, and syncs
assignments transactionally. `LearningCompanionConfigurationResolver` applies
scope configuration from broadest to most specific, loads applicable assigned
graphs in one batched query, and fails safe when an authored dialogue graph is
invalid. `LearningCompanionDialogueGraphValidator` bounds graph size, node
content, AI capability names and terminal navigation actions; the server owns
the resulting hrefs. The companion avatar color is one of the validated
inherited visual overrides and defaults to the shared map accent.

`LearningCompanionContext` builds a small allowlisted payload from the already
resolved desk, world or activity context; it exposes only stable references and
at most two named navigation actions. `LearningCompanionTurnService` resolves
the submitted surface identifiers back to accessible server models, resolves
the effective graph and AI settings, and runs only enabled guarded templates
whose purpose is `learner_companion`. It sends the authored AI instruction and
selected bounded references to the existing provider-neutral runner and returns
only a short plain-text response. The turn endpoint has no navigation or content
mutation contract. The launcher is a separate learner-shell component. Its
default lower-left position is shared by desk, bookmark and activity surfaces;
the world map supplies a map-search placement that reserves a slot immediately
to the search control's right.

The learner launcher traverses assigned message, choice and end nodes locally,
keeps a transient in-panel history for Back and Restart controls, and resolves
graph navigation keys against the server-provided context actions. AI nodes wait
for the learner to choose `off`, `question` or `hint`; `off` performs no
provider request, while the other choices make one bounded request and cache a
successful response per node for the open panel. Failed requests remain
retryable without creating a transcript. Loading and provider failures keep
the authored fallback usable. AI must not receive direct authority to
navigate, mutate content or emit arbitrary URLs.

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

Learning Support moderation loads topic summaries in the settings payload and
uses the permission-protected message-topic endpoint for paginated message
records and resolution counts. Response details are fetched in a small first
page for each selected message, and subsequent response pages use a separate
permission-protected endpoint. The database applies a per-message
`ROW_NUMBER()` range before response models are hydrated, keeping both SQL
query count and returned response rows bounded by the requested page size.

Support and reflection models include:

- `LearnerJournalPage` and `LearnerJournalFeedbackRequest`
- `CompetenceTopicDefinition` and learner competence records
- `LearnerReflection`
- `LearningMessageTopic` and moderated `LearnerMessage` records

`LearnerEvidenceEvent` records the activity-specific evidence type, authored
objective, concept-label and learning-purpose snapshots, observable evidence criterion,
outcome, starting confidence, optional post-feedback confidence, calibration,
attempt and assistance context. For question
activities, calibration is a descriptive snapshot derived from the submitted
confidence and answer outcome; it does not contribute a score. For explanation,
review and transfer events it can also store an optional confidence signal
after the authored guidance pause, alongside up to three normalized rubric
cues. Review activities can use the same cues as a learner self-observation
signal. The learner's optional selection of cues they noticed is stored separately as an
observed-cues snapshot; it records self-observation and is not a rubric result.
objective, purpose, criterion, cues and bounded source references are snapshots
of the activity guidance at completion time, so later author edits do not
rewrite the meaning or provenance of an earlier learning moment. Source
references are normalized again when the evidence ledger is serialized. When a
descriptive review outcome is present, both learner evidence-ledger serializers
carry it through as a nullable signal without interpreting it as an assessment.
Reflection responses retain their originating activity play-run, allowing
explanation and transfer evidence to require the response from the same run
without exposing private response text in the evidence ledger. Matching events
also retain a nullable internal reflection reference; deleting a journal
response clears that reference without deleting the evidence event.
The shared frontend review-outcome vocabulary supplies localized labels and
plain-language explanations for the activity selector and learner histories.
When a route entry timestamp is available, `latency_seconds` records elapsed
wall-clock time from
the learner's latest entry into that activity to completion. It is an internal
observation, not a measure of attention and not a learner score.
Due revisit attempts preserve the same optional observation on their bounded
review record when the completion belongs to a tracked route run. A review
submitted without a route-entry timestamp leaves it null; the system does not
infer elapsed time from unrelated requests.
The generic activity completion endpoint accepts optional validated confidence
values. Review activities use the first value for the learner's signal before
the guidance pause and the second for an optional signal after that pause;
both remain descriptive context on evidence and due revisit attempts, without
inventing an outcome. Review activities may also submit one of three
descriptive outcome values; these remain nullable and are not interpreted as
assessment results.
`LearnerReviewAttempt` keeps a separate, bounded history for completed learner-
chosen revisits. The competence query loads only the latest twelve attempts with
their activity and node context; it intentionally omits review metadata and
private journal content from the learner-facing serializer. It includes only
the normalized cues the learner chose to notice, not private review text.
A review attempt may retain a nullable internal link to the matching run's
private reflection and snapshots its response kind, while the serializer
continues to omit the response text.
Reopened activity
evidence uses the same incremented attempt number as its review-attempt record,
so the two records cannot describe different positions in the revisit sequence.
Question answers pass revisit intent into this same completion transaction and
snapshot their correctness and confidence on the review attempt. Their player
does not submit a second generic completion request after the answer is saved.
`LearnerRecallItem` stores the learner-selected question queue separately from
route progress. It keeps the last review outcome and confidence plus a next
review timestamp and bounded review count. The recall query orders due items
first and returns the question context plus those private review signals needed
by the Learning Desk. A learner can
postpone an item through the same scoped service; this moves its next review
one day later while preserving its review outcome and count. A play request
may identify one queued question as recall context; the answer service updates
its schedule only when that explicit context is submitted. The baseline uses
fixed intervals of one, three, seven, fourteen and thirty days for correct
answers, and returns to one day after an incorrect answer. This is intentionally
transparent infrastructure rather than an adaptive competence score.

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
playback behavior differs from image assets. Generic sounds remain suitable for
ambience and one-shot effects; dialogue typing uses a separate set/letter model
so an activity can reference a bounded, reusable 26-letter collection without
copying audio URLs into every dialogue node. The learner serializer resolves
only sets referenced by enabled dialogue nodes (plus the default when needed),
and the dialogue player caches audio elements while using one active channel so
successive letter sounds do not overlap.

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
