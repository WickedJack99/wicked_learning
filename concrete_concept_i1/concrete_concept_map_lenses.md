# Purpose

Define map lenses as learner-facing perception tools that reveal different meanings on the same world map.

The lens system should make data feel discoverable inside the world. It should not feel like ordinary dashboard filtering, and it should not assume one genre or art style.

# Core Concepts

- Lens: A selectable tool that changes map presentation.
- Lens effect: A visual or visibility transformation applied to nodes, connections or overlays.
- Lens availability rule: Requirement for using a lens.
- Lens visual preset: Theme-specific rendering for the same semantic effect.
- Lens layer: Data source shown by a lens, such as competency, activity type or recommendations.

# User Experience

## Learner Experience

Learners activate lenses from the companion tool belt or map controls. The map changes visually to show competency state, available activity types, hidden objects, recommendations or events.

The default exploration lens shows the world normally.

## Admin Experience

Admins define available lenses, configure what each lens reveals and choose visual presets per world or map.

# Data Model Draft

`lenses`
- purpose: Store available lens definitions.
- important_fields: `id`, `key`, `name`, `description`, `lens_type`, `enabled`, `default_enabled`, `visual_config_json`.
- relationships: Has many lens effects and availability rules.

`lens_effects`
- purpose: Define how a lens changes objects.
- important_fields: `id`, `lens_id`, `target_type`, `condition_json`, `effect_json`, `priority`.
- relationships: Belongs to lens.

`learner_lens_unlocks`
- purpose: Track which learners can use special lenses.
- important_fields: `id`, `user_id`, `lens_id`, `unlocked_at`, `source_type`, `source_id`.
- relationships: Belongs to user and lens.

`lens_visual_presets`
- purpose: Store theme-specific visuals for effects.
- important_fields: `id`, `lens_id`, `world_id`, `preset_json`, `enabled`.
- relationships: Optional world-specific override.

# Relationships

A lens has many effects. A learner may unlock many lenses. A map renders active lens effects against nodes, connections and overlays.

# State and Lifecycle

Lens states: `disabled`, `locked`, `available`, `active`.

Lens effect application should resolve by priority when multiple effects target the same visual property.

# Configuration Options

Admins can configure lens name, availability, affected data layer, node visibility changes, colors, glow, particles, connection visuals, overlays and whether a lens can reveal hidden objects.

# Visual Configuration

Each lens must support configurable visual language. A competency lens may use neon outlines, magic glow, orbital scans or plain abstract emphasis depending on world style.

Visual configuration should use semantic effects such as `highlight_strong`, `highlight_refresh_needed`, `reveal_hidden` and map them to assets per theme.

# API / Backend Responsibilities

The backend should expose available lenses, resolve unlocks and provide lens-ready map data. Sensitive hidden content should only be sent when the active lens and learner permissions allow it.

# Frontend Responsibilities

The frontend should render active lens effects, transitions, overlays and tool-belt activation. It should handle conflicts between base visuals, activity visuals and lens visuals predictably.

# Admin Interface

Required screens include lens catalogue, effect rule editor, visual preset editor, unlock requirement editor and map preview by lens.

# Permissions and Privacy

Learners can use unlocked lenses. Admin-only diagnostic lenses should be hidden from learners. Social or recommendation lenses must not expose private learner data.

# Edge Cases

- Multiple active lenses conflict.
- Lens reveals a node that is visible but still locked.
- Hidden object lens is unlocked after the map data was loaded.
- Visual preset is missing for a world.

# Open Questions

- Should multiple lenses be active at once?
- Which lenses are default platform features versus unlockable tools?
- Should recommendation explanations be visible in the lens view?

# MVP Scope

- Exploration lens.
- Competency lens.
- Activity type lens.
- Recommendation lens.
- Configurable visual effects for nodes and connections.

# Later Extensions

- Hidden object lens.
- Social lens.
- Event lens.
- Custom admin-created lenses.
- Lens marketplace presets.
