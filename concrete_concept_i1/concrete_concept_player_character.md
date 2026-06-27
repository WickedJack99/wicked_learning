# Purpose

Define the persistent learner companion as the personal interface for knowledge, tools, inventory and future learner systems.

The companion should represent what the learner knows and can do. It should not become a traditional RPG avatar with combat stats or competitive power levels.

# Core Concepts

- Learner companion: Persistent personal UI anchor.
- Interaction zone: Clickable/tappable region that opens a personal system.
- Tool belt: Display of acquired exploration tools.
- Inventory pouch: Access to items and artifacts.
- Companion customization: Lightweight identity settings.
- Personal capability: Unlockable way to interact with worlds.

# User Experience

## Learner Experience

On desktop, the companion appears as a side panel with character visualization, tool belt, inventory and constellation access. On mobile, a companion button opens the panel as a bottom sheet or full-screen view.

Learners should feel they gained possibilities: new tools, artifacts, map interactions and knowledge views.

## Admin Experience

Admins configure which companion systems are enabled, what interaction zones exist and which rewards appear in the companion UI.

# Data Model Draft

`learner_companions`
- purpose: Store per-user companion settings.
- important_fields: `id`, `user_id`, `appearance_json`, `layout_preferences_json`, `created_at`.
- relationships: Belongs to user.

`companion_zones`
- purpose: Define clickable regions and target systems.
- important_fields: `id`, `key`, `label`, `target_system`, `sort_order`, `enabled`, `visual_config_json`.
- relationships: May be global or theme-specific.

`companion_customization_options`
- purpose: Store available appearance options.
- important_fields: `id`, `category`, `name`, `asset_id`, `requirements_json`, `enabled`.
- relationships: Selected by learner companion.

`learner_capabilities`
- purpose: Store unlocked personal capabilities.
- important_fields: `id`, `user_id`, `capability_key`, `source_type`, `source_id`, `unlocked_at`.
- relationships: May be granted by activities, tools or competencies.

# Relationships

A user has one companion. The companion links to inventory, tools and constellation. Interaction zones route to personal systems. Capabilities may affect world interactions and node visibility.

# State and Lifecycle

Companion feature states: `unavailable`, `available`, `new`, `viewed`, `active`.

Customization states: `locked`, `available`, `selected`, `disabled`.

Capabilities are usually permanent, but the architecture should allow temporary capabilities for events.

# Configuration Options

Admins can configure enabled zones, default appearance options, mobile behavior, desktop panel width, tool belt capacity, visual presets and whether customization options have unlock requirements.

# Visual Configuration

The companion must be world-style neutral. It may be a person, abstract shape, robot, familiar, sigil, spacecraft console or minimal profile object depending on theme.

Visual configuration should use assets, zones, icons, colors, animations and layout metadata rather than assuming body parts always exist.

# API / Backend Responsibilities

The backend should provide companion settings, available customization options, unlocked capabilities and personal system summaries.

It should validate customization choices against availability rules.

# Frontend Responsibilities

The frontend should render the desktop side panel, mobile companion button, interaction zones, tool belt, inventory access and constellation launch transition.

It should support pointer, keyboard and touch interactions.

# Admin Interface

Required screens include companion system settings, interaction zone editor, customization option catalogue and capability mapping.

# Permissions and Privacy

Learners can edit their own companion appearance. Admins can configure available options but should not casually inspect personal customization unless needed for moderation.

# Edge Cases

- A theme has no humanoid body zones.
- A selected customization option is later disabled.
- Mobile inventory interaction conflicts with map gestures.
- A capability is removed from configuration after learners earned it.

# Open Questions

- Should companion customization unlock through learning, admin grants or both?
- Should capabilities ever expire?
- How abstract can the companion be while preserving discoverability?

# MVP Scope

- Desktop companion panel.
- Mobile companion button and sheet.
- Access points for inventory, tools and constellation.
- Basic appearance settings.
- Capability list exposed to world interactions.

# Later Extensions

- More interaction zones.
- Theme-specific companion rigs.
- Personal habits or wellbeing systems.
- Animated companion states.
- Learner-authored companion notes.
