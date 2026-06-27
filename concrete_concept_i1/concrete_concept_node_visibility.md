# Purpose

Define configurable node visibility and unlocking.

The system should support open exploration, linear paths, hidden areas, timed events, competency-based unlocks and recommendations without forcing one progression model.

# Core Concepts

- Visibility state: Whether a learner can see a node.
- Unlock state: Whether a learner can access a node.
- Rule: Condition that affects visibility, unlock or recommendation.
- Connection state: Visibility and access state for paths between nodes.
- Recommendation: Soft guidance that does not block access.

# User Experience

## Learner Experience

Learners may see hidden, hinted, visible, locked, unlocked or recommended nodes. The experience should guide without controlling unless admins explicitly configure hard locks.

## Admin Experience

Admins define rules based on completion, items, tools, competencies, date/time, roles, groups or custom conditions.

# Data Model Draft

`visibility_rules`
- purpose: Store rules that determine node visibility.
- important_fields: `id`, `target_type`, `target_id`, `rule_type`, `rule_json`, `effect`, `priority`, `enabled`.
- relationships: Applies to nodes or connections.

`unlock_rules`
- purpose: Store rules that determine access.
- important_fields: `id`, `target_type`, `target_id`, `rule_type`, `rule_json`, `effect`, `priority`, `enabled`.
- relationships: Applies to nodes, activities or connections.

`learner_resolved_states`
- purpose: Cache resolved learner-specific states.
- important_fields: `id`, `user_id`, `target_type`, `target_id`, `visibility_state`, `unlock_state`, `recommendation_state`, `calculated_at`.
- relationships: References user and target.

`connections`
- purpose: Store node-to-node paths and their rules.
- important_fields: `id`, `source_node_id`, `target_node_id`, `visual_config_json`, `rules_json`.
- relationships: Connects nodes.

# Relationships

A node can have many visibility and unlock rules. A connection can have its own rules. Learner state is resolved from rules, progress, inventory, competencies and time.

# State and Lifecycle

Visibility states: `hidden`, `hinted`, `visible`.

Unlock states: `locked`, `unlocked`, `recommended`.

Connections may be `hidden`, `visible_locked`, `visible_unlocked`, `recommended` or `completed`.

# Configuration Options

Admins can configure rule type, rule mode, priority, AND/OR grouping, time windows, manual toggles, prerequisite nodes, required activities, items, tools, competencies, roles and groups.

# Visual Configuration

Hidden, hinted, locked and recommended states should use semantic visual tokens. A hinted node could be fog, static, shadow, silhouette, blurred symbol or minimal placeholder depending on theme.

# API / Backend Responsibilities

The backend should evaluate rules, cache resolved states where useful, handle time-based recalculation and avoid exposing hidden data when not allowed.

It should explain locked/recommended reasons when configured.

# Frontend Responsibilities

The frontend renders resolved states, lock explanations, recommended paths, hidden placeholders and connection states.

# Admin Interface

Required screens include rule builder, state preview as learner, connection rule editor, timed visibility scheduler and conflict diagnostics.

# Permissions and Privacy

Learners see only resolved state and allowed explanations. Admins can inspect all rules. Role/group-based rules must not reveal private group membership unnecessarily.

# Edge Cases

- Conflicting rules produce different states.
- Timed event ends while learner is inside node.
- Completed node later becomes hidden.
- Rule references deleted item or competency.
- Multiple incoming paths unlock the same node.

# Open Questions

- How should conflicts be resolved: priority, most permissive or most restrictive?
- Should completed hidden nodes remain visible to the learner?
- Should recommendations be stored or calculated live?

# MVP Scope

- Separate visibility and unlock rules.
- Rule types for completed node/activity, owned item/tool and competency level.
- Basic connection states.
- State preview in admin.

# Later Extensions

- Date/time events.
- Group and role rules.
- Custom condition engine.
- Advanced conflict diagnostics.
