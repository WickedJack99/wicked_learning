# Concrete Concept Template

## 1. Purpose

Explain what this system is responsible for.

Answer:

* Why does this system exist?
* What problem does it solve?
* What should it not do?

---

## 2. Core Concepts

Define the main domain objects.

Example:

```text
Map
Node
Activity
Connection
Condition
Visual State
```

Each concept should have a short explanation.

---

## 3. User Experience

Describe how learners or admins interact with this system.

Separate if needed:

```text
Learner Experience
Admin Experience
```

---

## 4. Data Model Draft

Suggest database tables or entities.

For each table/entity include:

```text
table_name
purpose
important_fields
relationships
```

Example:

```text
nodes
- id
- map_id
- title
- position_q
- position_r
- current_activity_id
- visual_config_json
```

---

## 5. Relationships

Describe how objects connect.

Example:

```text
A map has many nodes.
A node has many activities.
A node can have many incoming and outgoing connections.
An activity may define the node's current visual state.
```

---

## 6. State and Lifecycle

Describe possible states and transitions.

Example:

```text
hidden
hinted
visible
locked
unlocked
active
completed
```

Also explain what changes these states.

---

## 7. Configuration Options

List what admins can configure.

Examples:

```text
title
description
visuals
conditions
activity order
unlock behavior
AI generation settings
tags
```

---

## 8. Visual Configuration

Describe how visuals are customized.

Include:

```text
icons
images
animations
particles
theme classes
colors
sound effects
```

The system should support different world themes such as nature, medieval, space, workshop or minimal.

---

## 9. API / Backend Responsibilities

Describe what the backend must provide.

Example:

```text
CRUD endpoints
state calculation
visibility resolution
progress tracking
permission checks
AI generation jobs
```

No exact routes required yet, but Codex may suggest them.

---

## 10. Frontend Responsibilities

Describe what React must render or handle.

Example:

```text
display map
render nodes
open activity panels
handle drag and drop
show visibility states
apply active lens
```

---

## 11. Admin Interface

Describe required admin screens or panels.

Example:

```text
Tree view
Map editor
Activity editor
Visibility rules editor
Feedback overview
Visual style picker
```

---

## 12. Permissions and Privacy

Define who can see or change what.

Example:

```text
Learners can see available nodes.
Admins can edit all nodes.
Admin-only tags are not visible to learners.
Feedback is anonymized.
```

---

## 13. Edge Cases

List likely tricky cases.

Examples:

```text
A node has no activities.
A connection points to a deleted node.
A visibility rule references a missing item.
A learner has completed a node that later becomes hidden.
```

---

## 14. Open Questions

List unresolved decisions.

This is important.

Codex should not pretend everything is solved.

Example:

```text
Should completed hidden nodes remain visible to learners?
How should conflicting visibility rules be resolved?
Should activity order be strict or branching?
```

---

## 15. MVP Scope

Define the smallest useful implementation.

Example:

```text
For the first implementation:
- Create maps
- Create nodes
- Position nodes on a hex grid
- Add simple activities
- Add basic visibility rules
```

---

## 16. Later Extensions

List ideas that should not be implemented immediately.

Example:

```text
Community marketplace
Advanced animation packs
AI-generated activity chains
Guild-specific paths
```
