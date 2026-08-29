# Codex Guide For `app/Learning`

This directory is the backend home for learning-domain behavior. Keep it independent from controller orchestration and frontend presentation details.

## Responsibilities

Use this area for:

- Actions that mutate learning state.
- Queries that load learner, admin or editor data.
- Serializers that shape learning payloads for Inertia or JSON.
- Services that own reusable learning rules.
- Validation objects for larger learning workflows.
- Support classes for graph, route, portal, node, media, tool, item, sound, journal, localization and progress behavior.

## Boundaries

- Keep classes named after behavior, not vague layers.
- Keep one clear responsibility per class.
- Do not let serializers mutate state.
- Do not let Actions build large frontend payloads.
- Do not let Services know about React component needs.
- Do not hide authorization decisions in serializers or presentation helpers.

## Common Placements

- Activity graph edits: Actions plus graph services.
- Activity playback progress: Services and targeted serializers.
- Portal traversal: portal-specific services.
- Node lock, reveal and unlock logic: node/progress services.
- Search and overview loading: Query classes.
- Inertia payloads: Serializers.
- Media, tool, item and sound reuse: reusable asset services.

## Validation

Prefer small, targeted tests around new behavior. Use factories or seed-style fixtures only when they clarify the learning rule being tested.

## Query and data-loading performance

- Treat query count, serialized payload size and collection bounds as part of query design. Measure them when changing an actively used workflow.
- Avoid N+1 relationship or permission lookups, repeated scans of the same dataset and loading records outside the current authorization or workspace scope.
- Reuse request-level authorization and relationship data where safe; batch reusable-media reference checks and similar multi-record work instead of rescanning every reference for every asset.
- Prefer pagination or scoped loading for growing collections. Add caching only after confirming the data is safely reusable and repeated work is the dominant cost.
