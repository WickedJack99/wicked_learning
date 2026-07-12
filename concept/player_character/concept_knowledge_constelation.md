# Knowledge Constellation

## Overview

The Knowledge Constellation is a personal visualization of a learner's knowledge, activity and learning history.

It is inspired by star constellations rather than traditional skill trees.

Instead of representing progress through points, levels or linear unlock paths, the constellation visualizes how the learner's knowledge areas develop over time.

Each topic or competency is represented as a star.

Related topics may form constellations.

The constellation should feel like a personal night sky inside the learner's mind.

---

# Purpose

The Knowledge Constellation should help learners understand:

* Which topics they have explored
* Which topics they are currently focusing on
* Which competencies are strong
* Which competencies may need refreshment
* How different topics are connected

The goal is reflection, orientation and curiosity.

The constellation should not feel like a leaderboard, score system or external evaluation mechanism.

---

# Access Point

The constellation may be accessed through the learner's character.

Example:

* Clicking the character's head opens the Knowledge Constellation.
* The view transitions into a dark night-sky interface.
* Stars represent topics and competencies from the learning platform.

This creates a logical connection between the avatar and the learner's knowledge state.

---

# Star Representation

Each star represents one topic or competency.

Examples:

* Meadow Systems
* Craft Practice
* Pattern Reading
* Reflection
* Language Basics
* Collaboration

Stars have three visual layers:

1. Star size
2. Star brightness
3. Star aura

Each layer represents a different aspect of learning progress.

---

# Star Size: Long-Term Competence

Star size represents long-term competence.

A larger star means that the learner has demonstrated deeper or broader understanding in that topic.

Size should be influenced by meaningful learning events, not simple activity count.

Examples of competence-relevant events:

* Completing scenario-based questions
* Solving troubleshooting challenges
* Passing boss encounters
* Completing practical labs
* Demonstrating understanding in open-ended answers
* Successfully applying knowledge in higher-difficulty tasks

A beginner who completes many basic tasks should not automatically receive a larger star than an advanced learner who solves fewer but more complex tasks.

Difficulty and competence depth should matter.

---

# Star Brightness: Confidence in Competence

Star brightness represents the platform's confidence that the learner can still apply the competency.

Brightness should be influenced by:

* Recent successful demonstrations
* Difficulty of completed tasks
* Repetition over time
* Consistency of performance
* Time since the competency was last demonstrated

Unlike star size, brightness may decrease slowly over time if the learner has not refreshed or applied the topic recently.

However, brightness should not feel punitive.

The star should not disappear completely.

Instead, reduced brightness should gently indicate:

```text
This competency has not been refreshed recently.
```

---

# Star Aura: Current Learning Activity

The aura around a star represents current learning activity and attention.

A strong aura means the learner is currently engaging with this topic frequently.

The aura should react quickly to recent activity.

Examples:

* Reading modules
* Answering questions
* Repeating content
* Exploring related maps
* Completing exercises

Aura should fade faster than brightness.

This allows the constellation to show the difference between:

```text
I am competent in this topic.
```

and

```text
I am currently focused on this topic.
```

---

# Example Interpretation

## Large star, high brightness, strong aura

Meaning:

```text
The learner is highly competent in this topic and is currently actively working with it.
```

## Large star, medium brightness, weak aura

Meaning:

```text
The learner has built strong competence in this topic, but has not engaged with it recently.
```

## Small star, high aura

Meaning:

```text
The learner is currently exploring this topic, but long-term competence is still developing.
```

## Medium star, low brightness, no aura

Meaning:

```text
The learner has some history with this topic, but the platform has low recent confidence in the competency.
```

---

# Knowledge Decay Representation

Competence itself should not simply vanish.

The platform should avoid making learners feel that previously earned knowledge has been deleted.

Instead of shrinking the star aggressively, the system should represent knowledge decay through reduced brightness or subtle cloud-like overlays.

Possible visual metaphor:

* The star remains visible.
* The star becomes slightly dimmer.
* A soft cloud or mist partially covers it.
* The learner can refresh the topic to make it shine again.

This communicates refreshment needs without creating a punishment feeling.

---

# Constellation Connections

Related topics may be connected by subtle lines, dust trails or light particles.

The default view should avoid technical graph arrows.

Directed edges should not be shown as hard arrows because they can make the constellation look like a database graph.

Preferred visualizations:

* Soft constellation lines
* Star dust between related topics
* Moving light particles to indicate learning paths
* Gentle glow between frequently connected topics

Direction may be represented through motion rather than arrows.

Example:

```text
Small particles move from Meadow Systems toward Craft Practice if the learner often studies Meadow Systems before Craft Practice.
```

---

# Relationship Types

Connections may represent different kinds of relationships.

Examples:

* Admin-defined prerequisite relationship
* Thematic similarity
* Frequent learning sequence
* Shared competency group
* Learner-specific transition pattern

The system should support multiple relationship sources internally, even if the UI initially displays them in a simple way.

---

# Skill Tree Alternative

The Knowledge Constellation is intended as an alternative to a traditional skill tree.

Traditional skill trees often require points, levels and predefined unlock paths.

The constellation should instead represent learning as an evolving personal knowledge landscape.

It should support autonomy by showing possibilities and relationships rather than forcing a single path.

---

# Data Model Considerations

The implementation should store topic-level learning state separately from visual rendering.

Possible internal values per learner and topic:

```text
topic_id
competence_score
competence_confidence
recent_activity_score
last_activity_at
last_successful_demonstration_at
difficulty_weighted_progress
```

Possible derived visual properties:

```text
star_size
star_brightness
star_aura_strength
cloud_overlay_strength
```

The exact formula can be adjusted later.

The important concept is that visual properties are derived from learning state.

---

# Core Principle

The constellation should not say:

```text
You are level 17.
```

It should say:

```text
This is the current shape of your learning.
```

The learner should feel oriented, curious and encouraged to continue exploring.
