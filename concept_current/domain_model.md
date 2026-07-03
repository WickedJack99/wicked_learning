# Domain Model

## Current Tables

- `learning_worlds`: top-level themed learning spaces.
- `learning_maps`: hex-map learning areas inside a world.
- `learning_nodes`: places on a map, positioned with axial `q` and `r` coordinates.
- `learning_activities`: interactions inside nodes.
- `activity_transitions`: graph edges from one activity to another.
- `dialogue_stages`: staged NPC dialogue content.
- `learning_questions`: question configuration for question activities.
- `learning_question_options`: answer options with optional outcome keys and weights.
- `learner_activity_progress`: minimal reached/completed activity state.
- `learner_question_answers`: selected answers and feedback history.

## Design Direction

Nodes are places. Activities are what happens there.

This keeps the system generic enough for different domains: cybersecurity nodes can be servers or signal gates, medieval nodes can be towers or camps, and astronomy nodes can be planets or stations without changing the core model.
