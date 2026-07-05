# Activity System

Earlier notes described multiple activities inside a node as mostly sequential. The current direction is an activity graph.

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

The admin activity editor now uses a graph view for a single map node. It has a special Start node, a special End node, and activity nodes with input and output connectors. Dragging from one connector to another creates a connection. Clicking an existing connection removes it.

The graph editor is intentionally generic. Activity type definitions describe labels, descriptions, inputs and outputs. That allows later specialized editors for dialogue stages, questions, reflections and portals without replacing the graph itself.

Portal activities are represented as one activity type with a portal direction in config. An output portal must end its path for now, because travel should happen after the previous activity path completes.

Current UI behavior:

- Starting an activity happens inside the node detail panel instead of requiring a separate start page.
- When an activity becomes active, the bottom navigation can show an activity-return button.
- Returning to an active activity should restore the map and focus the relevant node.
- Activity progress is personal orientation, not a public score.
- Admins edit activity graphs from the map editor by opening an existing tile and selecting `Edit activities`.
