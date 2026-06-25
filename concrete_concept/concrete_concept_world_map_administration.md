# Purpose

Define the world builder administration interface for managing both content structure and spatial map design.

The system should provide synchronized structure and map views over the same data. It should not split content and visuals into disconnected systems.

# Core Concepts

- Structure view: Tree-based content management.
- Map view: Visual hex-grid world editor.
- World object: Map, node, connection, portal or activity.
- Configuration panel: Context editor for selected object.
- Portal counterpart: Linked node on another map.

# User Experience

## Learner Experience

Learners do not use the admin builder, but they benefit from coherent worlds where structure and visuals stay synchronized.

## Admin Experience

Admins use structure view for large-scale content organization and map view for spatial design. Selecting an object opens a configuration panel without losing context.

# Data Model Draft

`worlds`
- purpose: Group maps and shared configuration.
- important_fields: `id`, `title`, `description`, `slug`, `visual_config_json`, `default_settings_json`.
- relationships: Has many maps.

`maps`
- purpose: Store individual learning areas.
- important_fields: `id`, `world_id`, `title`, `description`, `parent_map_id`, `background_config_json`, `sort_order`.
- relationships: Has many nodes and connections.

`nodes`
- purpose: Store map locations.
- important_fields: `id`, `map_id`, `title`, `node_kind`, `position_q`, `position_r`, `visual_config_json`, `metadata_json`.
- relationships: Has many activities.

`admin_editor_sessions`
- purpose: Optional collaboration and draft tracking.
- important_fields: `id`, `user_id`, `object_type`, `object_id`, `mode`, `started_at`, `last_seen_at`.
- relationships: References edited object.

# Relationships

A world has many maps. A map has many nodes. A node has many activities. A portal node references a counterpart portal on another map.

# State and Lifecycle

Admin content states: `draft`, `review`, `published`, `archived`.

Animation state configuration may include `vanish`, `appear`, `focused`, `unfocused`, `hover`, `leave`, `click` and `unclicked`.

# Configuration Options

Admins can configure titles, descriptions, icons, backgrounds, unlock rules, visibility rules, activities, portal targets, animations, particles, sound tokens and node metadata.

# Visual Configuration

The builder must treat visuals as configurable assets and tokens. Node kinds such as lesson, portal or merchant are semantic hints, not fixed graphics.

Portal counterparts should share a configurable marker color or symbol in the structure view.

# API / Backend Responsibilities

The backend should provide CRUD for worlds, maps, nodes, connections, activities and portal links. It should validate portal counterparts and prevent broken references where possible.

It should support draft/publish workflows if content state exists.

# Frontend Responsibilities

The frontend should render a file-explorer-like structure view, a hex map editor, object configuration panels, drag/move behavior, previews and immediate synchronization between views.

# Admin Interface

Required screens include structure tree, map editor, node configuration panel, activity panel, portal linker, visual state editor and preview mode.

# Permissions and Privacy

Only authorized admins can edit world structure. Content authors may have restricted access to assigned worlds or maps. Published learner data should not be changed destructively without migration handling.

# Edge Cases

- Portal counterpart is deleted.
- Node is moved onto an occupied tile.
- Structure tree rename conflicts with map title.
- Animation token is unavailable in selected theme.
- Two admins edit the same node.

# Open Questions

- Is collaborative editing needed in MVP?
- Should map and node edits publish immediately or through drafts?
- Should node kind be free-form, catalogue-based or both?

# MVP Scope

- Structure tree for worlds, maps and nodes.
- Hex map editor with create, move and delete nodes.
- Node configuration panel.
- Portal counterpart linking.
- Basic visual configuration and preview.

# Later Extensions

- Collaborative editing locks.
- Version history.
- Animation timeline editor.
- Bulk import/export.
- Theme package preview.
