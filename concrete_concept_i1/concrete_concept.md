# Purpose

Define the platform-wide learning philosophy as implementation guidance. This concept is responsible for keeping learning interactive, competence-oriented and evidence-informed across all worlds, maps, nodes and activities.

It should solve the problem of passive content delivery becoming the default. It should not define one visual style, one course structure or one reward economy.

# Core Concepts

- Interactive learning unit: Any activity that asks the learner to think, choose, explain, practice or reflect.
- Reinforcement prompt: A small retrieval, reflection or self-explanation task embedded inside learning content.
- Competence signal: Evidence that the learner can apply knowledge, not only recognize facts.
- Content quality signal: Feedback, completion data and answer statistics used to improve learning material.
- Learning design rule: Configurable checks that flag overly passive or overly long content.

# User Experience

## Learner Experience

Learners should mostly encounter short, active learning loops. Reading, watching and explanation remain allowed, but they should be interrupted by meaningful prompts before attention drifts into passive consumption.

Formal tests are available, repeatable and useful, but they are not treated as the main learning mechanism. Learners can retry evaluations without shame or lockout.

## Admin Experience

Admins see analytics that connect learner struggle to content improvement. They can inspect wrong-answer patterns, feedback, weak topics and modules that may need rework.

Admins can configure learning-design defaults such as maximum recommended passive reading length, preferred prompt frequency and whether AI review is required before publishing.

# Data Model Draft

`learning_design_policies`
- purpose: Store platform or world-level rules for active learning quality.
- important_fields: `id`, `scope_type`, `scope_id`, `max_passive_minutes`, `max_reading_words_before_prompt`, `requires_reflection_prompts`, `ai_review_enabled`, `created_by`.
- relationships: May apply globally, to a world, map or activity type.

`learner_activity_progress`
- purpose: Track attempts, completions and revisit patterns.
- important_fields: `id`, `user_id`, `activity_id`, `attempt_count`, `completed_count`, `last_started_at`, `last_completed_at`, `last_result_state`.
- relationships: Belongs to user and activity.

`question_answer_statistics`
- purpose: Aggregate correct and incorrect answer patterns.
- important_fields: `id`, `question_id`, `answer_option_id`, `correct_count`, `incorrect_count`, `partial_count`, `last_answered_at`.
- relationships: Belongs to question and optional answer option.

`question_topic_weights`
- purpose: Link questions to topics for rework prioritization.
- important_fields: `id`, `question_id`, `topic_id`, `weight`.
- relationships: Question belongs to many topics through weighted relationships.

`content_improvement_suggestions`
- purpose: Store rework suggestions generated from analytics, admin review or AI.
- important_fields: `id`, `target_type`, `target_id`, `reason`, `priority_score`, `source`, `status`.
- relationships: References modules, activities, questions, topics or maps.

# Relationships

A learning activity may contain many reinforcement prompts. A question may relate to many topics with different weights. Answer statistics contribute to improvement suggestions. Learning design policies influence validation and review workflows before content becomes active.

# State and Lifecycle

Content quality suggestions move through `open`, `triaged`, `in_progress`, `resolved` and `dismissed`.

Activity progress moves through `not_started`, `started`, `submitted`, `completed`, `repeated` and `stale_for_refresh`.

AI learning-quality checks move through `not_checked`, `queued`, `passed`, `warning`, `failed` and `manual_override`.

# Configuration Options

Admins can configure prompt frequency, passive-content limits, accepted activity types, topic weighting, retry behavior, analytics thresholds, AI review settings and whether warnings block publishing or only notify authors.

# Visual Configuration

This concept should not prescribe visuals. Any theme may represent interactive learning differently: scanner interruptions in a cyber world, campfire questions in fantasy, mission logs in space or clean inline cards in an abstract world.

Visual tokens should include prompt icon, activity status treatment, quality-warning state, completion state and refresh-needed state.

# API / Backend Responsibilities

The backend should calculate progress, store attempts, aggregate answer statistics, generate content-improvement suggestions and expose learning-quality warnings.

Suggested endpoints can include content quality checks, progress summaries, question analytics and suggestion workflows. AI checks should run as jobs and store structured findings instead of only free text.

# Frontend Responsibilities

The frontend should render interactive prompts inside content, avoid long uninterrupted passive screens, expose retry flows and show progress as growth rather than judgment.

For admins, the frontend should show analytics in sortable tables and content review panels.

# Admin Interface

Required screens include learning policy settings, content quality warnings, question statistics, topic weakness overview, rework suggestion queue and activity feedback summaries.

# Permissions and Privacy

Learners can see their own progress and retry history. Admins can see aggregate performance and anonymized patterns. Individual answer history should be restricted to authorized educational roles if it is exposed at all.

# Edge Cases

- A learner repeats an evaluation many times and improves.
- A question is deleted but historical statistics remain.
- AI flags high-quality expert content as too long.
- A topic weight is missing or too broad.
- Content becomes inactive after learners completed it.

# Open Questions

- Should learning-design warnings block publishing or only request review?
- How much individual learner data should admins see?
- What thresholds define "too passive" for different activity types?
- Should repeated tests update competence confidence differently from first attempts?

# MVP Scope

- Track activity attempts and completions.
- Track question-level correct and incorrect counts.
- Add weighted topic links for questions.
- Add simple content feedback and rework suggestion records.
- Add basic policy fields for passive-content warnings.

# Later Extensions

- AI-assisted learning science review.
- Automated module rework suggestions.
- Spaced repetition scheduling.
- Cohort-level weakness detection.
- Community theme marketplace, guild systems and group activities.
