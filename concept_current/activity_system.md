# Activity System

Earlier notes described multiple activities inside a node as mostly sequential. The current direction is an activity graph with multiple route starts.

An activity can transition to another activity based on:

- `completed`
- `correct`
- `incorrect`
- `outcome`
- connector ids such as `completed`, `correct`, `incorrect`, `outcome`, `travel`, `in` and `end`

The MVP uses this for:

- Dialogue completion leading to a question.
- Correct answer leading to reflection.
- Incorrect answer leading to a short review dialogue.
- Review dialogue leading back to the question.

The admin activity editor now uses a graph view for a single map node. It has a special Start node, a special End node, and activity nodes with Entry and Exit connectors. Dragging from one connector to another creates a connection. Clicking an existing normal connection removes it.

The Start node can connect to multiple first activities. Each Start-to-activity connection becomes a learner-facing route option in the node detail panel. A route option can have dark/light preview images and dark/light overlay button colors. If no image is configured, it still appears as a compact button. If enough route options exist, the route list scrolls inside the panel.

The graph editor is intentionally generic. Activity type definitions describe labels, descriptions, inputs and outputs. That allows later specialized editors for dialogue stages, questions, reflections and portals without replacing the graph itself.

Portal activities are represented as one activity type with a portal direction in config. The labels intentionally use learner/admin language:

- Entry portal: a route that sends the learner to another node or map. It must end its activity path.
- Exit portal: a receiving route on the destination node. It is not shown as a normal start route button.

Portal links are configured on the portal activity itself, not separately on the map edge. The world graph can still display portal links as edges between maps for overview and debugging.

Current UI behavior:

- The node detail panel shows route choices, not the activity player itself.
- Starting a route navigates to a separate node-play page so the map does not keep unnecessary listeners and rendering work active during activity playback.
- When an activity becomes active, the bottom navigation can show an activity-return button.
- Returning to an active activity should restore the map and focus the relevant node.
- Activity progress is personal orientation, not a public score.
- Admins edit activity graphs from the map editor by opening an existing tile and selecting `Edit activities`.

Route visual notes:

- Route preview images are stored on the start route, not on activity nodes.
- Route images can be uploaded/downloaded from the Start edge editor.
- Route overlay buttons use configurable dark/light background and frame colors.
- The route card is one clickable surface; image and button start the same route.
