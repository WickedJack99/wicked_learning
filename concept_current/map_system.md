# Map System

The map is a spatial representation of knowledge, not a course list.

## Current Product Model

A MapAsset is the visible and functional place on a map. A focusable MapAsset
owns its title, description, learner panel, activity routes, progress rules and
visual representation. A non-focusable MapAsset is decorative and does not open
learner content.

The backend still uses `learning_nodes` as an internal compatibility record for
activity, progress and portal relations. This is an implementation detail, not
a second object that administrators should have to create or connect manually.
Every MapAsset has at most one internal node and every learner-facing node is
represented by one MapAsset.

Current learner behavior:

- MapAssets use freely configurable percentage-based X/Y positions, Z depth,
  size and opacity.
- Transparent PNG and WebP images can form irregular, overlapping map surfaces.
- Normal, hover and focused visuals share one renderer between learner map and
  editor preview.
- Hover and focus can use colors or a configured highlight image.
- Hover/focused labels render inside the MapAsset rather than below it.
- Focusable MapAssets open a right-side learner panel with their title,
  description and activity routes.
- Non-focusable MapAssets remain visual-only and cannot be selected by learners.
- Locked, hidden, hinted, available, recommended and completed states are
  resolved per learner.
- Unlock rules currently support completed MapAssets, tool use, time conditions
  and nested AND/OR rule groups.
- Hidden MapAssets can be revealed by configured tools.
- MapAssets can be bookmarked and found through server-side map search.
- Activity playback runs on a dedicated page and returns to the related map.
- Maps can restrict learner access by role.
- The learner surface does not allow dragging MapAssets.

## Current Admin Editing

- World Builder separates graph editing from structural navigation.
- Selecting a map opens the MapAsset surface or map configuration.
- The MapAsset surface uses the available workspace and has a floating
  `Add MapAsset` action.
- New MapAssets start in the center and can be moved through X/Y values.
- Selecting a MapAsset opens the full MapAsset editor.
- The editor contains surface and placement, text, learner panel, activities,
  rules, visuals, sounds and deletion controls.
- Image fields reuse the shared upload, download, select-existing and clear
  component.
- Visual previews use the same `MapAssetVisual` renderer as the learner map.
- A map can lock its MapAsset surface so placement cannot be changed.
- Map-level configuration separates details, visuals, access and deletion.
- Admin dragging of the map surface is disabled; MapAsset placement is explicit.
- Portal relationships remain visible in the world graph.

## Future Editing Direction

- Improve crop, anchor and position ergonomics for irregular transparent art.
- Add version history and safe rollback for world edits.
- Add collaborative edit locks when several authors work on the same map.
- Add bulk import/export for maps and MapAssets.
- Continue moving dense configuration into full-height workspaces with stable
  navigation, previews and keyboard access.
