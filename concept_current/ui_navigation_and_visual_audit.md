# Current UI, Navigation And Visual Audit

**Audit date:** 2026-08-27
**Scope:** learner navigation, learning surfaces, maps and activities,
community pages, settings and authoring surfaces, responsive containment, and
the configured color system.

This is a current-state audit. It replaces assumptions from older prototype
reviews where the present implementation has already moved on. Historical
documents remain historical; the findings below are the actionable source for
future UI work.

## How this was checked

The route tree and shared React surfaces were inspected first, then the live
demo was exercised in the browser at the current desktop viewport and during a
narrow responsive pass. The checks covered the primary learner routes, the
map/activity flow, the journal interaction, settings categories and subpanels,
world-builder review entry points, asset management, and community entry
points. DOM reachability, visible headings, links, buttons, overflow, and
selected interactions were checked rather than relying only on source code.

This is a functional smoke audit, not a replacement for automated end-to-end
coverage. Items marked **not yet verified** are deliberately kept visible
instead of being presented as working.

## Confirmed working in the current demo

| Area                | Checked behavior                                                                                                                                                | Result                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Learning desk       | Search, recent traces, continue learning, possible connections, bookmarks aside                                                                                 | Working; possible connections is present below the initial content on the current desktop layout                     |
| Paths               | Route cards and entry links                                                                                                                                     | Working                                                                                                              |
| Topics              | Topic directory, areas, topic links and admin link where available                                                                                              | Working                                                                                                              |
| Topic detail        | Competence link, learning areas, routes, maps and subtopics                                                                                                     | Working; bounded Trail, Routes, Maps and Overview sections keep repeated choices paginated and reachable, and each section can be deep-linked and revisited with browser history |
| Bookmarks           | Shared surface header, selected place and bookmark links                                                                                                        | Working                                                                                                              |
| Competence          | Star-map empty state, topic return, learning pulse and star reading panel                                                                                       | Working; star activation is covered after correcting the payload-shape regression found in the 2026-08-27 pass       |
| Map                 | Map selection, asset focus panel, activity links, surface navigation                                                                                            | Working at the checked desktop state                                                                                 |
| Activity            | Shared header, map/bookmarks/learning-desk links, side context panel, activity player and “From beginning” action                                                | Working; topic, map, route and place context now sits beside the player instead of inside the global header             |
| Journal             | Top-right notes icon opens the journal dialog, page search/list/edit/save/delete controls and export link                                                        | Working; this is intentionally a utility interaction beside notifications, and `/journal` deep-links to that dialog |
| AI review           | World Builder shows a paginated world-level queue of pending activities, direct review-dialog links and the scoped review-helper configuration                    | Working and discoverable; each entry now opens its activity review directly                                                       |
| Seeded media        | Pattern Lens has dark and light tool images and reusable-image selection controls                                                                               | Working                                                                                                              |
| Scrollbars          | Scrollable areas do not render browser up/down arrow buttons                                                                                                    | Working; this is already implemented in the shared stylesheet                                                        |
| Settings shell      | Settings search, categories, quick links to Learning desk/Map/Bookmarks, account controls                                                                       | Working                                                                                                              |
| Settings categories | Personal, Learning Support, World Builder, Assets & World Objects, Access, AI, Translations, Color palettes, Public pages and API all open their current panels | Working in the smoke pass                                                                                            |

## Navigation findings

### Completed — Give standalone community pages the same navigation contract

`/organizations` and the organization detail page now use the shared learner
header. Organizations is a primary learner destination after Bookmarks, while
the map/player action rail is reserved for inventory and tools. The detail page
keeps its local “Organizations” return link and settings-like two-pane controls,
while the global header owns the return to the main learning surfaces and account
actions. This keeps community pages useful as a separate workspace without
creating a third navigation shell.

The `/learning/groups` page could not be runtime-verified in this browser
because the browser blocked that URL with `ERR_BLOCKED_BY_CLIENT`; this is an
environment limitation, not evidence that the route is broken. Its source
usage from map controls still makes it part of this navigation decision.

**Result:** entering and leaving an organization offers an obvious return to
the learner context, the same account controls and responsive header rules
apply, and direct links remain usable without first entering a map.

### Completed — Removed the stale map bottom-navigation authoring concept

The current map and bookmark surfaces use the shared top navigation. The stale
**Bottom nav** authoring section, preview controls, validation fields, map theme
fields and CSS variables have now been removed. The cleanup migration also
removes those keys from existing `learning_maps.background_config` values.

The remaining map visual controls now describe rendered surfaces such as the
map title panel, MapAsset side panel and right control. Portal travel remains
an optional exploration connection and is not treated as the only way to reach
a map.

The active translation catalog now names these shared destinations as
`navigation.primary.*` and activity return actions as
`navigation.activity.*`. The former `navigation.bottom.*` names are retained
only in historical migration and audit context, not in active learner code.

### P1 — Complete the surface-frame ownership contract

The learner shell now has a shared header, maps add map controls and a focus
panel, activities add player controls, and Journal opens as a dialog from the
top-right utility controls while also having a route. These choices can work,
but their ownership must stay explicit to avoid future nested headers,
duplicate return actions, or controls being hidden behind another surface.

The desk, Topics, Paths, topic administration and organizations directory now
use `LearnerDocumentSurface`. That shared component owns the global learner
header and the fixed-frame document scrolling contract. Maps, activities,
settings and the organization workspace remain specialized because their
controls need different fixed-space ownership.

**Acceptance criteria:** each learner page documents which layer owns global
navigation, which layer owns context return, and which layer owns the current
task action. The remaining gap is a browser smoke test covering learning desk →
topic → map → asset → activity → return without relying on browser back.

### P2 — Decide whether admin topic management belongs in the learner shell

`/admin/topics` currently uses the learner header while settings and World
Builder use the settings administration shell. This is reachable, but it makes
the boundary between consuming learning content and authoring it unclear.

**Acceptance criteria:** admin pages share one intentional administration
entry/return pattern, or the learner shell explicitly labels and contains the
small admin feature.

## Layout and responsive findings

### Updated — Close the narrow focused-map overflow signal

The current responsive pass no longer reproduces the earlier 1280×800
overflow signal: the document and interactive map surface remain inside the
viewport. At phone width, the learner header intentionally scrolls its nav
items on its own horizontal axis; the map, focus panel, search and activity
actions remain contained and reachable. This should be protected by an
automated browser assertion rather than repeatedly treated as a new layout
fix.

The shared header only shows **Continue activity** when the persisted learner
context contains a playable activity URL. A stale context may still provide a
map location, but that location belongs to **Current map** and is not presented
as a false activity continuation.

**Acceptance criteria:** at 1280×800 and a phone-width viewport, the focused
map has no horizontal overflow; the top navigation, map controls, search,
focus panel and activity action remain reachable; any intentionally scrollable
region scrolls on its own axis without moving controls off-screen.

### P2 — Add variable-length collection coverage

Settings asset/palette surfaces use intentional nested scrolling. The same
containment contract still needs explicit coverage for long lists and graphs:
topic cards, bookmarks, journal pages, AI review queues, graph nodes, map
assets, reusable media, and organization members/messages.

Learner document pages now share a `.learner-scroll-pane` contract that keeps
the page inside the fixed app frame, reserves scrollbar space, prevents
horizontal spill, and contains vertical overscroll. Map and settings panes
remain explicitly nested because their controls and actions have different
fixed-layout ownership.

The topic-detail feature contract also now verifies that maps, routes and
subtopics are delivered as complete collections for the client-side pagination
controls, rather than being truncated to the first visible page.

Variable-length learner-owned lists now also use a `.learner-scroll-region`
contract for nested panels. Bookmarked places, Journal pages and organization
messages keep their own vertical scroll region, reserve scrollbar space and
clip horizontal spill without moving neighboring controls when the list grows.

**Acceptance criteria:** seeded long-data browser checks assert no clipped
actions, no unreachable final item, and no page-wide horizontal overflow. The
scrollbar remains arrow-free and retains a visible thumb in both themes.

### Current constraint — Prefer bounded topic workspaces and pagination

Learner pages should use the available viewport deliberately: reserve space for
the global header, keep the page frame bounded, and avoid making the entire
surface a scroll pane merely because a collection can grow. Topic details now
use a compact section bar for Trail, Routes, Maps and Overview. Long repeated
collections on those sections use previous/next pagination; the active section
may still scroll internally when authored prose or a single complex panel is
longer than the available space.

Use pagination when the learner is comparing or choosing a bounded set of
repeated items. Use an internal scroll region when continuity matters, such as
reading authored content, viewing a journal, or inspecting a graph. Every new
surface should make that choice explicit and retain keyboard-reachable controls.

### Completed — Keep learner document pages inside the app frame

The fixed application frame now gives its page outlet an explicit flex-column
contract. This allows `.learner-scroll-pane` to receive the available height
and own vertical scrolling on Topics, topic detail, Paths and the other learner
document pages. It also keeps the page background continuous instead of exposing
the outer shell background below short content.

The competence reader now follows the actual map payload contract: evidence
ledger entries, evidence kinds and learning periods are read from the visual
description object that supplies them. Activating a star therefore opens the
reading panel without unmounting the page.

### Completed — Keep player overlays keyboard reachable

The inventory and tools panels are modal surfaces rather than visually
detached popovers: they expose their dialog relationship to assistive
technology, focus their close action when opened, and return focus to the
activating action-bar control when closed. Escape and outside-click dismissal
use the same return path. The journal overlay already follows this contract by
focusing its search field on open and restoring the previous control on close.

**Result:** `/topics` has one continuous learner surface, topic detail can
reach all variable-length sections, and activating a competence star keeps the
map and its reading panel visible.

## Visual system and color findings

### Completed — Establish the learner color source of truth

Settings now exposes a separate Learner UI palette alongside public text,
settings UI, journal and map-visual palettes. The app shell resolves the
learner palette into semantic `--learner-*` tokens, and shared navigation,
account controls, headings and the main learner page surfaces consume those
tokens. Map surfaces continue to resolve their own world-specific visuals.

This makes the boundary explicit: learner-shell presentation is configurable
at the platform level, while map content can retain its own visual identity.
The palette editor also previews the learner shell separately, so changes are
not hidden inside the public-page or map sections.

**Result:** the learner shell uses explicit configurable tokens. The current
defaults preserve the established dark/light visual language, with readable
body and muted text values and separate orientation/action accents.

The Color palettes menu now starts with a dedicated Readability section. The
learner color editor contains only editable learner tokens, while the
readability section owns the advisory text and focus-pair checks for the
selected appearance mode beside the same representative learner preview.

### Completed — Review light-theme normal-text contrast in context

Using the current configured colors, representative contrast ratios are:

| Pair                                |   Ratio | Reading                         |
| ----------------------------------- | ------: | ------------------------------- |
| Dark heading `#f8fafc` on `#08111b` | 18.14:1 | Strong                          |
| Dark muted `#94a3b8` on `#08111b`   |  7.40:1 | Strong                          |
| Dark action `#5eead4` on `#111820`  | 12.08:1 | Strong                          |
| Light muted `#475569` on `#f8fafc`  |  7.24:1 | Passes normal-text AA threshold |
| Light action `#0e7490` on `#ffffff` |  5.36:1 | Passes normal-text AA threshold |
| Light action `#0e7490` on `#f8fafc` |  5.12:1 | Passes normal-text AA threshold |

These are representative token checks, not a substitute for checking every
foreground/background pair after opacity and overlays are applied. The current
defaults have strong readability in both themes. Frequent saturated
cyan/violet eyebrows, thin borders and small uppercase labels can still make
dense pages feel visually harsh even when their contrast is technically high.

The Readability section shows representative text/background pairs for the
selected appearance mode, including the effect of configured opacity. It checks
normal text at 4.5:1 and focus indicators at 3:1 across the page, panel and
header pairings used by shared navigation. Decorative boundaries are shown as
informational because the design intentionally keeps separators soft. Disabled
controls remain intentionally subdued and are not treated as a place for
essential content.
The check is advisory rather than a hard save block: custom visual identities
remain possible, while weak combinations are made visible at the point where
they are configured.

### Completed — Apply learner interaction tokens across document pages

Learning desk, topic directory/detail, paths and organizations now use the
semantic learner palette for their action links, hover states, focus states
and selected presentation. This keeps learner navigation and document
surfaces coherent when a palette is changed in settings. Map-owned imagery
and competence-star effects remain separate because they describe the world
and learning trail, not the document shell.

### Completed — Apply learner palette tokens across the learning desk

The shared Learning desk now uses configured learner border, panel, heading,
body and muted-text tokens for its document surfaces. Its custom learner
palette therefore affects the desk consistently instead of leaving secondary
copy and separators on fixed slate values. The desk content hierarchy and
three-font-size constraint remain unchanged.

### Completed — Apply learner palette tokens across topic surfaces

The Topics directory and topic detail now use the configured learner tokens
for secondary text, body text, borders, dividers, panels and hover surfaces.
This keeps the route from the learning desk into learning areas, maps and
competence context visually coherent when a deployment changes its learner
palette.

### Completed — Apply learner palette tokens across paths

The Paths directory and route cards now use learner-configured colors for
secondary and body copy, headings, borders, dividers, panels and hover states.
This keeps direct route discovery aligned with the same visual system as the
learning desk and topic pages.

### Completed — Keep the playable activity shell coherent

The shared activity frame now uses the learner palette for its panel, activity
context, related learning-area links and restart control. The post-activity
check-in uses the same tokens for its prompt, connected-area links, note field
and feeling choices. Activity-specific scene treatments remain local to their
activity type, while the shared frame owns the learner-facing structure.

The centered activity header now also names the active authored route when a
route is in progress, keeping topic, map, route and node context together
without adding another navigation bar.

### Completed — Label icon-only activity controls

Previous/next controls in markdown pages and NPC dialogue
now expose explicit accessible names. The group-message send control follows
the same rule. Remaining keyboard review is limited to map controls, settings
authoring widgets and other complex surfaces listed below.

### Completed — Announce the active learner destination

The shared learner header now exposes `aria-current="page"` on the active
destination links. The selected underline and color remain the visual cue, but
assistive technology can now identify the current learning surface on the desk,
Topics, Paths, competence map and map/bookmark navigation without relying on
visual styling.

The primary learner route contract is also covered by feature tests for the
desk, Paths, Topics, competence, bookmarks and a published topic detail. These
tests do not replace browser verification of layout or interaction, but they
prevent a page from silently losing its authenticated route or Inertia
component while the learner navigation is being extended.

### Completed — Separate highlighted and selected competence stars

Competence stars keep their hover and focus highlight for visual orientation,
but `aria-pressed` now reflects only an intentional selection. Assistive
technology therefore does not hear a transient pointer hover as if the learner
had selected and opened that competence reading.

### Completed — Reserve source-control clearance on the competence map

The competence map and learning-pulse panels now stop above the fixed
source-code control, so the control remains in its existing position without
covering either panel. The map guide uses a stable right-aligned wrapper, so
opening its explanation expands the reading panel without moving the trigger.

### Completed — Make interactive map assets reachable

Interactive MapAssets now receive pointer input as well as keyboard input;
decorative assets remain non-interactive. Toggle assets also expose their
current pressed state to assistive technology, and interactive assets retain a
visible map-specific focus ring.

### Completed — Make World Builder visual controls semantic

World Builder section switchers now expose their selected state when they are
used as tabs. The map-asset visual preview is announced as an image preview
while remaining keyboard-reachable for its hover treatment, and reusable image
choices expose which image is selected. Existing settings panes continue to
own scrolling so these controls remain reachable in long editors.

### Completed — Make activity-graph connections keyboard actionable

Activity-graph nodes and connections now expose meaningful accessible names.
When a focused connection receives Enter or Space, the existing connection
editor opens just as it does for a pointer click. Start-route connections open
their route editor; activity transitions open their label editor. This keeps
the graph's visual editing model intact while making its highest-value actions
available without a pointer.

### Completed — Describe transient learner panels

The map action rail now exposes the expanded state and controlled panel for
inventory and tools. Journal is owned by the shared top-right utility controls,
so it is not duplicated in the map rail. Escape closes an open transient panel,
and the inventory list uses the shared learner scroll-region contract so a
growing collection does not push its controls out of reach. A broader keyboard
pass for settings authoring and complex graph controls remains separate.

### Completed — Review light-theme normal-text contrast in context

The learner palette editor now checks normal text at 4.5:1 and focus
indicators at 3:1 across page, panel and header pairings. Action accents are
checked on each surface where shared navigation and learner actions use them.
The default light palette passes those normal-text checks; custom palettes keep
an advisory warning when a pairing needs review. Accent competition and
decorative boundaries remain visual design considerations rather than save
blocking rules.

### P2 — Reduce typography and accent competition on dense pages

The learner-facing three-font-size constraint is a good constraint and should
remain current. Hierarchy should come from weight, color, spacing, width and
containment. The next visual pass should also limit the number of simultaneous
accent treatments on Learning desk, topic detail and settings previews.

**Acceptance criteria:** edited learner pages use at most three font sizes,
section eyebrows do not compete with headings, and long helper copy is placed
near the control it explains instead of adding another visual layer.

The shared activity surface now keeps its alternate no-activity state and route
progress metadata inside the same three-size hierarchy as the normal player.
The live seeded activity already rendered at three sizes; this also prevents a
different data state from introducing a fourth heading size.

The map/player action rail is a labelled control group rather than a navigation
landmark. Its buttons remain individually named and the learner link navigation
keeps the only navigation landmark for that header.

The shared learner pagination control now bounds both topic-directory areas and
the topics inside each area. Topic detail uses the same control, so growing
collections have an explicit next/previous path instead of pushing the page
past the intended surface height.

The standalone Paths directory now follows the same rule, showing six route
cards per page while preserving every server-provided route for navigation.
The Paths feature test now protects that contract with seven accessible routes,
including the final route that must remain available to the client pager.

The Color palettes workbench now paginates three color fields at a time in its
left editor and leaves only the preview surface independently scrollable. This
keeps the editor controls and pager within the visible workbench area without
changing the preview's continuous inspection behavior.

The reusable media library applies the same distinction: its searchable visual
chooser shows four assets per page, while the selected asset's detail surface
remains continuous. Searching resets the chooser to its first page so a filter
cannot leave the editor on an empty later page; a search with no matches now
states that directly in the chooser.

### Completed — Protect the learner journey link contract

The feature suite now covers the connected route contract from a published
topic through its competence context, assigned map, focused MapAsset and
playable activity. It also verifies that the activity retains the topic and
map context needed for its return navigation. This protects server-side
destinations from drifting apart; the browser still needs a separate smoke
check for actual clicks, rendering and completion behavior.

The shared activity shell also exposes the current place bookmark action for
authenticated learners. The action uses the same bookmark endpoints as the
map, reports its pressed state and remains available across activity types.

Map search now handles the same published topic, map and place result contract
as the learning desk search. Topic results open their topic page directly,
while map and place results retain their map focus behavior. Matching is
case-insensitive across PostgreSQL and the test database, and the empty and
no-result states use the current topic-aware wording.

### Completed — Keep topic competence context concise

Topic pages now avoid listing the same competence area twice when it is both an
observed learning trail and an authored practice opportunity. The competence
summary still links to the focused reading, while the practice section remains
the single place to choose an area to explore. The competence-map reading guide
is an explicit button with an expandable, scroll-contained explanation instead
of relying on native disclosure styling. The topic trail summary also avoids a
standalone decorative glow, keeping the content aligned with the bounded card.

### Completed — Make topic sections keyboard navigable

The bounded topic workspace exposes Trail, Routes, Maps and Overview as a
single keyboard tablist. The active tab is the only tab stop, and Arrow keys,
Home and End move focus while switching the visible section. This keeps local
navigation efficient without requiring a learner to tab through every section
before reaching its content.

### Completed — Keep activity review reachable from editing

When an activity-review helper is configured, the activity editor now offers a
direct “Review with AI” action beside its save controls. The action closes the
editor before opening the scoped review dialog and is disabled while the draft
has unsaved changes, preserving the distinction between the saved activity and
the tutor's current draft.

### Completed — Keep the scoped review queue continuous

After a review result is available, the dialog offers the next pending activity
from the selected node. This keeps the review work inside the existing scoped
authoring flow instead of requiring the tutor to close the dialog and search the
graph again.

## Functional coverage still needed

These are test gaps, not claims that the feature is broken:

- Search empty, lowercase exact, no-result and topic-result return behavior is
  covered by the current browser smoke pass; backend result filtering remains
  covered by `DashboardTest`.
- Topic → competence, topic → map, map → asset and asset → activity link
  contracts are covered by `LearningTopicsTest`; the bounded topic sections
  still need one uninterrupted browser flow through activity completion.
- Bookmark add, remove and reopen is now covered through the map endpoint,
  activity shell and bookmark surface, including retained map-asset and topic
  context. A browser check still covers the same lifecycle from an
  activity-originated entry.
- Journal check-in creation, update, deletion, export, and the optional
  feedback request should be covered with both enabled and disabled feedback
  settings.
- World Builder should cover adding/editing/deleting an activity, opening and
  moving through the scoped AI review queue, changing an asset image, and
  saving a map visual.
- Long AI queues, media libraries, graph nodes, journal pages and organization
  conversations need browser assertions for the final visible action.
- Keyboard focus and accessible names should be checked for icon-only map
  controls, account controls, image selectors and modal close buttons. Activity
  graph nodes and connections now have focused coverage in the implementation;
  a full browser pass still remains for the complete authoring workspace.

### Completed — Give keyboard users a direct route into learner workspaces

The shared learner header now exposes a visually hidden skip link that appears
when it receives keyboard focus. It moves focus to the page's main learner
workspace, so the header navigation does not have to be traversed on every
visit. Document pages, maps, bookmarks, competence, activities and the
organization workspace all provide the same target. Complex controls still
need their own keyboard pass; this change establishes the shared-shell entry
point without changing pointer navigation.

### Journal presentation

The Journal opens as a focused overlay from the notes icon in the shared
top-right learner controls. Its content, sidebar, inputs, selected page, and
action controls use the configurable journal theme for both appearance modes.
Hover surfaces now use the same configured surfaces as the rest of the
overlay, so a custom light or dark journal presentation does not fall back to
fixed slate/white colors.

The journal remains a private reflection workspace: the visual pass does not
change who can read pages, how feedback requests work, or how learning
observations are represented.

## Documentation maintenance rule

When a feature slice changes a learner concept or navigation surface, first
search `concept_current/` and the relevant UI/configuration code for the old
term. Update the current concept and backlog in the same change, and leave a
clearly marked historical document untouched only when it records a discarded
idea. This prevents a later autonomous slice from rebuilding an obsolete
bottom-navigation or map-entry-only model.

## Priority order for the next slices

1. Add long-collection containment checks and the end-to-end browser smoke
   flow.
2. Extend keyboard/accessibility checks to complex authoring controls after
   the shared learner-shell entry point is in place.
3. Reduce typography and accent competition on dense pages.
