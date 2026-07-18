---
name: wicked-activity-type
description: Use when adding or changing Wicked Learning activity types, activity graph connectors, nested React Flow editors, activity playback, learner progress, portal traversal, grants, obstacles, reflections, markdown, NPC dialogue, or activity localization. Guides safe backend-owned progress, configurable visuals/sounds, route graph behavior, and learner-visible payload boundaries.
---

# Wicked Activity Type

Use this skill for activity graph and playback changes.

## Ownership

- Activity definitions and connector labels belong in the activity registry and related serializers.
- Activity graph writes belong in Actions or activity-specific Services.
- Runtime progress belongs in backend progress Services.
- Activity-specific Inertia payloads belong in Serializers or Queries.
- Activity editors belong in feature components, not page-sized condition blocks.

## Rules

- Use Entry and Exit language for humans unless code must name graph handles.
- Start routes can branch to multiple first activities.
- Exit portals are receiving activities and should not appear as normal route buttons.
- Grant activities must not let browser replay mint extra tools or items inside the same run.
- Activity-specific state that matters after refresh belongs in backend progress state.
- Sensitive translation content, answers or solution logic must not be broadly preloaded.

## UI Expectations

- Activity configuration should use the same broad settings-style layout as other configuration pages.
- Group options by responsibility instead of stacking every field in one pane.
- Provide previews for visual configuration when practical.
- Keep activity playback clear of the bottom navigation.

## Verification

Check graph connector warnings, persistence after save/reload, playback after refresh, and route continuation after skipped grants.
