# Prioritized Backlog

This backlog contains current direction. Historical ideas in `concept/` and
`concrete_concept_i1/` remain references until explicitly promoted here.

## Science-to-feature roadmap

These items translate established learning-science and SDT principles into
small, testable platform behaviors. They are design commitments, not a
promise that every interaction produces an immediate measurable gain.

- [x] Offer an optional learner-chosen direction after completion: return to
  the place, look for something related, or let it settle. Keep it private,
  retrievable and free of deadlines, reminders or performance language.
- [x] Add learner-controlled revisit invitations using a small spacing window.
  Learners can open, postpone or hide them; there is no notification or
  compulsory queue. Retrieval-specific invitations remain a later refinement.
- [x] Expand competence evidence into longitudinal, inspectable narratives where
  learners can compare earlier and later reasoning without reducing growth to a
  single number. Topic trails now show a bounded private before-and-after view
  when two connected reflections exist.
- [x] Add an optional author-written context sentence for the three completion
  directions. The base choices remain bounded and distinct; future work can
  add activity-specific alternatives only when they lead to genuinely
  different learning actions.
- [x] Add optional help-seeking moments with an explicit audience choice,
  moderation and a clear learner-controlled exit. Support requests stay out of
  peer walls; reciprocal peer response remains a later slice.
- [x] Add optional peer-response moments with consent, moderation and a clear
  learner-controlled exit. Authors opt in per message wall; learners can reply
  once to a visible peer message and Learning Support moderates responses.
- [x] Give activity authors a competence-supportive feedback contract: state
  the task purpose, describe observable evidence in the response or action,
  and offer one useful next action without trait judgments. The same guidance
  is visible during playback and inspected by the scoped activity review.
- [x] Add an explicit Review / revisit activity type that reuses the reflection
  renderer and private journal comparison behavior. Keep retrieval, feedback
  and spacing refinements incremental, and keep reflection skippable.
- [x] Make tool-resolved obstacles discoverable in the demo: restore seeded
  scene assets, keep a resilient visible target fallback and explain the
  hammer -> tool -> target interaction in playback.
- [x] Use one learner navigation order across the desk, map, bookmarks and
  activity surfaces. Contextual links extend the shared primary set rather
  than creating a second map-only or activity-only header, and the map link is
  named Current map on learner surfaces. Journal is an icon-only utility
  action beside notifications, not a primary navigation item or side-rail
  action.
- [x] Make configured locked places inspectable before they open. Learners can
  see actionable completion, tool or time conditions and their current state;
  hidden places remain concealed and authored rule data stays server-side.

The evidence base is strongest for autonomy-supportive teaching, retrieval and
spacing, while relatedness effects are more context-dependent. Relatedness
features should therefore invite connection rather than require social
participation.

## Priority 1 - Strengthen Existing Learning Loops

- [x] Keep direct route selections bound to their selected activity graph.
  Route starts now preserve the run and current activity through the initial
  handoff and repair stale cross-route resume state. New graph connections also
  name their destination by default, while terminal outcomes retain their
  connector meaning.
- Complete the remaining UI audit follow-up in
  `concept_current/ui_navigation_and_visual_audit.md`: add automated
  responsive/collection coverage for configured palettes and long collections.
  The shared learner shell now also offers a keyboard skip-to-content entry;
  player overlays now restore focus after dismissal; activity-graph nodes and
  connections now expose keyboard-actionable editing. The broader authoring
  workspace still needs a focused browser pass.
  The community navigation contract is now shared by organization pages, and
  the earlier focused-map overflow signal is not reproducible in the current
  browser pass.
- Expand the existing local Activity-template flow into reusable cross-map
  templates only after its context-sensitive fields and asset references are
  defined safely.
- [x] Make the local Activity-template scope and copied map-sensitive
  references visible before saving. Cross-map reuse remains gated until those
  references have explicit resolution controls.
- Continue refining learner navigation and information architecture across the
  learning desk, Topics, Paths, Journal, competence and maps. Keep direct map
  access and authored portal travel complementary, and preserve optional rather
  than forced topic nesting.
- [x] Improve private learning analytics and reflection support without rankings.
  Topic trails now keep the earlier/later look-back and expose a small
  chronological, paginated set of intermediate reflections for the learner.
- [x] Extend access history to include successful self-service password,
  two-factor and passkey lifecycle changes. Events record only neutral
  lifecycle metadata, never a password, secret, credential identifier or
  other credential-derived value.
- [x] Retain a bounded history of completed activity-review runs for tutors.
  The current review remains the active state, while the latest five authoring
  readings can be inspected without exposing AI review data to learners.

## Priority 2 - Authoring And Reuse

- [x] Let authors edit an optional learner-facing label for each
  activity-graph connection. Selecting a connection opens a small editor;
  clearing the field restores the destination or connector default, and
  deletion is explicit.
- [x] Add searchable media tags, categories and explicit transparency/animation
  metadata to the reusable visual library. Keep unknown values available when
  a file format cannot be verified reliably.
- [x] Improve MapAsset crop, anchor and placement ergonomics with shared image
  framing controls and alpha-aware hit testing.
- Add map/world version history, rollback and collaborative editing locks.
- Add bulk import/export for maps and MapAssets.
- Add global/world configuration profiles with visible inherited values and
  local overrides.
- [x] Diagnose conflicting unlock setups before saving, including empty
  enabled rules, missing tools, self-prerequisites and impossible time windows.
- Expand unlock rules with item, group, role and manual conditions plus conflict
  evaluation beyond the current completion, tool and time conditions.

## Priority 3 - Deeper Cooperation

- Expand shared tasks into project briefs, task decomposition and assignment.
- Support peer review, revision and presentation of group work.
- Allow scoped group authoring of worlds, maps and activity routes.

## Priority 4 - AI Assistance

- Move longer provider executions to queued jobs with progress and cancellation.
- Add guarded, administrator-selected context loaders and more provider adapters.
- Expand the existing reviewed MapAsset draft flow to questions, feedback,
  branching routes and broader world design.
- Add a side-by-side authoring conversation that can inspect scoped existing
  structures and suggest revisions before a tutor saves or applies a draft.
- Let the world-design assistant inspect existing structures and explicitly
  propose reuse, merging or extension before creating new content.

## Priority 5 - Optional Expansion

- Add map ambience and dedicated portal, tool-use and dialogue-typing sounds.
- Add currencies, exchange/merchant interactions and richer inventory tools only
  where they have a clear learning purpose.
- Add Map lenses for competence, recommendation or activity context.
- Add richer competence relationships, learner notes and optional summaries.
- Add a browser extension only after the core platform workflows are stable.
