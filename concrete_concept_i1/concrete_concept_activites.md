# Purpose

Define activities as the interactive events, learning tasks and state changes that happen inside nodes.

Activities should make nodes feel alive while keeping node location separate from activity behavior.

# Core Concepts

- Activity: A learner interaction inside a node.
- Activity sequence: Ordered or conditional set of activities.
- Completion rule: Requirement that marks an activity complete.
- Activity condition: Requirement before an activity becomes available.
- Activity visual state: Optional override for node appearance.
- Activity effect: Result such as granting item or unlocking connection.

# User Experience

## Learner Experience

Learners enter a node and encounter one or more activities: lessons, dialogues, scenarios, challenges, tool requirements, reflection prompts or rewards.

Activities may be sequential, optional, repeatable or conditional.

## Admin Experience

Admins assemble activities into node experiences. They configure conditions, completion rules, visual changes, rewards and AI generation where appropriate.

# Data Model Draft

`activities`
- purpose: Store reusable or node-bound learning interactions.
- important_fields: `id`, `node_id`, `type`, `title`, `description`, `sort_order`, `repeatable`, `visual_state_json`, `config_json`.
- relationships: Belongs to node; has conditions, completion rules and effects.

Review note by human: activity shouldn't be bound to one node, instead one activity can be reused at different nodes. So maybe add activity templates and then insert them as concrete activity into activities when adding that template to a node. Open for you to adjust that design choice if you got better ideas.

`activity_conditions`
- purpose: Store availability requirements.
- important_fields: `id`, `activity_id`, `condition_type`, `condition_json`, `mode`.
- relationships: Belongs to activity.

`activity_completion_rules`
- purpose: Store completion criteria.
- important_fields: `id`, `activity_id`, `rule_type`, `rule_json`, `required`.
- relationships: Belongs to activity.

`activity_effects`
- purpose: Store outcomes triggered by activity completion.
- important_fields: `id`, `activity_id`, `effect_type`, `effect_json`, `trigger`.
- relationships: Belongs to activity.

`learner_activity_attempts`
- purpose: Store user attempts and submissions.
- important_fields: `id`, `user_id`, `activity_id`, `status`, `started_at`, `completed_at`, `result_json`.
- relationships: Belongs to user and activity.

# Relationships

A node has many activities. Activities can depend on previous activities, grant items, unlock connections, change visuals or create questions. A learner can have many attempts for repeatable activities.

# State and Lifecycle

Activity states: `unavailable`, `available`, `active`, `submitted`, `completed`, `failed`, `repeat_available`.

Authoring states: `draft`, `review`, `published`, `archived`.

# Configuration Options

Admins can configure activity type, order, repeatability, conditions, completion rules, rewards, visual state, AI settings, tags, feedback options and whether the activity is required for node completion.

# Visual Configuration

Activity visuals must be semantic and configurable. A `tool_requirement` could look like a firewall, magic barrier, force field or abstract lock depending on the world.

Configurable values include icon, animation token, particle effect, node override, panel layout, sound and transition.

# API / Backend Responsibilities

The backend should resolve available activities, validate submissions, apply completion rules, trigger effects, track attempts and expose repeatability rules.

AI generation and evaluation should run through explicit activity configurations and review workflows.

# Frontend Responsibilities

The frontend renders the activity panel, active node visual state, submissions, feedback, repeat flows and transitions between activities.

It should keep activity UI themeable and not assume fixed activity genres.

# Admin Interface

Required screens include activity list per node, activity editor, sequence builder, condition editor, completion rule editor, effect editor and activity preview.

# Permissions and Privacy

Learners can access available activities. Admin-only tags and analytics are hidden from learners. Attempts are private except for authorized analytics views.

# Edge Cases

- Activity sequence has a missing previous activity. Review note: Inform / display to admins at overview about missing activity, chained activities not always have conditions, deny deleting activities with condition if they are followed by another activity, only allow replacing by new ones. Add "I am really sure to delete that activity" button / request to prevent accidental deletion.
- Completion effect fails after submission succeeds.
- Repeatable activity changes after attempts exist. Review note: attempts are set to 0 if activity was replaced, if it was only changed in visuals or content, do not reset, it's not about controlling users or them flexing or comparing to others how they completed it pre condition change, etc.
- Node has no activities. Review note: do not display node, mark as invisible. Display node at node overview for admins / mark with construction icon, that it has to be build / completely build.
- AI activity is configured without an enabled AI connection. Mark ai activity for admins, mark ai settings tab with a warning icon to symbol that ai api has to be configured.

# Open Questions

- Should activities be reusable across nodes in MVP? Answer: yes, see note at Data Model Draft.
- Are sequences strict by default or free-form? Answer: strict since the sequence is used to tell stories, for example: activity 1 ice wall blocks the way, needs fire ball tool to remove, activity 2 frozen into the ice wall was a sphinx which now asks a riddle.
- How should partial completion affect node completion? Answer: Each activity has to be marked as completed to mark a node as completed. Activity progress is only stored at end of activity, lessons, tests, dialogues with npcs, etc. restart from the beginning. Somewhere, node or activity it is only stored which activity is the current displayed one, past and next ones are locked, not visible to user.

# MVP Scope

- Node-bound activities.
- Basic types: lesson, question, reflection, tool requirement, grant item, portal open.
- Conditions and completion rules.
- Learner attempts.
- Activity effects.

# Later Extensions

- Boss challenge builder.
- Labs.
- Group activities.
- Dynamic events.
- Reusable activity templates.
