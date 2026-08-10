# Implemented Product Slice

The platform has grown beyond the original MVP. This file records the current
usable slice; future work is maintained in `prioritized_backlog.md`.

## Learner Experience

- Authenticated learners explore freely positioned MapAssets on configurable
  maps on desktop and mobile.
- Focusable MapAssets open learner panels with title, description, bookmark
  state and multiple activity routes.
- Activities run on dedicated playback pages and support graph transitions,
  route restarts and persisted progress.
- Implemented activity types include item grant, item obstacle, Markdown, NPC
  dialogue, dialogue, question, reflection, shared task, learner message prompt,
  learner message wall, obstacle, tool grant, placeholder and portal.
- A message prompt collects at most one short contribution from each learner
  for a reusable MapAsset topic. A message wall displays the topic's visible
  contributions as cards and closes through its normal Activity transition.
- Learners can keep private journals, request scoped feedback and view a
  competence constellation.
- Learners can acquire tools and items and use them in map and activity
  interactions.
- Groups, group chat and shared-task contributions provide an initial
  cooperation slice.
- Learners control appearance, language and optional sound preferences.

## Administration

- Settings uses a multi-level, full-height workspace for personal and
  administrative configuration.
- Admins manage users, roles, registration tokens, map access and groups.
- World Builder manages worlds, maps, free MapAssets, activity routes,
  dialogues, portals, rules, visuals and sounds.
- Reusable media, tools, items, sounds and cursor images have shared management
  and picker flows.
- Public presentation, information pages, translations, journal appearance,
  competence topics and learner-support views are configurable.
- Learning Support can review learner messages grouped by MapAsset and topic,
  see their authors, temporarily hide them or permanently delete them.
- AI provider credentials and reusable agent templates can be configured and
  tested, but productive AI authoring workflows are not implemented yet.

## Deliberate Boundaries

- Learning support avoids points, streak pressure, leaderboards and public
  learner comparison.
- MapAsset and activity mutations remain backend-owned where learner progress
  or inventory is affected.
- Historical hex-tile concepts are not the current map direction.
- Older files under `concept/` and `concrete_concept_i1/` are idea history, not
  automatically approved backlog.
