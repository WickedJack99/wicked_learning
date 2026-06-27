# Purpose

Define portal activities and portal nodes as transitions between maps.

The source file is currently empty, so this proposal expands the portal ideas from the world map concept.

# Core Concepts

- Portal node: A node whose primary purpose is map travel.
- Portal link: Relationship between source and target portal nodes.
- Counterpart portal: The node on the destination map.
- Travel condition: Requirement before travel is allowed.
- Travel transition: Configurable visual and state change when moving maps.

# User Experience

## Learner Experience

Learners activate a portal and move to another map. Portals can connect child, parent, sibling or unrelated maps when the knowledge relationship makes sense.

## Admin Experience

Admins create portal nodes, link counterparts, configure travel requirements and preview travel transitions.

# Data Model Draft

`portal_links`
- purpose: Store map-to-map travel relationships.
- important_fields: `id`, `source_node_id`, `target_node_id`, `bidirectional`, `travel_condition_json`, `visual_config_json`.
- relationships: Connects two portal nodes.

`portal_travel_events`
- purpose: Track learner travel history.
- important_fields: `id`, `user_id`, `portal_link_id`, `source_map_id`, `target_map_id`, `traveled_at`.
- relationships: Belongs to user and portal link.

`portal_activities`
- purpose: Store optional portal-specific activity settings.
- important_fields: `id`, `activity_id`, `requires_confirmation`, `arrival_behavior`, `transition_key`.
- relationships: Extends activity.

# Relationships

A portal node has a portal activity or direct portal link. A portal link references a source node and target node. Links may be bidirectional or one-way.

# State and Lifecycle

Portal states: `hidden`, `hinted`, `visible_locked`, `available`, `active`, `used`, `disabled`.

Travel can move through `requested`, `validated`, `transitioning`, `arrived` and `failed`.

# Configuration Options

Admins can configure source node, target node, bidirectionality, travel requirements, arrival map position, confirmation behavior, transition visuals and whether travel records are stored.

# Visual Configuration

Portals must be theme-neutral. They may appear as wormholes, doors, elevators, gateways, links, terminals or abstract transitions.

Configurable fields include portal icon, idle animation, activation animation, travel overlay, sound and counterpart marker.

# API / Backend Responsibilities

The backend should validate portal access, resolve target map, store travel events and prevent travel to unpublished or unauthorized maps.

# Frontend Responsibilities

The frontend should render portal state, handle activation, play configured transition and load the destination map at the correct arrival context.

# Admin Interface

Required screens include portal link editor, counterpart selector, travel condition editor and transition preview.

# Permissions and Privacy

Learners can use available portals only. Admins can see and edit all portal links. Travel history should be treated as progress/navigation data.

# Edge Cases

- Target portal is deleted.
- Source and target are on unpublished maps.
- One-way portal traps learner without return path.
- Learner loses requirement while transition is in progress.

# Open Questions

- Should portals require explicit activities, or can nodes directly link?
- Are one-way portals allowed in MVP?
- Should travel history influence recommendations?

# MVP Scope

- Bidirectional portal links.
- Access validation.
- Configurable transition token.
- Destination map load.
- Admin counterpart selector.

# Later Extensions

- One-way portals.
- Conditional arrival locations.
- Portal networks.
- Animated portal previews.
