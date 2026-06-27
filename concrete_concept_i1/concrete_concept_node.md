# Purpose

Define nodes as configurable world locations on a map.

Nodes answer where something happens. Activities answer what happens there. This separation keeps the system flexible across any visual theme.

# Core Concepts

- Node: A location on a map.
- Hex position: Axial coordinates `q` and `r`.
- Current activity: Activity currently determining node behavior or visuals.
- Visual state: Semantic state rendered through configurable visuals.
- Node metadata: Extensible data for admin organization and future systems.

# User Experience

## Learner Experience

Learners see nodes as places in the world: servers, gates, planets, abstract symbols or anything a theme defines. Entering a node opens its available activities.

## Admin Experience

Admins place nodes, configure titles and descriptions, attach activities, set rules and choose visual states.

# Data Model Draft

`nodes`
- purpose: Store map locations.
- important_fields: `id`, `map_id`, `title`, `description`, `position_q`, `position_r`, `current_activity_id`, `node_kind`, `visual_config_json`, `metadata_json`.
- relationships: Belongs to map; has many activities.

`node_visual_states`
- purpose: Store reusable semantic visual states.
- important_fields: `id`, `node_id`, `state_key`, `visual_config_json`, `priority`.
- relationships: Belongs to node.

`learner_node_states`
- purpose: Store learner-specific node progress.
- important_fields: `id`, `user_id`, `node_id`, `visibility_state`, `unlock_state`, `activity_state`, `completed_at`, `last_visited_at`.
- relationships: Belongs to user and node.

# Relationships

A map has many nodes. A node has many activities. A node may have incoming and outgoing connections. A node may be a portal if linked to another portal node.

# State and Lifecycle

Node states include `hidden`, `hinted`, `visible`, `locked`, `unlocked`, `recommended`, `active`, `completed`, `requires_tool` and `requires_competency`.

State is calculated from rules, learner progress, activity state and admin toggles.

# Configuration Options

Admins can configure title, description, position, node kind, default visuals, activities, visibility rules, unlock rules, connection rules, metadata, tags and current activity behavior.

# Visual Configuration

Node visuals include icon, background image, animation, particles, border, glow, sound and theme class. All fields should be optional and resolved through theme defaults when missing.

No visual field should require a cyber, medieval, fantasy, space or minimal style.

# API / Backend Responsibilities

The backend should provide node CRUD, validate hex positions, calculate learner node states and resolve current activity visual overrides.

# Frontend Responsibilities

The frontend renders nodes at hex coordinates, applies semantic visual state, opens activity panels and handles hover, click and focus interactions.

# Admin Interface

Required screens include node editor, visual state editor, activity attachment, rule editor and map placement tools.

# Permissions and Privacy

Learners can see and enter nodes allowed by resolved state. Admin-only metadata and tags are hidden from learners.

# Edge Cases

- Two nodes share the same position.
- Current activity is deleted.
- Node has no activities.
- Learner completed node before rules changed.
- Visual config references missing asset.

# Open Questions

- Should a node require at least one activity to be published?
- Should node kind be semantic only or drive default behavior?
- How should completed state behave if new activities are added?

# MVP Scope

- Node CRUD.
- Axial hex positions.
- Node-to-activity relationship.
- Basic learner node state.
- Configurable visual JSON.

# Later Extensions

- Node templates.
- Multi-tile nodes.
- Dynamic node spawning.
- Advanced animation states.
