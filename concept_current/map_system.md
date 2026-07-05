# Map System

The map is a spatial representation of knowledge, not a course list.

Current behavior:

- A map has hex tiles.
- Each node uses axial `q` and `r` coordinates.
- Unused tiles are not rendered.
- The map can be dragged with the pointer.
- Mobile dragging uses touch/pointer behavior instead of scroll.
- Each tile has configurable colors, icon, label and highlight color.
- Locked and hinted states are represented visually but not yet resolved through rules.
- Locked tiles show their locked state without hover lift/highlight behavior.
- Clicking a tile focuses its node and opens the node/activity panel.
- Clicking empty map space or closing the panel clears node focus and URL focus state.
- The active activity return button can navigate back to the related map and focus the related node.
- The top-left map panel describes the current map, not the selected node.
- The right-side detail panel describes the focused node and its activity.
- On mobile, the focused-node panel uses the full screen and can be closed explicitly.

Rendering note:

The hover edge effect is handled by CSS on the tile overlay layer. React does not store hover state, so moving the pointer across the map does not trigger a React state update for each tile hover.

The map component has been split into feature files under `resources/js/features/world` so theme resolution, active activity state, activity panels and map rendering can evolve separately.
