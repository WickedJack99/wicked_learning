# Map System

The map is a spatial representation of knowledge, not a course list.

## Current Product Model

A MapAsset is the visible and functional place on a map. A focusable MapAsset
owns its title, description, learner panel, activity routes, progress rules and
visual representation. A non-focusable MapAsset is decorative and does not open
learner content.

The backend uses `learning_nodes` as an internal activity anchor for activity,
progress and portal relations. This is an implementation detail, not a second
object that administrators should have to create or connect manually. Every
MapAsset has at most one internal node and every learner-facing node is
represented by one MapAsset.

Current learner behavior:

- MapAssets use freely configurable percentage-based X/Y positions, Z depth,
  size and opacity.
- Transparent PNG and WebP images can form irregular, overlapping map surfaces.
- Authors can choose whether an image stays fully visible or fills its square
  frame, and can anchor cropped framing to the center or an edge.
- Normal, hover and focused visuals share one renderer between learner map and
  editor preview.
- Hover and focus can use colors or a configured highlight image.
- Hover/focused labels render inside the MapAsset rather than below it.
- Focusable MapAssets open a right-side learner panel with their title,
  description and activity routes.
- Decorative MapAssets remain visual-only and cannot be selected by learners.
- Hide-on-hover MapAssets become pointer-transparent to reveal underlying
  content and remain hidden while an overlapping MapAsset stays focused.
- Toggle-state MapAssets switch between two configured images on click; each
  state can use its own image, X/Y position and size.
- Pointer hit areas use the rendered image alpha mask so irregular transparent
  artwork does not behave like a rectangle or historical hex tile.
- Locked, hidden, hinted, available, recommended and completed states are
  resolved per learner.
- Unlock rules currently support completed MapAssets, tool use, learner roles,
  item possession, time conditions and nested AND/OR rule groups.
- Visible locked MapAssets with configured rules, tool conditions or item
  conditions can be
  opened for orientation. Their learner panel shows actionable condition
  labels and the learner's current state without exposing authored rule data;
  prerequisite place labels link back to the relevant map location.
- Authorised Learning Support staff can make a locked MapAsset available for one
  visible learner when a human support decision calls for it. This manual
  opening is reversible, recorded separately from authored prerequisites and
  does not consume tools or items.
- Hidden MapAssets can be revealed by configured tools.
- MapAssets can be bookmarked and found through server-side map search.
- Activity playback runs on a dedicated page and returns to the related map.
- Maps can restrict learner access by role.
- The learner surface does not allow dragging MapAssets.

Topic connection:

- A topic is a semantic entry point and organizing context, while a map is an
  exploratory surface through which that topic can be encountered.
- A map may be assigned to zero or one topic, and a topic may expose multiple
  maps. The first relationship stays intentionally simple until real reuse
  patterns justify sharing one map across several topics.
- Assigned maps appear on the published topic page only when the learner can
  access the map. The topic page links into the map with its existing map
  context rather than duplicating map content.
- Topic nesting remains optional and independent from map assignment. A topic
  can be a subtopic in one area without requiring every topic or map to form a
  single rigid tree.
- Learners can reach a map from the learning desk, topic and path surfaces, or
  through an authored portal. Portal travel supports discovery between maps but
  is not a prerequisite for direct navigation.

## Current Admin Editing

- World Builder separates graph editing from structural navigation.
- Selecting a map opens the MapAsset surface or map configuration.
- The MapAsset surface uses the available workspace and has a floating
  `Add MapAsset` action.
- New MapAssets start in the center and can be moved through X/Y values.
- Selecting a MapAsset opens the full MapAsset editor.
- The editor contains surface and placement, text, learner panel, activities,
  rules, visuals, sounds and deletion controls.
- Enabled unlock rules reject deadlocked combinations such as no condition,
  missing tool selection, self-prerequisites or an unlock time after its lock
  time before the node is saved. Authored nested rule trees are also checked
  for supported condition types, valid references and non-empty groups. A
  locked-node prerequisite cycle is rejected when it is required on every
  successful path; an optional cycle inside an OR branch remains possible when
  another branch can open the node independently.
- Authors can optionally require one assigned learner role. The learner sees
  the evaluated role requirement without receiving authored rule configuration.
- Authors can optionally require an item in the learner's inventory. Entering a
  node checks possession without consuming the item; item-obstacle activities
  remain the explicit place for item consumption.
- Learning Support can review and close manual openings for a selected learner;
  resetting tool-based discoveries does not silently remove this separate
  support decision.
- World Builder reports locked prerequisites that have no authored learner
  opening path. This is an advisory authoring diagnostic rather than a new
  learner state; a support opening can still be used intentionally.
- Image fields reuse the shared upload, download, select-existing and clear
  component.
- Visual previews use the same `MapAssetVisual` renderer as the learner map.
- Editor and learner interaction use the same responsive alpha-mask geometry.
- A map can lock its MapAsset surface so placement cannot be changed.
- Map-level configuration separates details, visuals, access and deletion.
- Admin dragging of the map surface is disabled; MapAsset placement is explicit.
- Portal relationships remain visible in the world graph.

## Future Editing Direction

- Improve crop, anchor and position ergonomics for irregular transparent art.
- Keep image framing options aligned with alpha-aware hit testing when adding
  further crop controls.
- Add version history and safe rollback for world edits.
- Add collaborative edit locks when several authors work on the same map.
- Add bulk import/export for maps and MapAssets.
- Continue moving dense configuration into full-height workspaces with stable
  navigation, previews and keyboard access.
