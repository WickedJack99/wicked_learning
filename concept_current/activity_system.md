# Activity System

Earlier notes described multiple activities inside a node as mostly sequential. The current direction is an activity graph.

An activity can transition to another activity based on:

- `completed`
- `correct`
- `incorrect`
- `outcome`

The MVP uses this for:

- Dialogue completion leading to a question.
- Correct answer leading to reflection.
- Incorrect answer leading to a short review dialogue.
- Review dialogue leading back to the question.

This is intentionally simple. A visual graph editor can come later after the learning loop feels right.

Current UI behavior:

- Starting an activity happens inside the node detail panel instead of requiring a separate start page.
- When an activity becomes active, the bottom navigation can show an activity-return button.
- Returning to an active activity should restore the map and focus the relevant node.
- Activity progress is personal orientation, not a public score.
