# Activity System

Earlier notes described multiple activities inside a node as mostly sequential. The current direction is an activity graph with multiple route starts.

An activity can transition to another activity based on:

- `completed`
- `correct`
- `incorrect`
- `outcome`
- connector ids such as `completed`, `correct`, `incorrect`, `outcome`, `travel`, `in` and `end`

The MVP uses this for:

- NPC dialogue completion leading to a question.
- Correct answer leading to reflection.
- Incorrect answer leading to an explicit review activity.
- Review activity leading back to the question.

The admin activity editor now uses a graph view for a single map node. It has a special Start node, a special End node, and activity nodes with Entry and Exit connectors. Dragging from one connector to another creates a connection. Clicking an existing normal connection removes it.

The synthetic Start node can connect to multiple first activities. Each Start-to-activity connection becomes a learner-facing route option in the focused MapAsset panel. A route option can have dark/light preview images and dark/light overlay button colors. If no image is configured, it still appears as a compact button. If enough route options exist, the route list scrolls inside the panel.

The graph editor is intentionally generic. Activity type definitions describe labels, descriptions, inputs and outputs. That allows specialized editors for NPC dialogue graphs, questions, reflections, review pauses and portals without replacing the graph itself.

When an author connects one activity to another, the connection label defaults to
the destination activity title so the learner and author can understand where
the path goes. A connection to the synthetic End node keeps the source
connector label, such as "Completed". Seeded or explicitly authored labels
remain authoritative.

`review` is an explicit review/revisit activity type that uses the same
learner-owned reflection renderer and journal storage as `reflection`. The
separate type makes the author's intention visible in the activity list and
editor while keeping one implementation for the shared interaction. It
defaults to the `review` learning purpose and can show earlier private notes
from the same journal category when they are available. A normal `reflection`
can still be given the `review` learning purpose when keeping the generic type
is more appropriate.

Learner-message activities use that same graph instead of being a hardcoded
route-completion modal:

- A `message_prompt` Activity invites the learner to leave a short helpful or
  encouraging message. It only asks while that learner has not contributed to
  the linked topic.
- A `message_wall` Activity displays visible contributions as cards over its
  Activity surface. Closing the wall completes the Activity and follows its
  configured output.
- Both Activity types link a reusable message topic scoped to the current
  MapAsset. This allows one prompt and several wall placements to share the
  same content without coupling it to another MapAsset.
- Their surface, card, card-border, text and accent colors are configurable for
  dark and light appearance in the normal Activity editor with a live preview.
- Learning Support sees the author context. Learners viewing the wall do not
  receive author data.
- A `message_prompt` can be authored for the peer wall or for Learning Support.
  A support request is kept out of peer walls, appears in the existing support
  moderation view, and remains an optional learner choice with a clear way to
  continue without sending it.
- A peer `message_wall` can optionally invite one response per learner and
  visible message. Responses are shown without author identity to learners and
  use the same moderation controls as the original messages.

NPC dialogue activities now use the same graph idea at a nested level:

- The MapAsset Activity graph contains an `NPC dialogue` Activity with one Entry connector.
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
- The latest answer feedback, explanation and route continuation remain available when a learner revisits the activity, so returning to a question does not remove useful response context or the next step.
- A question may optionally collect a plain-language starting sense (`exploring`, `leaning`, or `settled`). It is kept with the private answer for later reflection and calibration, not used as a score or star-map signal. On revisit, the learner may open up to three earlier tries to notice changes in reasoning.
- Keyboard playback controls are part of runtime: left arrow moves back where allowed, right arrow or space continues, and enter confirms a question answer.

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

- The focused MapAsset panel shows route choices, not the activity player itself.
- Starting a route navigates to a separate node-play page so the map does not keep unnecessary listeners and rendering work active during activity playback.
- Activity playback uses the shared learner header with the same primary links
  as the learning desk, followed by Current map and Continue activity. The
  order is Learning desk, Paths, Topics, Competence map, Bookmarks, Current
  map, Continue activity. Journal is an icon-only utility control beside
  notifications, rather than a primary route or side-rail action. The same
  contextual links are also present on the desk, Paths, Topics and competence
  surfaces when relevant, keeping playback, map and bookmark surfaces in one
  learner navigation model.
- Returning to an active activity should restore the map and focus the relevant node.
- Activity progress is personal orientation, not a public score.
- After completion, the learner may choose one of three bounded directions for
  later: return, look for something related or let it settle. Authors may add
  one short context sentence for why these directions are relevant to the
  activity; the choices remain optional and are not a route requirement.
- The completion check-in is an overlay in the activity column, so it does not
  reduce the activity scene to make every option fit in the initial viewport.
  Learners can hide it to return to the activity and show it again when ready.
- Admins edit activity graphs by selecting a MapAsset and opening its `Activities` section.
- The route restart action is kept in the shared activity frame at the lower
  edge of the activity surface, instead of competing with primary navigation.
- Route playback stores learner-specific run state on the backend. Refreshing the browser should resume the current activity or current dialogue bubble instead of replaying the first activity by accident.
- A learner can intentionally restart a route from the beginning. Restarting
  from inside a run should not duplicate grants already made in that run, while
  resetting from the focused MapAsset panel can create a fresh run according to
  the route rules.
- The initial route handoff keeps the selected route start, current activity
  and play-run id in the URL so a route cannot silently fall back to another
  route in the same node.

Route visual notes:

- Route preview images are stored on the start route, not on activity nodes.
- Route images can be uploaded/downloaded from the Start edge editor.
- Route overlay buttons use configurable dark/light background and frame colors.
- The route card is one clickable surface; image and button start the same route.
- If an older run points to an activity that is not reachable from the selected
  route start, resuming that route returns to its start and clears the stale
  current-run activity state.

Obstacle activity direction:

- Obstacle activities are tool-resolved interactions rather than scored challenges.
- The activity displays a configurable dark/light background, a configurable dark/light obstacle image and an optional speech bubble that can be hidden by the learner.
- The speech bubble uses the same typewriter-style text reveal as NPC dialogue bubbles. Its dark/light inner color, border color, opacity and typing speed should be configurable.
- The obstacle remains present until the learner equips and uses a tool that the admin configured as valid for that obstacle.
- The required tool is selected from available tools instead of entered as a raw id.
- Obstacle placement is configurable by x/y percentage and image-width percentage, so it can be a wall, a small rock or another localized blocker inside a larger background.
- Tool-click animation should play first. The obstacle only transitions to solved when the click lands on the obstacle target and the equipped tool is valid.
- If the click misses the obstacle, the tool animation can still play, but the activity state should not advance.
- The demo obstacle visuals are repository-owned seeded assets, so the basic
  obstacle interaction is visible immediately in a fresh demo. If a configured
  image later fails to load, playback keeps an explicit target that tells the
  learner to equip a tool and click the gate instead of leaving an invisible
  action.
- The obstacle speech bubble should make the interaction path discoverable:
  open the hammer control, choose an owned tool, then click the visible target.
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

Collaborative project learning direction:

- Learners should eventually be able to work in groups on concrete projects instead of only completing individual activity paths.
- A project activity can describe a system, artifact, learning world or topic-specific world section the group should design or build together.
- Project briefs should fit the group's current competence level. The platform may need prerequisites, learner competence signals or admin-assigned difficulty bands before assigning a project.
- Feasible sub-activities could include choosing a problem, asking clarifying questions, proposing a design, splitting implementation tasks, reviewing another learner's contribution, revising after feedback and presenting the result.
- Group state should be shared where cooperation matters, while still preserving individual reflections, attempts and feedback where personal learning should remain private.
- A group could be assigned one topic and receive access to design a world, map, node path or activity sequence for that topic.
- The system should support cooperation, responsibility and peer learning without relying on public rankings, streaks or pressure mechanics.
- AI could help validate project briefs, suggest next feasible tasks, review contributions against a contract and keep the group moving, but final state changes should still go through backend-owned activity rules.
