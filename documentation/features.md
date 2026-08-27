# Feature Overview

Wicked Learning is a domain-agnostic prototype for explorable learning without
points, streak pressure or leaderboards. Deployments configure their own maps,
MapAssets, activity routes, media and public presentation while the learning
and authoring systems remain reusable.

## Learner Experience

### Public Pages And Accounts

Visitors can open the welcome, About, Imprint, Data Protection and source-code
pages before logging in. Public and authentication surfaces support configurable
light and dark presentation values.

Registration requires a valid registration token. Authenticated users can edit
their profile and language, choose appearance and sound preferences, manage
passwords, passkeys and two-factor authentication, and review notifications.

### Freeform World Maps

Learners explore maps made from freely positioned MapAssets. A MapAsset combines
the visible map object with the learning place learners can focus; the internal
`LearningNode` record anchors activities, progress and portals behind the
MapAsset. It is not a learner-facing object or an additional authoring step.

Current map behavior includes:

- percentage-based X/Y placement, Z depth, size and opacity
- transparent PNG and WebP artwork with overlapping visual layers
- image-alpha-aware pointer hit areas that follow visible pixels instead of the
  surrounding image rectangle
- responsive hit testing shared by the learner map and World Builder preview
- normal, hover and focused visuals with configurable borders, labels, colors
  and optional highlight images
- a focused right-side panel with title, description, bookmark state and route
  choices
- no learner-side dragging of MapAssets
- role-based map access
- locked, hidden, hinted, available, recommended and completed learner states
- unlock rules based on completed MapAssets, tools, time and nested AND/OR groups
- tool-driven discovery of hidden MapAssets

MapAssets have four interaction modes:

- **Focusable** opens the learner panel and activity routes.
- **Decorative** is visual-only and ignores learner focus.
- **Hide on hover** becomes pointer-transparent while hovered so underlying
  MapAssets can be selected. It remains hidden while an overlapping underlying
  MapAsset stays focused.
- **Toggle state** switches between two configured images when clicked. Each
  state has its own image, X/Y position and size.

### Search And Bookmarks

Map search runs on the server and can find accessible MapAssets on other maps.
Search results navigate to the matching map and focusable place.

Learners can bookmark focusable MapAssets. Bookmarks appear on a personal map
and link back to the original learning place.

The learning desk separates unfinished route progress from recent completed
traces. When the same route has both an active run and an older completion, it
appears only under Continue learning so the desk keeps one clear next step.
Current and recent route rows also retain their authored learning-area links,
so the desk can lead directly to the corresponding competence reading without
adding a separate progression panel.

### Activities And Routes

A focusable MapAsset can expose several route starts. Activities play on a
dedicated page and are connected through a graph rather than a fixed linear
course sequence. Backend route progress preserves the current run and activity
across refreshes; learners can restart or reset routes according to the authored
rules.

The Paths directory shows each route's authored learning areas and links those
areas to the focused competence reading. The route remains a suggested way in,
not a required sequence.

Implemented activity types are:

- dialogue and graph-based NPC dialogue
- questions with correctness and outcome branches
- reflection
- Markdown page graphs
- shared tasks
- learner message prompts and message walls
- tool grants and item grants
- tool obstacles and item-slot obstacles
- portals
- open practice pauses for learner-directed next steps, with an author-written
  invitation shown before the learner continues

Activity authors can optionally add feedback guidance for any activity: its
purpose, what to notice in a learner response or action, and one possible next
action. Playback presents this as a compact orientation aid, and the scoped AI
activity review inspects the guidance for clarity. It is not a score or a
learner assessment.

Every activity type can reference optional reusable ambience. More specialized
types can add their own interaction sounds and visuals.

### Learner Messages

A message-prompt Activity collects at most one short contribution from a learner
for a MapAsset-scoped topic. A message-wall Activity displays the latest visible
contributions as dismissible cards during activity playback. Learners do not see
other messages until they reach the authored wall.

Authorized staff can review messages grouped by MapAsset and topic, see author
attribution, hide inappropriate entries and permanently delete them when their
permission level allows it.

### Journal, Competence And Collaboration

The learner journal is a private Markdown workspace with custom pages,
reflection-created pages, search, writing/rendered modes, autosaved drafts and
export. The shared Journal action opens it as a focused overlay; `/journal` is a
deep link that redirects to the learning desk with the overlay open, while
`/learning/journal` is its lazy-loading JSON endpoint. Learners can explicitly
request feedback for one page from an eligible journal, group or organization
domain; journals are not a general staff-reading surface.

Recent journal check-ins retain their related learning areas. Each area can
open its focused competence-map reading, while the activity itself remains a
separate route back to the learning place.

After completing an activity, a learner may optionally choose a private next
direction: return to that place, look for something related, or let it settle.
The direction is saved with the check-in and shown later in the Journal and
competence pulse as orientation, without deadlines or a progress score.
Authors can optionally add a short context sentence explaining why one of these
directions may be useful after a particular activity. The choice set remains
bounded and optional.

When the learner chose `Return to this place`, the Journal can surface the
activity again after a short spacing window. The learner can open it, choose
`Later` to defer it, or choose `Hide` to remove the invitation. This is a quiet
return surface rather than a notification or required task queue.

Topic pages can also show a short private trail of recent learning-pulse
reflections connected to that topic. Each entry links back to the activity and
its map place.

Activities can contribute weighted competence topics. Learners see a
qualitative competence map, topic trails and bounded linked learning moments,
while authorized support staff receive scoped signals for orientation and
support conversations rather than ranking.

Published topic pages also show the authored learning areas woven through their
accessible map activities, with links into the corresponding focused
competence-map reading. Those links retain the originating topic as a return
path even when the competence area is not itself a formal topic.
When connected competence areas have evidence, the topic page keeps their
description and evidence vocabulary in that same compact link rather than
repeating a second list of the same areas. Separate links remain available when
a competence area also relates to another published topic.

The demo learning world uses the same two competence topics across its dialogue,
question, review, obstacle and field-note activities. This keeps the example
world inspectable end to end: different kinds of participation can leave
different evidence types without introducing a separate progression system.

Organizations, learning groups, group chat and shared-task activities form an
early collaboration slice. Their purpose is contribution and coordination, not
public scoring.

### Tools, Items And Portals

Tools are reusable learner capabilities. They can be granted by activities or
NPC dialogue, equipped from the learner controls, used in obstacles, reveal
hidden MapAssets and satisfy configured unlock rules.

The demo Pattern lens includes separate dark and light SVG visuals so a seeded
tool is immediately visible wherever learners acquire or equip it.

Items are consumable inventory objects used by item-grant and item-obstacle
activities. Probability rolls and inventory mutations happen on the backend so
browser replay cannot mint repeated grants inside one route run.

Portal activities connect MapAssets and maps. Entry portals own the destination;
exit portals receive the learner and can show or skip an arrival scene. Portal
visuals support reusable backgrounds, foregrounds, animated loops and optional
click-to-enter behavior.

## Administration

### Settings Workspace

Personal and administrative settings share a multi-level, full-height workspace.
Administrative areas are visible according to configurable resource permissions:

- Learning Support
- World Builder
- Assets & World Objects
- Access management
- AI & Integrations
- Translations
- Color palettes
- Public pages
- API

Settings colors, inputs, navigation states, journal presentation and map visual
palettes are database-backed instead of being fixed to one deployment theme.

### Access Management

Admins can manage users, registration tokens, roles, groups and account access.
Roles carry permission levels per resource:

- `No`: no access
- `RO`: read-only
- `RU`: read and update/create
- `RUD`: read, update/create and delete

The platform supports multiple assigned roles, configurable role definitions,
login disabling, temporary bans and account deletion. Map editing is additionally
scoped by map access.

### World Builder

World editing stays in Settings rather than being mixed into the learner map.
The World Builder provides:

- a world/map graph with portal relationships
- map creation and map configuration for details, visuals, access and deletion
- a full-size MapAsset surface with a floating Add MapAsset action
- the demo world seeds image-backed MapAssets on both connected maps so each
  surface is immediately discoverable; empty maps show how to add the first
  visual area
- center placement for new MapAssets and explicit X/Y/Z/size/opacity fields
- a map-level lock for MapAsset placement
- one MapAsset editor for surface, text, learner panel, activities, rules,
  visuals, sounds and deletion
- shared upload, download, select-existing and clear controls for images
- a live MapAsset preview using the learner renderer
- light/dark map palettes and previewable controls
- activity, NPC dialogue and Markdown graph editors

The activity graph also provides a local template action for eligible
activities. It opens an editable copy in the current MapAsset, generates a
fresh slug when saved and places the new activity in the AI review queue. This
is intentionally a local starting point; a shared cross-map template library
is not yet part of the prototype.

The World Builder graph surfaces the same review state on each map card. Maps
with waiting activity reviews link directly to the first affected node, so an
author can discover and enter the scoped review queue without opening maps one
by one.
World Builder also has a world-level Review queue section that gathers waiting
MapAssets across the current world, paginates them as the collection grows and
opens each item at its exact node editor. Review execution remains scoped to
one activity at a time; the list is an entry point rather than batch approval.
Review results can open the affected Activity editor directly, so content
suggestions and optional metadata suggestions can be considered in the same
scoped authoring flow.
If no activity-review helper is configured, the queue links to the template
editor with the activity-review purpose preselected.
The queue only offers that setup link to accounts with AI update permission;
activity-edit access alone cannot invoke a review request.

Selecting a MapAsset opens its editor directly. Admins do not create or link a
separate LearningNode; the backend creates the internal compatibility record as
part of the MapAsset operation.

### Reusable Assets And Presentation

Admins can manage reusable images, animations, sounds, tools, items and cursor
images. Image inputs reuse existing media paths instead of forcing duplicate
uploads. Sound records include category, icon, volume, looping and optional
duration metadata, and the browser player supports concurrent sound layers.

The reusable visual library shows where each image is currently referenced
before an author replaces or deletes it. Replacing an image updates those
references together; deleting it clears them explicitly after confirmation.

Public pages, auth backgrounds, information pages, source links, platform
languages and translation catalogs are configurable. Cursor roles currently
cover normal, action, grab, text and denied states.

### AI And Content Authoring

Admins can store encrypted provider credentials and reusable agent templates,
including a `content_authoring` purpose. Provider requests use a Responses-style
API client with timeouts, bounded retries for transient failures, sanitized
error messages, request identifiers and model-aware generation controls.

From a map's MapAsset surface, an admin can ask an enabled content-authoring
template for a draft. The brief contains a learning goal, optional audience and
prior knowledge, route length and allowed Activity types. The AI returns a
versioned structured ContentPlan. Nothing is created until the admin reviews the
MapAsset, linear route, warnings and token usage and explicitly applies it.

The authoring slice creates one focusable MapAsset at the map center and one to
three selected Markdown, Reflection, Message prompt, Shared task or Open
practice Activities. Applying the draft revalidates the plan and writes the
MapAsset, Activities, route start and transitions in one database transaction.
The draft can be edited before approval; saving the edits runs the same contract
and semantic validation as generation and application.
See [AI-assisted authoring](ai-authoring.md).

### Content API

The permission-controlled Content API exposes a versioned machine contract plus
operations to list and create maps, MapAssets and Activities. Settings contains
an interactive console and a readable contract view. Requests currently use the
signed-in administrator session and CSRF protection; this is an administration
API, not a public token API. See [Content API](content-api.md).

## Intentional Non-goals

The prototype deliberately avoids global point totals, streak pressure,
leaderboards and reward loops that make the reward more important than learning.
It can still be playful and game-like, but interaction should support autonomy,
curiosity, competence and relatedness.
