# Codex Conversation: Learning Platform Continued

- Project: `D:\Repositories\learning`
- Conversation date requested by WickedJack99: `2026-07-06`
- Created in Codex on environment date: `2026-07-07`
- Export note: this is a condensed conversation record. Hidden system/developer instructions, shell output, and repetitive tool-check details are intentionally omitted.

## 1. Route Cards And Activity Routes

WickedJack99 wanted activity route options in the node detail panel to feel more visual and less like plain buttons. The route image should sit under the start button, then the design was refined so the image and button behave as one clickable card.

Implemented direction:

- Start edges in the activity graph can store dark/light route images.
- Clicking a Start edge opens route visual settings instead of immediately deleting the edge.
- The route visual dialog supports upload and download for route images.
- The learner node panel renders image routes as clickable cards with the start action layered over the image.
- Route image cards lift on hover.
- If no image is configured, the route still renders as a compact button.
- Plain route buttons were made theme-aware so dark mode does not show bright white buttons.

Several visual refinements followed:

- Removed image zoom on hover.
- Removed card shadow.
- Changed overlay button alignment and rounded corners.
- Adjusted SVG route example backgrounds to avoid mismatched inner and outer corner radii.
- Switched card frame drawing from normal borders to inset shadow to reduce dirty antialiasing around rounded corners.
- Increased frame thickness from `1px` to `2px`, which WickedJack99 considered better and good enough.

## 2. Route Styling Persistence

WickedJack99 asked for configurable border and button colors on Start edges, with four color fields:

- Dark button color
- Dark border/frame color
- Light button color
- Light border/frame color

Implemented direction:

- Added persistent columns on `learning_activity_starts`.
- Added color pickers and text inputs in the Start edge route visual dialog.
- Put the image and color controls into accordion sections.
- Applied colors to image-card route overlays and to no-image route buttons.
- Applied border/frame color to the whole route card, not only the overlay button.

## 3. Entry And Exit Portal Cleanup

WickedJack99 noticed Exit portal activities could appear as route start buttons even though they cannot be wired from Start and therefore cannot be configured through Start edge settings.

Implemented direction:

- Exit portal activities are filtered out of learner route-start buttons.
- The backend rejects attempts to wire an Exit portal from the Start node.
- Stale database rows for Exit portal starts are ignored during serialization.
- Tests cover that Exit portal starts do not leak into route options.

Current portal vocabulary:

- Entry portal: sends the learner to another node/map and must end a route path.
- Exit portal: receives learner travel and is not shown as a normal start route button.

## 4. Bookmark Map Button Theme Fix

WickedJack99 found the `Go to node` button on the bookmark map too bright in dark mode and suspected the inverse problem in light mode.

Implemented direction:

- The bookmark map `Go to node` button is now explicitly theme-aware.
- Dark mode uses a dark background and white text.
- Light mode uses a light background and dark text.

## 5. Admin World Editor UI Restructure

WickedJack99 asked for the add/edit node overlay in the world editor to use accordion sections and to move `Edit activities` to the top.

Implemented direction:

- The node create/edit dialog was restructured into accordion sections:
  - Activities, visible only for existing nodes and open at the top.
  - Basics.
  - Tile display.
  - Dark mode visuals.
  - Light mode visuals.
- Fallback color/image sections were later removed as the visual model changed.
- Color inputs in node create/edit now have color pickers next to text inputs.

## 6. Node Images And Visual Model Correction

WickedJack99 clarified that uploaded node images should not be treated as fallback images. They should be the main tile visuals, with separate dark and light variants. The earlier `icon key` model was an early prototype idea and should only remain as a fallback.

Implemented direction:

- Added demo SVG node images:
  - Signal Gate
  - Field Notes
  - Quiet Archive
  - Portal Gate
- Added dark and light variants under `public/images/nodes`.
- Wired demo seed data to use `visual_config.dark.imageUrl` and `visual_config.light.imageUrl`.
- Added a migration to apply demo node images to existing local data.
- Added a migration to move old fallback visual values into `visual_config.dark`.
- Removed fallback image from the admin node editor.
- Removed fallback color controls from the admin node editor.
- Removed editable icon key from the node editor.
- New nodes receive default dark/light color sets.
- The world map renderer still falls back to the icon if the configured image fails to load.

After DevTools showed the configured image existed but rendered as `0 x 0`, the image element was given explicit dimensions. Then WickedJack99 clarified the long-term goal: tile images should not be small symbols but full node/landscape artwork.

Implemented direction:

- Node images now render as full hex-tile artwork.
- Images are clipped to the hex shape and use `object-cover`.
- Labels and completion marks remain layered above.
- The admin map editor preview was updated to match the learner map.

## 7. Hide Node Image Toggle

WickedJack99 asked for a toggle to hide or display a node image.

Implemented direction:

- Added `visual_config.hideImage`.
- Added a `Hide node image on world map` checkbox in the node editor.
- Validated and persisted the field through Laravel.
- The learner map and admin map editor preview both respect it.
- The uploaded dark/light image paths remain saved; hiding only changes display behavior.
- When hidden, the tile uses the fallback icon.

## 8. Concept Updates

WickedJack99 asked to update the current concepts if they were not already updated today.

Updated concept files:

- `concept_current/activity_system.md`
- `concept_current/map_system.md`
- `concept_current/theme_system.md`
- `concept_current/discarded_or_changed_ideas.md`

Concept changes captured:

- Multiple route starts from the Start node.
- Route cards with images and configurable dark/light overlay colors.
- Portal links configured on portal activities.
- Entry/Exit portal naming and constraints.
- Activity playback moved out of the map side panel.
- Node images as full-tile dark/light artwork.
- Removal of fallback image/color editing.
- Bookmark map and server-side map/node search.
- Accordion-based admin tile editing.

## 9. Current Direction After This Session

The platform prototype now treats the world map as a configurable visual learning space:

- Maps can contain full-art hex nodes.
- Node visuals are theme-specific.
- Activities inside a node are graph-based and can expose multiple learner routes.
- Portal travel is modeled through portal activities.
- Admin editing is kept outside the learner map.
- The UI is steadily moving away from prototype controls and toward domain-configurable content.

The major remaining design direction is to make node artwork more ergonomic for real landscape composition, for example crop/position controls and better previews for how adjacent node images visually relate.
