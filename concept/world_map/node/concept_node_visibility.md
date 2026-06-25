# concept_node_visibility.md

# Node Visibility and Unlocking

## Overview

Visibility and unlocking should be configurable through rules.

The platform should not force a single learning progression model.

Admins may create:

- Linear paths
- Open maps
- Recommended paths
- Hidden areas
- Timed events
- Challenge shortcuts
- Competency-based unlocks

## Visibility vs Unlocking

Visibility and unlocking are separate concepts.

```text
visible = learner can see it
unlocked = learner can access it
````

Example:

```text
visible: true
unlocked: false
```

The learner can see the node, but cannot enter it yet.

## Visibility States

Possible visibility states:

```text
hidden
hinted
visible
```

### Hidden

The node is not shown.

### Hinted

The learner sees that something exists, but not exactly what.

Example:

```text
???
Mysterious portal
Fog-covered tile
```

### Visible

The node is fully visible.

## Unlock States

Possible unlock states:

```text
locked
unlocked
recommended
```

### Locked

The learner cannot access the node yet.

### Unlocked

The learner can access the node.

### Recommended

The node is accessible, but the platform visually suggests completing another node first.

## Rule Types

Rules may be based on:

```text
completed_node
completed_activity
owned_item
owned_tool
competency_level
date_time
manual_admin_toggle
group_membership
role
custom_condition
```

## Timed Visibility

Admins may schedule nodes to appear and disappear.

Example:

```yaml
visible_from: 2026-10-01T08:00:00
visible_until: 2026-10-31T23:59:00
```

This can be used for temporary events.

## Connection-Based Progression

Nodes may be connected by paths.

Connections may be:

```text
locked
unlocked
recommended
hidden
```

A connection can be visible and recommended without being required.

Example:

```text
Node A -> Node B
recommended: true
unlocked: true
```

Meaning:

```text
It is recommended to complete Node A before Node B, but Node B is already accessible.
```

## Multiple Incoming and Outgoing Connections

A node may have multiple incoming and outgoing connections.

This allows multiple valid learning paths.

Example:

```text
Beginner path -> Advanced node
Challenge shortcut -> Advanced node
Alternative path -> Advanced node
```

## Design Principle

The platform should guide learners without forcing a single path unless the admin explicitly configures it that way.

````