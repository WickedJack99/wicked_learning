# Codex Guide For `resources/js`

This directory owns the Inertia/React user interface. Keep pages focused on composition and route-level orchestration.

## Responsibilities

- Pages receive Inertia props and compose feature components.
- `features/` owns larger user-facing or admin-facing feature behavior.
- `components/` owns shared UI structure, controls and reusable configuration patterns.
- `hooks/` owns reusable local state, browser integration and shared effects.
- `theme/` owns appearance, presentation and map visual resolution helpers.
- `types/` owns shared TypeScript shapes.

## UI Consistency

- Reuse existing configuration shells before building a new settings layout.
- Reuse shared color, opacity, image picker, sound picker, cursor and theme helpers.
- Use the existing appearance hook for light/dark resolution.
- Keep map-specific accents wired through the shared map visual styling path.
- Keep scroll behavior intentional. Main app views should not accidentally create body scroll.
- Preserve custom cursor behavior unless the feature intentionally overrides it, such as equipped tools.

## UI/UX design skill

For learner-facing or administrator-facing UI work, use the
`ui-ux-pro-max` skill as an advisory design and usability resource.

Its recommendations are subordinate to:

1. `documentation/product.md`
2. existing Wicked Learning interaction and visual language
3. this scoped `AGENTS.md`
4. accessibility and established application behavior

Use the skill especially for:

- accessibility review
- responsive behavior
- interaction states
- layout and visual hierarchy
- forms and controls
- keyboard and focus behavior
- identifying common usability anti-patterns

Do not adopt generic product templates, gamification patterns, dashboards,
visual styles, color systems, typography, or engagement mechanics merely
because the skill recommends them.

Intentional exploration, spatial navigation, ambiguity and discovery in
Wicked Learning must not automatically be treated as UX defects.

Prefer adapting the skill's guidance to the existing product over redesigning
the product around the skill.

## DevTools markers

- Add stable `data-wl-id` markers to meaningful route regions, panels, feature
  components, overlays, collection containers, forms and important controls.
- Use human-readable product paths such as
  `learner.competence.learning-pulse`; do not derive markers from CSS classes,
  generated IDs or localized copy.
- Skip decorative nodes and layout-only wrappers. Prefer marking the component
  boundary that owns a behavior, state or layout area.
- Apply markers progressively to shared UI and touched feature surfaces; do not
  flood every DOM node or use ordinary `id` attributes when a DevTools marker
  is the only need.

## Collection and viewport decisions

- Decide viewport ownership, bounded collection behavior and keyboard paths
  before adding UI items.
- Prefer pagination for finite collections that may grow; do not introduce a
  scrolling area merely to fit more items. Use scrolling only when continuous
  reading or editing is the actual task.
- When a view contains several distinct areas or workflows that may not fit in
  the viewport, add a visible submenu or tab switcher so the learner or author
  can move between those areas instead of stacking them into one scrolling
  surface.
- A document-level scroll may remain necessary at narrow breakpoints when the
  layout stacks separate regions; it must not replace pagination or a submenu
  for collection or area overflow.
- Keep panels within the available viewport beneath the shared navigation and
  verify overflow at the smallest supported layout before finishing a change.

## Localization

- Add fixed, generic, user-facing UI strings for touched features to `lang/en.json`.
- Access platform copy through `usePlatformTranslation` or an existing wrapper around that hook.
- Do not add a second translation mechanism or hard-code new fixed English strings in touched React files.
- Keep authored content, deployment-configured content and protected activity-specific content out of the global catalog when it should not be preloaded.
- Update targeted localization tests when catalog structure or behavior changes.

## Performance

- Keep heavy map, graph and activity logic outside page components.
- Avoid client-side searches for data that must include other maps or access-controlled records.
- Keep graph math and hex-grid math in reusable helpers.
- Avoid reloading already fetched lightweight overlay data when local cache is enough and privacy allows it.
- Do not load data for inactive panels or features when scoped Inertia props can provide only the active workspace.
- For collections that grow with realistic data, prefer pagination, lazy loading or virtualization over rendering everything at once.
- For media, distinguish browser caching from server performance: inspect cache headers and repeated network requests before changing formats or resolutions.
- Use appropriately sized or responsive assets, asynchronous decoding and lazy loading for non-critical media, while keeping above-the-fold content available without layout shifts.
- Avoid frontend rendering or network work whose cost grows unnecessarily with every asset, relationship or interaction.

## Activity UI

Activity playback should run on dedicated pages rather than over the map. Route and dialogue progress should be backed by server state when refreshes must resume the learner correctly.

## Validation

Use targeted TypeScript, lint or build checks when touching shared UI helpers. For visual changes, verify the affected route in the browser when practical and report what viewport or state was checked.

- After any UI or layout change, verify the rendered result at 100% browser zoom in the affected supported viewport(s), including the smallest relevant layout and the relevant desktop size. Check that primary navigation, pagination, dialogs and controls have usable bounding boxes fully inside their owning viewport or panel and are not clipped, obscured or overlapped. Source or DOM presence alone is not sufficient; repeat the check after state changes such as opening a dialog or changing pages.
- When a settings menu has no explicit deep link, saved choice or other valid selection, focus its first visible item. Derive fallback selection from the rendered menu order so adding a new first item cannot leave the old default focused.
