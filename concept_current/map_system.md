# Map System

The map is a spatial representation of knowledge, not a course list.

Current behavior:

- A map has hex tiles.
- Each node uses axial `q` and `r` coordinates.
- Unused tiles are not rendered.
- The map can be dragged with the pointer.
- Each tile has configurable colors, icon, label and highlight color.
- Locked and hinted states are represented visually but not yet resolved through rules.

Rendering note:

The hover edge effect is handled by CSS on the tile overlay layer. React does not store hover state, so moving the pointer across the map does not trigger a React state update for each tile hover.
