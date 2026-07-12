# Purpose

Define how administrators manage reusable defaults for worlds, maps, nodes, activities, visuals, AI behavior and learning policies.

The source concept file is currently empty, so this is a conservative proposal based on the surrounding architecture. Defaults should reduce repeated configuration while still allowing local overrides.

# Core Concepts

- Default profile: A named bundle of reusable settings.
- Scope: The level where a default applies, such as global, world, map, node type or activity type.
- Override: A local value that replaces or extends an inherited default.
- Token: A reusable visual, behavior or policy value.
- Preset catalogue: Admin-managed library of defaults.

# User Experience

## Learner Experience

Learners do not interact with default management directly. They experience consistency: similar nodes behave predictably, visual states are coherent and activity feedback follows shared rules.

## Admin Experience

Admins can define defaults once and reuse them across content. They can override values when a specific world, map or activity needs special behavior.

# Data Model Draft

`default_profiles`
- purpose: Store named default bundles.
- important_fields: `id`, `name`, `description`, `scope_type`, `target_type`, `is_active`, `priority`, `created_by`.
- relationships: Has many default values.

`default_values`
- purpose: Store individual default fields.
- important_fields: `id`, `profile_id`, `key`, `value_json`, `merge_strategy`, `locked`.
- relationships: Belongs to default profile.

`default_assignments`
- purpose: Attach a profile to a world, map, node type or activity type.
- important_fields: `id`, `profile_id`, `assignable_type`, `assignable_id`, `starts_at`, `ends_at`.
- relationships: Connects profiles to configurable objects.

`configuration_overrides`
- purpose: Store local changes from inherited defaults.
- important_fields: `id`, `configurable_type`, `configurable_id`, `key`, `value_json`, `reason`.
- relationships: Belongs to any configurable object.

# Relationships

A default profile has many default values. A configurable object may inherit multiple profiles by scope and priority. Local overrides apply after inherited defaults.

# State and Lifecycle

Profiles move through `draft`, `active`, `deprecated` and `archived`.

When a default changes, affected objects should be marked `inherited_update_available`, `updated` or `locally_overridden`.

# Configuration Options

Admins can configure visual defaults, activity defaults, feedback defaults, AI generation defaults, learning design policies, privacy defaults, unlock defaults and admin UI defaults.

# Visual Configuration

Defaults may include icons, colors, animation names, particle presets, tile states, sound tokens and theme classes. These must be tokenized and style-agnostic so a nature world, medieval world, workshop world or minimal world can use the same semantic state with different assets.

# API / Backend Responsibilities

The backend should resolve effective configuration, validate default keys, apply inheritance rules and expose diffs between defaults and local overrides.

It should support previewing the impact of a profile change before applying it.

# Frontend Responsibilities

The frontend should show inherited values clearly, allow local overrides and make reset-to-default easy. Editors should preview effective configuration, not only raw local fields.

# Admin Interface

Required screens include default profile list, profile editor, assignment manager, override inspector and impact preview.

# Permissions and Privacy

Only admins with configuration permissions can edit defaults. Content authors may see inherited defaults and override only fields allowed by their role.

# Edge Cases

- Two active profiles set the same key. Review note: Check keys before creating a new one and deny creation if already existing.
- A default references a deleted visual asset. Review note: deny deletion of visual assets used by default, if deleted by workaround, ask at admin view to set new visual.
- A local override becomes invalid after a schema change. 
- An archived profile is still assigned to old content.

# Open Questions

- Should profile inheritance be single-parent or layered by priority? Review note: Question for next iteration; what are pro cons for single-parent, what for layered by priority?
- Which defaults should be locked against local overrides? Review not: Everything should be able to be overriden.
- Should existing content automatically update when defaults change? Review note: yes, if default was used.

# MVP Scope

- Global default profile.
- World-level default profile.
- Effective configuration resolution.
- Local override storage.
- Admin profile editor for visual and activity defaults.

# Later Extensions

- Versioned defaults with rollback.
- Bulk migration tools.
- Marketplace preset imports.
- Per-role default editing permissions.
