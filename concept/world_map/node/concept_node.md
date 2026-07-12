# concept_node.md

# Nodes

## Overview

A node is a place on a map.

Nodes are not fixed gameplay types like "merchant", "boss" or "lesson".  
Instead, a node acts as a configurable world location that can contain one or more activities.

This allows the same system to support many visual themes and learning worlds.

Examples:

- Medieval world: gate, tower, merchant camp, cursed forest
- Space world: station, planet, wormhole, satellite
- Nature world: grove, bridge, lookout, river bend
- Craft world: workshop, tool shelf, sketch table, kiln
- Minimal world: abstract shapes, cards, portals

## Core Idea

A node answers:

```text
Where is something happening?
````

Activities answer:

```text
What happens there?
```

## Node Properties

A node should support:

```text
id
map_id
title
description
position_q
position_r
visual_state
current_activity_id
default_visuals
visibility_rules
unlock_rules
connection_rules
metadata
```

## Hex Grid Position

Nodes are placed on a hexagonal grid.

Suggested coordinate system:

```text
q
r
```

using axial hex coordinates.

## Visual State

The node should visually reflect its current state.

Examples:

```text
Barrier blocks the path
New challenge appears
Merchant is available
Portal is active
Challenge is completed
```

The current activity may override the node's visual appearance.

## Custom Visuals

All visuals should be configurable.

A node may define:

```text
background_image
icon
animation
particle_effect
border_style
glow_style
sound_effect
theme_class
```

The system should not assume a specific art style.

## Node State Examples

```text
locked
available
active
completed
hidden
requires_tool
requires_competency
```

## Design Principle

Nodes are world locations.

They should be flexible enough to represent many different themes without changing the technical model.

````
