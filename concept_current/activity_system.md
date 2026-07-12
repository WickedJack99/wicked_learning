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

NPC dialogue activities now use the same graph idea at a nested level:

- The node-level activity graph contains an `NPC dialogue` activity with one Entry connector.
- The activity exposes one Exit connector per End node inside the NPC dialogue graph.
- End nodes have a color and a letter/number symbol so the matching activity-level connector remains understandable for colorblind admins.
- The nested NPC dialogue editor has a synthetic Start node, configurable NPC interaction nodes and configurable End nodes.
- NPC interaction nodes already carry the first layer of visual playback config: dark/light background images, dark/light NPC images, slide direction, slide/fade timing, NPC x/y position, speech bubble text, typing speed, dark/light speech bubble colors, borders and opacity.
- Runtime playback happens on the separate node-play route, not as an overlay on the world map.
- Runtime NPC dialogue playback follows the nested dialogue graph from its Start node through interaction nodes to End nodes. End nodes complete the NPC dialogue activity and use the matching activity-level Exit connector to continue the parent activity route.
- NPC interaction nodes can now be configured as either monologue or question interactions.
- NPC interaction graphs can also grant tools, using the same learner-owned tool model as standalone tool-grant activities.
- Question interactions do not embed answer text or feedback in the question config anymore. A question only defines how many answer outputs it exposes.
- Answers are first-class dialogue graph nodes. Each answer node stores its answer text, display label and whether the answer is considered correct for private learning analytics.
- Question-to-answer edge order controls the display order of answer possibilities during playback.
- Answer nodes route onward through their own outgoing graph edges. That means several answers can converge on one follow-up bubble, branch to different bubbles, or loop back to an earlier question.
- Feedback is authored as normal follow-up monologue/question nodes instead of appearing as a special feedback card. This keeps the conversation fluid and lets admins decide how correction, hints or confirmation should feel.
- Question interactions block normal forward/back controls until an answer is selected. After the answer is confirmed, correctness is stored privately and the graph continues through the selected answer node.
- Keyboard playback controls are part of runtime: left arrow moves back where allowed, right arrow or space continues, and enter confirms a question answer.
- The demo seed includes a second Pattern Gate route named `Guided pattern dialogue`. It uses simple dark/light NPC and background SVG assets, a question interaction with multiple answer output connectors, answer nodes, correctness tracking, a review loop and a successful end connector.

Planned deeper dialogue layers:

- An NPC interaction node can later open another graph for speech bubbles.
- Speech-bubble nodes can include monologue bubbles, question bubbles and answer bubbles, mirroring the current activity-level NPC dialogue graph model.
- Question bubbles can have a configurable number of exits; each answer can route to shared or distinct follow-up bubbles, including cycles back to earlier bubbles.
- Bubble-level End nodes should map back to the parent NPC interaction node's outputs in the same color-and-symbol style.
- Answer correctness is tracked for private learning analytics and feedback routing, not for public scores, streaks or leaderboards.

Portal activities are represented as one activity type with a portal direction in config. The labels intentionally use learner/admin language:

- Entry portal: a route that sends the learner to another node or map. It must end its activity path.
- Exit portal: a receiving route on the destination node. It is not shown as a normal start route button.

Portal links are configured on the portal activity itself, not separately on the map edge. The world graph can still display portal links as edges between maps for overview and debugging.

Portal visual settings belong to the portal activity. They include dark/light background and foreground assets, optional mirroring, foreground x/y/width, duration, optional swirl rotation and optional click-to-enter behavior. Exit portals can also decide whether their arrival scene is shown or skipped. Exit portal settings must persist even though exit portals intentionally have no destination target.

Current UI behavior:

- The node detail panel shows route choices, not the activity player itself.
- Starting a route navigates to a separate node-play page so the map does not keep unnecessary listeners and rendering work active during activity playback.
- When an activity becomes active, the bottom navigation can show an activity-return button.
- Returning to an active activity should restore the map and focus the relevant node.
- Activity progress is personal orientation, not a public score.
- Admins edit activity graphs from the map editor by opening an existing tile and selecting `Edit activities`.
- Activity playback pages reserve space for the bottom navigation instead of letting activity controls disappear behind it.
- Route playback stores learner-specific run state on the backend. Refreshing the browser should resume the current activity or current dialogue bubble instead of replaying the first activity by accident.
- A learner can intentionally restart a route from the beginning. Restarting from inside a run should not duplicate grants already made in that run, while resetting from the node panel can create a fresh run according to the route rules.
- The URL should stay as clean as practical. Backend run state is preferred over exposing activity internals in query parameters.

Route visual notes:

- Route preview images are stored on the start route, not on activity nodes.
- Route images can be uploaded/downloaded from the Start edge editor.
- Route overlay buttons use configurable dark/light background and frame colors.
- The route card is one clickable surface; image and button start the same route.

Obstacle activity direction:

- Obstacle activities are tool-resolved interactions rather than scored challenges.
- The activity displays a configurable dark/light background, a configurable dark/light obstacle image and an optional speech bubble that can be hidden by the learner.
- The speech bubble uses the same typewriter-style text reveal as NPC dialogue bubbles. Its dark/light inner color, border color, opacity and typing speed should be configurable.
- The obstacle remains present until the learner equips and uses a tool that the admin configured as valid for that obstacle.
- The required tool is selected from available tools instead of entered as a raw id.
- Obstacle placement is configurable by x/y percentage and image-width percentage, so it can be a wall, a small rock or another localized blocker inside a larger background.
- Tool-click animation should play first. The obstacle only transitions to solved when the click lands on the obstacle target and the equipped tool is valid.
- If the click misses the obstacle, the tool animation can still play, but the activity state should not advance.
- Tools are generic learner-owned capabilities. They can be acquired in activity routes and later used against obstacles, without becoming badges, points or status markers.
- A floating player/tool-belt control can show acquired tools in acquisition order and lets the learner equip one tool at a time.
- Tool visuals support dark/light images. For the first implementation, uploaded animated GIF/WebP assets are preferred over a custom frame-node timeline editor because they are easier for admins to understand and keep the runtime simple. The data model should remain open to richer frame-sequence animation later.
- Tool visuals also support configurable image and animation widths. Runtime preview, map usage and obstacle usage should share the same sizing helper.
- After a valid tool is used, the obstacle can play a configurable success animation and display a second optional speech bubble using the same color settings as the first bubble.
- Obstacle activities can either reappear on every replay or stay cleared for the learner.
- If an obstacle stays cleared, revisiting the activity should show a third configured state instead of skipping the activity completely. That state can use its own background, cleared obstacle image and text bubble while inheriting shared bubble styling.
- If an admin changes the obstacle to reappear, the admin configuration must take priority over the learner's old cleared state.
- Cleared-state images replace the obstacle image. They are not an overlay that should move to a different position.

Tool-grant activity direction:

- Tool-grant activities give the learner a selected existing tool.
- The activity can show a configurable dark/light background, place the tool image by x/y percentage, and use NPC-like slide/fade timing.
- The activity can include a typewriter-style text bubble with dark/light colors, border and opacity.
- If the learner already owns the tool, the activity should continue without presenting it as a fresh acquisition.

Sound direction:

- Sounds should be reusable assets rather than one-off file paths inside each activity.
- A sound can have an icon category, display name, volume, loop flag and optional play-only-first-n-seconds setting.
- Runtime audio should support layering. Background ambience, dialogue effects and interaction sounds may play together.
- Future activity editors should use the reusable sound picker instead of duplicating upload/download/select behavior.

Item activity direction:

- Items are consumable inventory objects, unlike reusable tools.
- Grant-item activities can grant multiple item types and quantities after a server-side probability roll.
- The grant roll and inventory write must stay backend-owned so a learner cannot repeatedly trigger only the browser request to farm items.
- Item-grant playback should show the received items directly, with the item display growing only as much as needed and wrapping at three items per row.
- Item-obstacle activities display configurable item slots over a scene. Dragging the correct item into a slot consumes it and records the slot state.
- Item obstacles can require several slots before continuing and can optionally lock retry attempts for a configured real-time duration.
- The learner inventory appears in the side action bar as a compact grid with item counts.

Markdown activity direction:

- Markdown activities contain a nested page graph with Start, page and End nodes.
- Page nodes store Markdown content, media embeds and theme-specific colors for page surface, text, border and headings.
- Runtime navigation uses arrows, space and keyboard arrows while still fitting into the normal activity route flow.
