# World Builder Administration Interface

The administration interface should provide two different views of the same world structure:

## Structure View

The structure view represents all worlds, maps and nodes as a directory tree similar to a file explorer or wiki page hierarchy.

Example:

```text
Elastic World/
├─ ECE Basics/
│  ├─ Portal: Fleet & Agents
│  ├─ Lesson: Data Tiers
│  └─ Boss: Capacity Planning
├─ Detection Engineering/
│  ├─ Lesson: EQL Rules
│  └─ Merchant: Rule Templates
└─ Troubleshooting/
   └─ Portal: JVM Memory Pressure
```

Maps are represented as directories.

Interactive objects inside a map are represented as leaf nodes.

Different node types should use different icons to make navigation intuitive.

Possible node types:

* Lesson
* Portal
* Boss
* Merchant
* Random Event
* Quiz
* Lab
* NPC
* External Link
* Custom Node

Selecting a node opens a configuration panel where all properties can be edited directly without leaving the structure view.

Examples:

* Title
* Description
* Icon
* Background image
* Unlock conditions
* Visibility rules
* Linked activities
* Portal targets
* Particle effects / animations

when clicked, opens panel to configure the tile, choose type, background graphics, set animations for state and animation time (time optional, uses default of animation)
states can be "vanish", "appear", "focused", "unfocused", "on hover", "on leave", "on click", "on unclicked"

## Portal nodes

Portal nodes do have a counterpart on some other map, they are visually marked on the tree structure view with the same colour / an extra symbol next to their portal icon to display their connection.

## Map View

Each map can be opened in a visual world editor.

The map view displays the actual hexagonal tile layout that learners will see.

The purpose of this view is spatial design rather than content management.

Possible actions:

* Move tiles
* Create new tiles
* Delete tiles
* Connect tiles
* Configure tile appearance
* Place portals
* Preview animations
* Edit background imagery
* Configure particle effects

The map view should feel similar to a game world editor.

## Design Principle

The structure view is optimized for managing content.

The map view is optimized for designing experiences.

Both views operate on the same underlying data model and remain synchronized.

Changes made in one view are immediately reflected in the other.

This allows administrators to efficiently manage large knowledge structures while still creating visually engaging learning worlds.
