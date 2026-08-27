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

| Area | Checked behavior | Result |
| --- | --- | --- |
| Learning desk | Search, recent traces, continue learning, possible connections, bookmarks aside | Working; possible connections is present below the initial content on the current desktop layout |
| Paths | Route cards and entry links | Working |
| Topics | Topic directory, areas, topic links and admin link where available | Working |
| Topic detail | Competence link, learning areas, routes, maps and subtopics | Working; the page is a vertically scrollable document, so lower cards are not a clipping defect |
| Bookmarks | Shared surface header, selected place and bookmark links | Working |
| Competence | Star-map empty state, topic return, learning pulse | Working at the checked desktop state |
| Map | Map selection, asset focus panel, activity links, surface navigation | Working at the checked desktop state |
| Activity | Shared header, map/bookmarks/learning-desk links, activity player and “From beginning” action | Working |
| Journal | Header action opens the journal dialog, page search/list/edit/save/delete controls and export link | Working; this is intentionally a dialog interaction from the learning desk, while a standalone journal route also exists |
| AI review | World Builder shows a scoped review queue and links to the review-helper configuration | Working and discoverable |
| Seeded media | Pattern Lens has dark and light tool images and reusable-image selection controls | Working |
| Scrollbars | Scrollable areas do not render browser up/down arrow buttons | Working; this is already implemented in the shared stylesheet |
| Settings shell | Settings search, categories, quick links to Learning desk/Map/Bookmarks, account controls | Working |
| Settings categories | Personal, Learning Support, World Builder, Assets & World Objects, Access, AI, Translations, Color palettes, Public pages and API all open their current panels | Working in the smoke pass |

## Navigation findings

### P1 — Give standalone community pages the same navigation contract

`/organizations` currently renders its own page without the shared learner
header. It has no direct Learning desk, Topics, Paths, Map, Bookmarks or
account navigation. The organization detail page has an internal
“Organizations” return link and a settings-like two-pane layout, but it also
does not provide the shared learner shell. The map can open organizations from
an action surface, so a learner can enter a separate navigation world without
an obvious way back to the main learning context.

The `/learning/groups` page could not be runtime-verified in this browser
because the browser blocked that URL with `ERR_BLOCKED_BY_CLIENT`; this is an
environment limitation, not evidence that the route is broken. Its source
usage from map controls still makes it part of this navigation decision.

**Decision to make:** either put community pages inside the shared learner
surface, or make them an explicit overlay/workspace with a consistent close or
return action. Do not leave a third navigation shell implicit.

**Acceptance criteria:** entering and leaving an organization or group always
offers an obvious return to the learner context; the same account controls and
responsive header rules apply; direct links remain usable without first
entering a map.

### P1 — Replace the stale map bottom-navigation authoring concept

The current map and bookmark surfaces use the shared top navigation. However,
map configuration still exposes **Bottom nav** with the description “The
floating primary navigation at the bottom,” plus bottom-nav preview controls,
validation fields, map theme fields and CSS variables. This is a live authoring
surface for a navigation model learners no longer see.

Because the project is still demo-only, compatibility with those obsolete
stored fields is not a reason to preserve them.

**Decision to make:** remove the obsolete fields and preview end-to-end, or
replace them with configuration for the actual shared top surface. Do not
rename the preview while keeping controls that do not affect the learner UI.

**Acceptance criteria:** every navigation color control shown to an author
styles a currently rendered surface; no “bottom nav” terminology remains in
current code, validation, or current concept documentation; portal travel
remains an optional exploration connection and is not treated as the only way
to reach a map.

### P1 — Define one surface-frame ownership rule

The learner shell now has a shared header, maps add map controls and a focus
panel, activities add player controls, and Journal opens as a dialog from the
header while also having a route. These choices can work, but their ownership
is not yet expressed as one rule. The result is a higher risk of future nested
headers, duplicate return actions, or controls being hidden behind another
surface.

**Acceptance criteria:** each learner page documents which layer owns global
navigation, which layer owns context return, and which layer owns the current
task action. A browser smoke test covers learning desk → topic → map → asset →
activity → return without relying on browser back.

### P2 — Decide whether admin topic management belongs in the learner shell

`/admin/topics` currently uses the learner header while settings and World
Builder use the settings administration shell. This is reachable, but it makes
the boundary between consuming learning content and authoring it unclear.

**Acceptance criteria:** admin pages share one intentional administration
entry/return pattern, or the learner shell explicitly labels and contains the
small admin feature.

## Layout and responsive findings

### P1 — Close the narrow focused-map overflow signal

The responsive pass at 1280×800 found five interactive elements extending
horizontally beyond the viewport and one clipped element on the focused map
surface. The desktop map looked contained, so this is a narrow-layout defect
or an untested breakpoint rather than a general map failure.

**Acceptance criteria:** at 1280×800 and a phone-width viewport, the focused
map has no horizontal overflow; the top navigation, map controls, search,
focus panel and activity action remain reachable; any intentionally scrollable
region scrolls on its own axis without moving controls off-screen.

### P2 — Add variable-length collection coverage

The current topic detail page scrolls correctly, and settings asset/palette
surfaces use intentional nested scrolling. The same containment contract still
needs explicit coverage for long lists and graphs: topic cards, bookmarks,
journal pages, AI review queues, graph nodes, map assets, reusable media, and
organization members/messages.

**Acceptance criteria:** seeded long-data browser checks assert no clipped
actions, no unreachable final item, and no page-wide horizontal overflow. The
scrollbar remains arrow-free and retains a visible thumb in both themes.

## Visual system and color findings

### P1 — Establish the learner color source of truth

Settings exposes separate public-text, settings-UI, journal and map-visual
palettes. The settings surface correctly receives its configured tokens, for
example `--settings-accent`, `--settings-panel-background` and
`--settings-muted-text`. The learner header and several learner pages still
use hard-coded slate, violet, cyan and dark background classes. Map surfaces
also combine world-specific colors with shared navigation styles.

This means an author can configure a palette and still see learner surfaces
that do not follow it. That is a system-boundary problem, not merely a color
preference.

**Decision to make:** give the learner shell explicit configurable tokens, or
state and enforce that learner navigation intentionally uses a fixed platform
palette while map content alone is world-themed. The choice must be visible in
the settings model and documentation.

### P1 — Review light-theme normal-text contrast

Using the current configured colors, representative contrast ratios are:

| Pair | Ratio | Reading |
| --- | ---: | --- |
| Dark heading `#f8fafc` on `#0b1117` | 18.13:1 | Strong |
| Dark muted `#94a3b8` on `#0b1117` | 7.40:1 | Strong |
| Dark accent `#2dd4bf` on `#0b1117` | 10.19:1 | Strong |
| Light muted `#64748b` on `#f1f5f9` | 4.34:1 | Below 4.5:1 for normal text |
| Light cyan `#0891b2` on `#f1f5f9` | 3.36:1 | Too weak for normal-size text |
| Light accent `#0f766e` on `#f1f5f9` | 5.00:1 | Passes normal-text AA threshold |

These are representative token checks, not a substitute for checking every
foreground/background pair after opacity and overlays are applied. The dark
theme has strong readability, but frequent saturated cyan/violet eyebrows,
thin borders and small uppercase labels can make dense pages feel visually
harsh even when their contrast is technically high.

**Acceptance criteria:** normal-size light-theme text meets WCAG AA contrast;
muted text is not used for essential instructions; focus, hover, selected and
disabled states are checked separately; visual review confirms that accent
color is reserved for orientation and action rather than every label.

### P2 — Reduce typography and accent competition on dense pages

The learner-facing three-font-size constraint is a good constraint and should
remain current. Hierarchy should come from weight, color, spacing, width and
containment. The next visual pass should also limit the number of simultaneous
accent treatments on Learning desk, topic detail and settings previews.

**Acceptance criteria:** edited learner pages use at most three font sizes,
section eyebrows do not compete with headings, and long helper copy is placed
near the control it explains instead of adding another visual layer.

## Functional coverage still needed

These are test gaps, not claims that the feature is broken:

- Search should be tested with empty, exact and no-result input, including the
  return path from a result.
- Topic → competence, topic → map, map → asset, asset → activity and activity
  completion should be covered as one uninterrupted flow.
- Bookmark add, remove and reopen should be covered from both map and activity
  contexts.
- Journal check-in creation, update, deletion, export, and the optional
  feedback request should be covered with both enabled and disabled feedback
  settings.
- World Builder should cover adding/editing/deleting an activity, opening the
  scoped AI review helper, changing an asset image, and saving a map visual.
- Long AI queues, media libraries, graph nodes, journal pages and organization
  conversations need browser assertions for the final visible action.
- Keyboard focus and accessible names should be checked for icon-only map
  controls, account controls, React Flow actions, image selectors and modal
  close buttons.

## Documentation maintenance rule

When a feature slice changes a learner concept or navigation surface, first
search `concept_current/` and the relevant UI/configuration code for the old
term. Update the current concept and backlog in the same change, and leave a
clearly marked historical document untouched only when it records a discarded
idea. This prevents a later autonomous slice from rebuilding an obsolete
bottom-navigation or map-entry-only model.

## Priority order for the next slices

1. Retire or replace bottom-navigation configuration and dead map theme tokens.
2. Fix focused-map narrow overflow and add long-collection containment checks.
3. Give community pages a deliberate shared navigation contract.
4. Decide and implement the learner palette source of truth, including light
   contrast corrections.
5. Add the end-to-end browser smoke flow and keyboard/accessibility checks.
