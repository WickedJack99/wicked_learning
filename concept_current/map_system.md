# Map System

The map is a spatial representation of knowledge, not a course list.

Current behavior:

- A map has hex tiles.
- Each node uses axial `q` and `r` coordinates.
- Unused tiles are not rendered.
- The map can be dragged with the pointer.
- Mobile dragging uses touch/pointer behavior instead of scroll.
- Each tile has dark/light configurable colors, label, highlight color and tile image.
- Node images are intended to be full-tile artwork, not only small symbols. Later domains can use these images to form a landscape across the map.
- Generated source node/tile artwork should usually be square, high-detail, borderless scene imagery. The React hex tile component clips the image into the rendered hex shape, so future image generation should avoid baking a hex mask, border or rim into the source asset unless a standalone export explicitly needs that.
- Node images can be hidden without deleting the configured dark/light image paths.
- Tile labels can be hidden while still appearing in the side panel.
- Tile labels that are hidden in the normal image view still appear while hovered or selected, so image-first maps remain readable on intent.
- Locked nodes can be configured in the map editor. Locked tiles show their lock state without hover lift/highlight behavior.
- Completed nodes are dimmed rather than marked with a check badge on the tile image, keeping full-tile artwork cleaner.
- Hidden nodes can be revealed per learner by using the configured tool at the node position.
- Locked nodes can define unlock conditions from completed nodes, tool use or chained rules. Admins can reset per-user unlock state with `Lock for all users`.
- Clicking a tile focuses its node and opens the node/activity panel.
- Clicking empty map space or closing the panel clears node focus and URL focus state.
- The active activity return button can navigate back to the related map and focus the related node.
- The top-left map panel describes the current map, not the selected node.
- The right-side detail panel describes the focused node and shows available activity routes.
- The right-side detail panel can show completed state and bookmark controls without polluting the node tile artwork.
- The right-side detail panel does not play activities directly anymore; route playback happens on a separate page.
- On mobile, the focused-node panel uses the full screen and can be closed explicitly.
- Users can bookmark nodes. Bookmarked nodes appear on a personal bookmark map in a simple spiral layout. Selecting a bookmark opens the same node detail panel with a `Go to node` action.
- The map has server-side search. Results can include visible nodes from other maps and jump to the relevant map/node.
- Equipped tools can be used on the map. A successful configured tool use can reveal a hidden node; unsuccessful tool use only plays the tool animation and then clears the equipped cursor.
- Map access can be limited by access roles. The current default is authenticated `user` and `admin`; a public role exists for later unauthenticated map access.

Rendering note:

The hover edge effect is handled by CSS on the tile overlay layer. React does not store hover state, so moving the pointer across the map does not trigger a React state update for each tile hover.

The map component has been split into feature files under `resources/js/features/world` so theme resolution, active activity state, activity panels, bookmark/search behavior and map rendering can evolve separately.

## Admin Editing Direction

Admins are also learners, so editing controls should not appear inside the normal learner map view.

Current admin editing slice:

- Settings links to a separate world-editing workbench.
- The workbench displays maps as graph nodes.
- Portal links between maps are displayed as edges.
- Hovering or selecting a portal edge highlights it and shows the linked portal tiles.
- Selecting a map opens a details panel with an `Edit World` action.
- The edit page displays the selected map as a hex grid.
- The edit page uses the full app workspace instead of the compact settings subpanel.
- The edit hex grid can be dragged, matching the learner map interaction model.
- Dragging can start on tiles or the empty editor surface, and editor text is not selectable during map manipulation.
- The editor grows from existing nodes instead of rendering a large endless grid of empty plus cells.
- Empty neighboring coordinates show compact `+` buttons.
- Clicking `+` opens an overlay panel for configuring a new tile or adding an editor-only empty-space node.
- Clicking an existing tile opens the same overlay in edit mode.
- The tile create/edit overlay uses accordion sections so activity editing, basic metadata, display options and dark/light visuals are separated.
- Existing tiles expose `Edit activities` at the top of the overlay.
- Tile image editing is now mode-specific: dark and light images are the main source. The older fallback-image field was removed.
- Tile image fields can upload, download, select an existing reusable image and clear the current reference.
- Node image fields expose image visibility, position, width and rotation so square source art can be tuned inside the runtime hex mask.
- Fallback tile color controls were removed from the editor. New nodes receive default dark/light color sets instead.
- Node lock state, hover text, image visibility, label visibility and hidden-node reveal configuration belong in the node overlay.
- Unlock condition configuration belongs in the node overlay and can combine completion requirements with tool-based unlocking.
- Map visuals include completed-node dimming settings for dark and light mode.
- Existing tiles show directional arrow controls; clicking an arrow swaps the tile with the neighboring tile in that direction.
- Adjacent occupied tiles show a compact line button between their facing edges; inserting there pushes the neighbor chain outward and creates a real hex coordinate for the new node.
- The graph view is implemented with React Flow so future activity tags can drive grouping and layout behavior.
- The graph view uses the same resolved appearance state as the rest of the app.

Future admin editing:

- Improve tile artwork ergonomics for landscape-style maps, including better crop/position controls.
- Add map deletion and richer map lifecycle controls.
