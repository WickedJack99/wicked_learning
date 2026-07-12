# Learning World Map Concept

## Overview

The learning platform is built around the concept of interactive world maps rather than traditional course hierarchies.

Instead of navigating through linear chapters and modules, learners explore interconnected learning worlds represented as hexagonal maps.

The goal is to create a sense of exploration, discovery and personal learning journeys while maintaining a clear knowledge structure.

## Maps

A map represents a learning area.

Examples:

* Astronomy
* Botany
* Programming
* History
* Language practice

Each map contains multiple nodes positioned on a hexagonal grid.

Maps may contain portals to other maps, creating a network of interconnected learning worlds.

There is no hard limit on the depth of the map hierarchy.

A map may contain portals to:

* Child maps
* Parent maps
* Sibling maps
* Completely unrelated maps

This allows administrators to create both hierarchical and non-linear learning structures.

Portals have a counterpart on the other map to travel seemlessly between them.

## Hexagonal Grid

Maps are displayed using a hexagonal tile layout.

Hexagonal grids provide several advantages:

* Natural exploration
* Equal movement directions
* Organic world-like layouts
* Better visual variety than rectangular grids

The grid serves as a spatial representation of knowledge rather than a strict progression path.

The grid is dragable by mouse when holding left mouse button and moving the mouse.

Each map should have a configurable background behind the tile view. Also render unused tiles invisible.
Add an option to settings where background changes based on wall clock time, with user preferrances overwrite.
On change fade out / in.

## Nodes

Each tile on a map contains a node.

Nodes represent interactive elements within the learning world.

Maps contain nodes.
Nodes contain activities.
Activities may unlock connections.

## Portals

Portals are special nodes that connect different maps.

Portals serve as transitions between learning areas.

Inspired by world navigation systems found in exploration-based games, portals allow learners to travel through a larger knowledge universe.

Examples:

```text
Astronomy World
  â””â”€â”€ Portal
        â””â”€â”€ Planetary Motion

Planetary Motion
  â””â”€â”€ Portal
        â””â”€â”€ Gravity Practice
```

Portals may also connect unrelated learning areas when meaningful relationships exist.

Example:

```text
Botany Basics
  â””â”€â”€ Portal
        â””â”€â”€ Soil and Water
```

## Dynamic World Progression

The learning world is not necessarily static.

Nodes and portals may appear, disappear or change state depending on learner progress.

Examples:

* A portal appears after completing a challenge.
* A boss becomes available after reaching a competency threshold.
* A hidden area is revealed after discovering specific content.
* An advanced learning path unlocks after mastering prerequisite concepts.

The world should feel responsive to the learner's growth.

## Exploration over Linear Progression

Traditional learning platforms often force learners through predefined sequences.

The world map encourages exploration while still allowing administrators to define prerequisites and recommended paths.

Learners should feel guided but not controlled.

The platform should support multiple valid learning journeys through the same content.

## Competency-Based Navigation

Progress is primarily driven by competency development rather than simple completion counts.

The system should be capable of:

* Associating nodes with competencies
* Tracking competency growth
* Unlocking new opportunities based on demonstrated understanding
* Recommending learning paths based on competency gaps

The world map becomes a visual representation of the learner's knowledge journey.

## Design Philosophy

The world map should feel less like a course catalog and more like an explorable knowledge universe.

The purpose is not to gamify learning through points and rewards, but to make knowledge visible, navigable and discoverable.

Learners should experience curiosity, autonomy and growing competence while exploring the world.
