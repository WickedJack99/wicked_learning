# Purpose

Define lesson activities as structured learning content that remains interactive and avoids long passive consumption.

The source file is currently empty, so this proposal aligns lessons with the platform-wide active learning philosophy.

# Core Concepts

- Lesson activity: Structured explanation and practice unit.
- Lesson block: Small content block such as text, image, video, prompt or exercise.
- Reflection prompt: Short self-explanation or metacognition task.
- Retrieval question: Low-stakes recall/application check.
- Passive segment limit: Policy that flags long uninterrupted content.

# User Experience

## Learner Experience

Learners move through short lesson blocks with embedded prompts, questions and reflection. The lesson should feel like guided exploration, not a static article.

## Admin Experience

Admins compose lesson blocks, add prompts, connect topics and review passive-content warnings before publishing.

# Data Model Draft

`lesson_activities`
- purpose: Store lesson-specific settings.
- important_fields: `id`, `activity_id`, `layout_mode`, `estimated_minutes`, `policy_profile_id`.
- relationships: Extends activity.

`lesson_blocks`
- purpose: Store ordered lesson content.
- important_fields: `id`, `lesson_activity_id`, `block_type`, `content_json`, `sort_order`, `topic_links_json`.
- relationships: Belongs to lesson.

`lesson_block_interactions`
- purpose: Store embedded prompts or questions.
- important_fields: `id`, `lesson_block_id`, `interaction_type`, `config_json`, `required`.
- relationships: Belongs to lesson block.

`learner_lesson_progress`
- purpose: Store per-learner lesson progress.
- important_fields: `id`, `user_id`, `lesson_activity_id`, `current_block_id`, `completed_blocks_json`, `completed_at`.
- relationships: Belongs to learner and lesson.

# Relationships

A lesson activity has many lesson blocks. Blocks may contain interactions. Lesson progress contributes to activity completion and topic activity.

# State and Lifecycle

Lesson states: `not_started`, `in_progress`, `waiting_for_interaction`, `completed`, `repeat_available`.

Block states: `locked_by_order`, `available`, `viewed`, `interaction_completed`.

# Configuration Options

Admins can configure block order, required interactions, estimated time, topic links, media assets, passive-content thresholds and completion criteria.

# Visual Configuration

Lessons should inherit world theme without assuming a format. A lesson may appear as terminal logs, manuscript pages, ship briefings or minimal panels. Visuals include block container, prompt treatment, media layout and completion state.

# API / Backend Responsibilities

The backend should serve lesson structure, save progress, validate required interactions, track completion and run content quality checks.

# Frontend Responsibilities

The frontend renders blocks, prompts, progress state and feedback. It should keep reading segments short and responsive across desktop and mobile.

# Admin Interface

Required screens include block editor, prompt inserter, topic mapping, quality warnings and learner preview.

# Permissions and Privacy

Learners can see published lessons. Draft lessons are admin-only. Prompt responses are learner data and should be private unless explicitly shared.

# Edge Cases

- Lesson has no interaction blocks.
- Video is too long for configured policy.
- Learner resumes after lesson was edited.
- Required prompt is deleted after completion.

# Open Questions

- Which block types are needed first?
- Should lessons support branching in MVP?
- Should lesson progress require all blocks or only required blocks?

# MVP Scope

- Text and media blocks.
- Embedded reflection prompts.
- Basic retrieval questions.
- Progress tracking.
- Passive length warning.

# Later Extensions

- Branching lessons.
- Adaptive review blocks.
- AI-generated prompts.
- Interactive simulations.
