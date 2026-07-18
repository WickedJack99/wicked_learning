---
name: wicked-feature-slice
description: Use when implementing a non-trivial Wicked Learning feature that spans Laravel, Inertia, React, database schema, permissions, theme configuration, media, activities, progress, or documentation. Helps Codex choose backend/frontend ownership, preserve SDT-aligned product direction, reuse existing abstractions, validate targeted behavior, and update concepts or docs.
---

# Wicked Feature Slice

Use this skill for larger feature work in Wicked Learning.

## Do First

1. Inspect the surrounding code for existing Actions, Services, Queries, Serializers, hooks, components, settings shells and feature modules.
2. State the intended ownership before editing:
   - controller or route receiving the request
   - Action, Service or Query handling behavior
   - Serializer shaping data
   - React component or hook owning UI behavior
3. Reuse existing abstractions when responsibilities match.
4. Keep domain content configurable and preserve the no-points, no-streaks, no-leaderboards direction.
5. Distinguish settled requirements from assumptions when the feature is exploratory.

## Backend Pattern

- Use controllers for orchestration only.
- Put writes in Actions.
- Put reusable learning rules in Services.
- Put read-heavy loading in Queries.
- Put frontend payload shaping in Serializers.
- Use migrations for schema changes.
- Use permission checks for admin areas and access-controlled records.

## Frontend Pattern

- Keep pages thin.
- Use feature components and hooks for graph editors, map editing, activity playback, journal, inventory/tools, media pickers and theme controls.
- Use the established settings configuration layout for admin configuration pages.
- Use shared appearance and map visual helpers instead of creating a new theme path.

## Verification

Run targeted checks that match the touched layer. Mention any checks skipped and why.

## Documentation

When behavior changes the concept, update `concept_current/` only if the new direction is clear enough to record. When public setup or implemented feature behavior changes, update `documentation/`.

Do not rewrite broad concept documents merely to make them match a prototype experiment. Report unresolved boundaries instead.
