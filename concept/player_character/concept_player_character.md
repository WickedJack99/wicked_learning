# Learner Companion Character

## Overview

The platform includes a persistent learner companion character.

The character is not intended to function as a traditional RPG avatar.

Instead, it acts as a visual representation of the learner and serves as a central interaction hub for personal systems within the platform.

The character provides a consistent location for accessing:

* Knowledge Constellation
* Inventory
* Tools
* Artifacts
* Personal progression systems
* Future personal features

The character should feel like a companion and extension of the learner rather than a game character that levels up.

---

# Design Philosophy

The character should not primarily represent power, status or numerical progression.

The platform intentionally avoids traditional RPG concepts such as:

* Character levels
* Strength values
* Dexterity values
* Equipment scores
* Combat statistics

Instead, visible progression should be represented through:

* Acquired tools
* Knowledge artifacts
* Exploration capabilities
* Learning history
* Personal knowledge visualization

The character reflects what the learner knows and can do rather than how many points have been earned.

---

# Persistent User Interface Element

On desktop devices, the character should remain visible as a persistent side panel.

The panel serves as a permanent anchor point within the application.

Benefits:

* Immediate access to inventory
* Immediate access to tools
* Consistent interaction model
* Improved discoverability of personal systems

The character should not float freely on top of the interface.

Instead, it should exist inside a dedicated companion panel with a clearly visible boundary.

Example content:

* Character visualization
* Tool belt
* Inventory access
* Knowledge Constellation access

The panel should remain visually lightweight while still being large enough for comfortable interaction.

---

# Mobile Experience

On mobile devices, screen space is significantly more limited.

The character should not permanently occupy part of the screen.

Instead, the character should be accessible through a floating companion button.

Selecting the button opens the full character panel as a bottom sheet or full-screen view.

This preserves map visibility while maintaining access to all companion systems.

---

# Character Interaction Zones

Different areas of the character may provide access to different systems.

Examples:

## Head

Opens the Knowledge Constellation.

The constellation represents the learner's evolving knowledge landscape.

---

## Tool Belt

Displays acquired exploration and interaction tools.

Examples:

* Knowledge Lens
* Engineering Toolkit
* Navigation Compass
* Climbing Boots

Tools may unlock new world interactions.

---

## Inventory Pouch

Provides access to collected artifacts and inventory items.

Examples:

* Key Stones
* Competency Artifacts
* Quest Items
* Special Objects

---

## Future Body Regions

Additional systems may be attached to other parts of the character later.

Examples:

* Habits
* Fitness
* Wellbeing
* Social systems

The architecture should support future expansion without requiring major redesign.

---

# Character Customization

The character should support lightweight personalization.

Customization exists to encourage identification with the learner companion rather than to create competitive status systems.

Possible customization options:

* Body style
* Skin tone
* Hair style
* Hair color
* Clothing style
* Companion appearance

The platform should avoid customization systems primarily based on rarity, prestige or social comparison.

---

# Visible Progression

Progress should be reflected through meaningful changes.

Examples:

* New tools appearing on the belt
* New artifacts appearing in the inventory
* Expanded Knowledge Constellation
* New interaction capabilities

The learner should feel:

```text
I gained new possibilities.
```

rather than:

```text
My level increased.
```

---

# Inventory Integration

The inventory should be tightly integrated with the companion character.

The learner should always know where inventory access is located.

Inventory items may be used directly within the learning world.

Examples:

* Insert a key stone into a gateway
* Activate a portal
* Unlock a hidden path
* Interact with world objects

---

# Mobile-Friendly Item Interaction

The platform should support item interactions on both desktop and mobile devices.

Desktop:

```text
Drag item
↓
Drop item on target
```

Mobile:

```text
Long press item
↓
Item becomes held
↓
Inventory closes
↓
Move item across interface
↓
Place item on target
```

This allows inventory-driven interactions without relying on desktop-specific drag-and-drop behavior.

---

# Core Principle

The learner companion should function as a personal interface to knowledge, tools and exploration.

The character should not answer:

```text
How powerful am I?
```

Instead, it should answer:

```text
What do I know?
What can I do?
What have I discovered?
Where can I go next?
```
