# Purpose

Define the learner's personal knowledge visualization as an implementation-ready concept.

The Knowledge Constellation should help learners reflect on competence, recency and current focus. It should not become a leaderboard, level system or rigid skill tree.

# Core Concepts

- Topic star: Visual representation of one topic or competency.
- Star size: Derived long-term competence.
- Star brightness: Confidence that competence is still fresh.
- Star aura: Recent learning activity.
- Cloud overlay: Gentle refresh-needed signal.
- Constellation connection: Relationship between topics.

# User Experience

## Learner Experience

Learners open the constellation from the companion character. They see a personal sky of topics that changes as they learn, practice and revisit material.

The view should encourage orientation and curiosity: what have I explored, what is strong, what needs refreshment and what connects to what?

## Admin Experience

Admins define topic catalogues, competency relationships and formulas or thresholds that derive visual states. They can inspect aggregate topic health without turning the learner view into a ranking system.

# Data Model Draft

`topics`
- purpose: Store competencies or knowledge areas.
- important_fields: `id`, `name`, `description`, `parent_topic_id`, `metadata_json`, `visual_defaults_json`.
- relationships: Has many activity links and relationships.

`learner_topic_states`
- purpose: Store derived learner state per topic.
- important_fields: `id`, `user_id`, `topic_id`, `competence_score`, `competence_confidence`, `recent_activity_score`, `last_activity_at`, `last_successful_demonstration_at`.
- relationships: Belongs to user and topic.

`topic_relationships`
- purpose: Store relationships between topics.
- important_fields: `id`, `source_topic_id`, `target_topic_id`, `relationship_type`, `weight`, `source`.
- relationships: Connects topics.

`learning_events`
- purpose: Store evidence used to update topic state.
- important_fields: `id`, `user_id`, `activity_id`, `topic_id`, `event_type`, `difficulty`, `result`, `occurred_at`, `weight`.
- relationships: Belongs to user, optional activity and topic.

# Relationships

A topic may be linked to many activities. A learner has one topic state per relevant topic. Learning events update topic states. Topic relationships create constellation lines or particles.

# State and Lifecycle

Topic states derive visual states:

- `unknown`: No meaningful activity yet.
- `exploring`: Recent activity, low competence.
- `developing`: Some successful demonstrations.
- `strong`: High competence and confidence.
- `needs_refresh`: Competence exists but confidence has faded.

Visual properties should be recalculated after learning events and on scheduled decay jobs.

# Configuration Options

Admins can configure topic names, relationship types, decay formulas, score thresholds, activity-to-topic weights, difficulty weighting and visual mapping ranges.

# Visual Configuration

Constellation visuals must be themeable. A world may use stars, nodes of light, neural dots, runes, navigation beacons or abstract particles. The semantic layers remain size, brightness, aura and overlay.

Configurable fields include star asset, connection style, particle motion, overlay texture, background, color tokens and transition effects.

# API / Backend Responsibilities

The backend should record learning events, calculate topic states, expose constellation data and keep visual derivation separate from raw competence data.

It should return semantic visual values rather than hardcoded CSS or art assets.

# Frontend Responsibilities

The frontend renders the constellation, transitions from companion access, displays topic details and supports filtering or focusing without looking like an admin graph.

It should represent direction with motion where useful, not rigid arrows by default.

# Admin Interface

Required screens include topic catalogue, activity-topic mapping, relationship editor, formula settings and aggregate topic analytics.

# Permissions and Privacy

Learners can see their own constellation. Admin access to individual constellations should be permission-gated. Aggregate analytics should avoid exposing personal learning histories unnecessarily.

# Edge Cases

- Topic has no activity mappings.
- Learner has events for a deleted topic.
- Formula changes after many states were calculated.
- A learner has high activity but low successful demonstration.
- Related topics form dense visual clutter.

# Open Questions

- Which formula should determine competence score in MVP?
- How quickly should brightness fade?
- Should learners be able to hide or rename personal topic views?
- Should constellation relationships be personalized from behavior in MVP?

# MVP Scope

- Topic catalogue.
- Activity-to-topic mapping with weights.
- Learner topic state table.
- Basic visual derivation for size, brightness and aura.
- Read-only learner constellation view.

# Later Extensions

- Personalized relationship lines.
- Animated learning paths.
- Reflection notes attached to stars.
- AI summaries of topic growth.
- Multiple constellation visual themes.
