# Purpose

Define rewards, inventory and exploration tools as meaningful capability systems.

Items should make learning progress tangible and unlock interactions. They should not exist mainly as points, rarity badges or external incentives.

# Core Concepts

- Inventory item: A collectible or usable object.
- Knowledge artifact: Item representing mastery or milestone evidence.
- Exploration tool: Persistent capability that enables interactions.
- Tool component: Partial item that contributes to a completed tool.
- World target: Node, connection or activity that can react to an item or tool.

# User Experience

## Learner Experience

Learners open inventory from the companion and use items on world elements. On desktop this can use drag and drop. On mobile it should support long press, hold, close inventory and place on target.

Rewards should feel like "I can do something new now."

## Admin Experience

Admins define items, tools, components, requirements, target interactions and competency links. They can decide whether an item is cosmetic, consumable, persistent or required for access.

# Data Model Draft

`item_definitions`
- purpose: Store reusable item and artifact definitions.
- important_fields: `id`, `key`, `name`, `description`, `item_type`, `stackable`, `consumable`, `visual_config_json`.
- relationships: Has learner inventory records.

`learner_inventory_items`
- purpose: Store owned items.
- important_fields: `id`, `user_id`, `item_definition_id`, `quantity`, `state`, `acquired_at`, `source_type`, `source_id`.
- relationships: Belongs to user and item definition.

`tool_definitions`
- purpose: Store persistent exploration tools.
- important_fields: `id`, `key`, `name`, `description`, `capability_key`, `visual_config_json`.
- relationships: Has component requirements and learner tools.

`learner_tools`
- purpose: Store unlocked tools.
- important_fields: `id`, `user_id`, `tool_definition_id`, `state`, `unlocked_at`.
- relationships: Belongs to user and tool definition.

`world_interaction_requirements`
- purpose: Define item/tool requirements for targets.
- important_fields: `id`, `target_type`, `target_id`, `requirement_type`, `required_key`, `quantity`, `consume_on_use`.
- relationships: References nodes, connections or activities.

# Relationships

Activities can grant items, tools or components. Tools can unlock capabilities. Nodes, connections and activities can require items, tools, artifacts or competencies.

# State and Lifecycle

Inventory item states: `owned`, `held`, `used`, `consumed`, `disabled`.

Tool states: `locked`, `partial`, `available`, `equipped`, `disabled`.

World interaction states: `not_applicable`, `requires_item`, `requires_tool`, `ready`, `activated`, `completed`.

# Configuration Options

Admins can configure item type, quantity behavior, consumable behavior, grant source, requirements, component lists, competency links, target reactions and whether learners can inspect missing requirements.

# Visual Configuration

Inventory visuals must be configurable. A leather pouch is one possible theme, but cyber, space, fantasy and minimal worlds may use panels, cargo holds, spellbooks, utility belts or abstract grids.

Configurable visuals include item icon, slot style, drag ghost, use animation, disabled state, target highlight and success effect.

# API / Backend Responsibilities

The backend should manage inventory ownership, validate item use, enforce requirements, consume items when configured and grant capabilities from tools.

It should expose target eligibility so the frontend can highlight valid interactions.

# Frontend Responsibilities

The frontend renders inventory, tool belt, item details, drag/drop and mobile hold interactions. It should show valid world targets without revealing hidden content unless allowed.

# Admin Interface

Required screens include item catalogue, tool catalogue, component builder, reward assignment panel and world interaction requirement editor.

# Permissions and Privacy

Learners can view and use their own inventory. Admins can configure definitions and inspect aggregate ownership. Manual item grants should be audited.

# Edge Cases

- Item is consumed but activation fails.
- Learner owns an item whose definition is disabled.
- Target requires multiple artifacts.
- Tool component source is deleted.
- Mobile long-press conflicts with scrolling.

# Open Questions

- Should items be tradable between learners?
- Should tools need equipping, or are unlocked tools always active?
- How much missing-requirement information should hidden targets reveal?

# MVP Scope

- Item definitions and learner inventory.
- Tool definitions and learner tools.
- Activities can grant items or tools.
- Nodes or connections can require an item/tool.
- Basic desktop and mobile item use flow.

# Later Extensions

- Combining artifacts.
- Multi-step mechanisms.
- Temporary event items.
- Inventory sorting and filtering.
- Collaborative item requirements.
