# concept_activities.md

# Activities

## Overview

Activities define what happens inside a node.

A node is a place.  
An activity is an event, interaction or learning experience at that place.

A node may contain multiple activities.

Activities may be sequential, optional, conditional or repeatable.

## Core Idea

Activities answer:

```text
What happens here?
````

Examples:

```text
A merchant appears
A barrier blocks the way
The learner must use a tool
A scenario begins
A lesson is shown
A question is asked
A boss challenge starts
An artifact is awarded
A portal opens
```

## Activity Sequence

A node may contain a sequence of activities.

Example:

```text
1. Show barrier
2. Require the matching tool
3. Barrier disappears
4. New scene appears
5. Start scenario challenge
6. Ask competence questions
7. Award artifact
8. Unlock connection
```

## Activity Types

Possible activity types:

```text
dialogue
lesson
question
scenario
challenge
boss
merchant
tool_requirement
item_requirement
grant_item
grant_tool
grant_artifact
open_portal
unlock_connection
visual_change
ai_question_generation
reflection_prompt
external_resource
lab_task
custom_activity
```

## Activity Visual State

Each activity may define how the node should look while the activity is active.

Example:

```yaml
activity:
  type: tool_requirement
  required_tool: barrier_tool
  visual_state:
    icon: barrier
    animation: barrier_pulse
    particle_effect: sparks
```

Next activity:

```yaml
activity:
  type: scenario
  title: Garden Path Opens
  visual_state:
    icon: path
    animation: path_reveal
    particle_effect: soft_glow
```

## Activity Completion

Activities may have completion rules.

Examples:

```text
read content
answer question
use tool
submit reflection
solve challenge
complete lab
admin approval
AI evaluation
```

## Activity Conditions

An activity may only become available if conditions are fulfilled.

Examples:

```text
requires item
requires tool
requires completed previous activity
requires competency level
requires date/time window
requires group membership
```

## Repeatable Activities

Some activities may be repeatable.

Examples:

```text
spaced repetition questions
practice challenges
daily reflection
training labs
```

## AI Activities

Activities may use AI for generation or evaluation.

Examples:

```text
generate scenario question
generate follow-up question
evaluate open-ended answer
provide competence feedback
generate boss challenge
```

## Custom Visual Themes

Activities should not assume a fixed genre.

The same activity model should support:

```text
Nature world:
A fallen tree blocks the path.

Medieval world:
A magical barrier blocks the gate.

Space world:
A force field blocks the airlock.
```

The activity logic is the same.

Only the visuals and text change.

## Design Principle

Activities should make nodes feel alive.

The world should react to learner progress, tools, knowledge and choices.

```
