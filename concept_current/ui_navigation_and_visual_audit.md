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

| Area                | Checked behavior                                                                                                                                                | Result                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Learning desk       | Search, recent traces, continue learning, possible connections, bookmarks aside                                                                                 | Working; possible connections is present below the initial content on the current desktop layout                         |
| Paths               | Route cards and entry links                                                                                                                                     | Working                                                                                                                  |
| Topics              | Topic directory, areas, topic links and admin link where available                                                                                              | Working                                                                                                                  |
| Topic detail        | Competence link, learning areas, routes, maps and subtopics                                                                                                     | Working; the page is a vertically scrollable document, so lower cards are not a clipping defect                          |
| Bookmarks           | Shared surface header, selected place and bookmark links                                                                                                        | Working                                                                                                                  |
| Competence          | Star-map empty state, topic return, learning pulse                                                                                                              | Working at the checked desktop state                                                                                     |
| Map                 | Map selection, asset focus panel, activity links, surface navigation                                                                                            | Working at the checked desktop state                                                                                     |
| Activity            | Shared header, map/bookmarks/learning-desk links, activity player and “From beginning” action                                                                   | Working                                                                                                                  |
| Journal             | Header action opens the journal dialog, page search/list/edit/save/delete controls and export link                                                              | Working; this is intentionally a dialog interaction from the learning desk, while a standalone journal route also exists |
| AI review           | World Builder shows a scoped review queue and links to the review-helper configuration                                                                          | Working and discoverable                                                                                                 |
| Seeded media        | Pattern Lens has dark and light tool images and reusable-image selection controls                                                                               | Working                                                                                                                  |
| Scrollbars          | Scrollable areas do not render browser up/down arrow buttons                                                                                                    | Working; this is already implemented in the shared stylesheet                                                            |
| Settings shell      | Settings search, categories, quick links to Learning desk/Map/Bookmarks, account controls                                                                       | Working                                                                                                                  |
| Settings categories | Personal, Learning Support, World Builder, Assets & World Objects, Access, AI, Translations, Color palettes, Public pages and API all open their current panels | Working in the smoke pass                                                                                                |

## Navigation findings

### Completed — Give standalone community pages the same navigation contract

`/organizations` and the organization detail page now use the shared learner
header. The detail page keeps its local “Organizations” return link and
settings-like two-pane controls, while the global header owns the return to the
main learning surfaces and account actions. This keeps community pages useful
as a separate workspace without creating a third navigation shell.

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

### Updated — Close the narrow focused-map overflow signal

The current responsive pass no longer reproduces the earlier 1280×800
overflow signal: the document and interactive map surface remain inside the
viewport. At phone width, the learner header intentionally scrolls its nav
items on its own horizontal axis; the map, focus panel, search and activity
actions remain contained and reachable. This should be protected by an
automated browser assertion rather than repeatedly treated as a new layout
fix.

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

### P1 — Review light-theme normal-text contrast

Using the current configured colors, representative contrast ratios are:

| Pair                                |   Ratio | Reading                         |
| ----------------------------------- | ------: | ------------------------------- |
| Dark heading `#f8fafc` on `#0b1117` | 18.13:1 | Strong                          |
| Dark muted `#94a3b8` on `#0b1117`   |  7.40:1 | Strong                          |
| Dark accent `#2dd4bf` on `#0b1117`  | 10.19:1 | Strong                          |
| Light muted `#64748b` on `#f1f5f9`  |  4.34:1 | Below 4.5:1 for normal text     |
| Light cyan `#0891b2` on `#f1f5f9`   |  3.36:1 | Too weak for normal-size text   |
| Light accent `#0f766e` on `#f1f5f9` |  5.00:1 | Passes normal-text AA threshold |

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

1. Add long-collection containment checks and the end-to-end browser smoke
   flow.
2. Review custom learner palette values for light-theme contrast and accent
   competition.
3. Add keyboard/accessibility checks for the shared learner shell and complex
   authoring controls.
