# Purpose

Define the learner-facing world map as an explorable knowledge space.

The world map should replace rigid course hierarchies with spatial, connected learning areas while still supporting prerequisites, recommendations and competency-driven navigation.

# Core Concepts

- World: A collection of related maps.
- Map: A learning area displayed on a hex grid.
- Hex tile: Spatial position using axial coordinates.
- Node: Interactive location on a tile.
- Connection: Relationship or traversable path between nodes.
- Portal: Node that moves the learner between maps.
- Background state: Configurable map background that may change by time or preference.

# User Experience

## Learner Experience

Learners drag the map, inspect visible nodes, enter activities and travel through portals. They should feel guided but not controlled, with multiple valid learning journeys.

Unused tiles are invisible. Map background can be configured and may optionally change with wall-clock time, while user preferences override automatic changes.

## Admin Experience

Admins arrange nodes on a hex grid, define connections and portals, configure backgrounds and decide how progress changes visibility and access.

# Data Model Draft

`maps`
- purpose: Store learning areas.
- important_fields: `id`, `world_id`, `title`, `description`, `background_config_json`, `grid_config_json`, `time_background_enabled`.
- relationships: Has many nodes, connections and portals.

`nodes`
- purpose: Store interactive map locations.
- important_fields: `id`, `map_id`, `title`, `position_q`, `position_r`, `current_activity_id`, `visual_config_json`.
- relationships: Has many activities and state records.

`connections`
- purpose: Store paths or semantic links between nodes.
- important_fields: `id`, `map_id`, `source_node_id`, `target_node_id`, `connection_type`, `rules_json`, `visual_config_json`.
- relationships: Connects two nodes.

`portal_links`
- purpose: Store bidirectional or paired map transitions.
- important_fields: `id`, `source_node_id`, `target_node_id`, `travel_mode`, `visual_config_json`.
- relationships: Connects portal nodes.

`learner_map_states`
- purpose: Store user-specific map position and preferences.
- important_fields: `id`, `user_id`, `map_id`, `viewport_json`, `background_preference`, `last_visited_at`.
- relationships: Belongs to user and map.

# Relationships

A world has many maps. A map has many nodes and connections. A portal is implemented as a node plus a portal link to another node. Nodes contain activities that can change state and unlock paths.

# State and Lifecycle

Node display states may include `hidden`, `hinted`, `visible`, `locked`, `unlocked`, `recommended`, `active` and `completed`.

Map visit state may include `not_visited`, `visited`, `active`, `completed_enough` and `archived`.

# Configuration Options

Admins can configure map title, background, grid size, available nodes, portal links, connection rules, camera bounds, default zoom, time-based backgrounds and user preference behavior.

# Visual Configuration

Visuals are configurable per world and map. The same map system must support forest paths, medieval regions, fantasy realms, space sectors, workshops and minimal abstract layouts.

Configurable assets include background images, tile shape treatment, node icons, connection lines, travel animation, particles, sounds and theme classes.

# API / Backend Responsibilities

The backend should provide map data, resolve learner-specific visibility and unlock states, return portal targets, persist map preferences and calculate recommendations.

It should avoid sending undiscovered hidden content unless the learner has permission or an active lens/tool reveals it.

# Frontend Responsibilities

The frontend renders the hex grid, draggable viewport, nodes, connections, portals, backgrounds, state changes and transitions between maps.

It should smoothly fade background changes and preserve accessibility for keyboard and reduced motion.

# Admin Interface

Required screens include visual map editor, background settings, portal editor, connection editor and learner preview.

# Permissions and Privacy

Learners see only content resolved for them. Admins can preview as roles or learners if authorized. Hidden content should remain private unless configured otherwise.

# Edge Cases

- Portal target map is unpublished.
- Background changes during an active activity.
- Node exists without activities.
- Learner completed a node that later becomes hidden.
- Connection points to deleted node.

# Open Questions

- Should portals always be paired, or can one-way portals exist?
- How large can maps become before pagination or streaming is needed?
- Should learners be able to bookmark map locations?

# MVP Scope

- Render one world with multiple maps.
- Hex coordinate nodes.
- Draggable map.
- Basic node states.
- Bidirectional portals.
- Configurable static backgrounds.

# Later Extensions

- Time-based background changes.
- Dynamic events.
- World bosses.
- Advanced recommendation paths.
- Collaborative group map states.
