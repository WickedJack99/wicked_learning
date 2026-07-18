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

## Activity UI

Activity playback should run on dedicated pages rather than over the map. Route and dialogue progress should be backed by server state when refreshes must resume the learner correctly.

## Validation

Use targeted TypeScript, lint or build checks when touching shared UI helpers. For visual changes, verify the affected route in the browser when practical and report what viewport or state was checked.
