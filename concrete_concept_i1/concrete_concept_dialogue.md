# Purpose

Define dialogue activities as conversations or scripted exchanges within a node.

The source file is currently empty, so this proposal treats dialogue as one activity type within the broader activity system.

# Core Concepts

- Dialogue activity: Conversation-like learning interaction.
- Speaker: Character, system voice, learner or abstract source.
- Dialogue step: One message, choice or prompt.
- Choice: Learner-selected response that may branch.
- Dialogue effect: Outcome triggered by reaching a step or choice.

# User Experience

## Learner Experience

Learners read or listen to short exchanges, make choices, answer prompts or ask guided questions. Dialogue should remain active and concise rather than becoming long passive text.

## Admin Experience

Admins create dialogue scripts, speakers, choices, branching conditions, effects and optional AI-supported feedback.

# Data Model Draft

`dialogue_activities`
- purpose: Store dialogue-specific configuration.
- important_fields: `id`, `activity_id`, `mode`, `allow_branching`, `speaker_config_json`.
- relationships: Extends activity.

`dialogue_steps`
- purpose: Store script steps.
- important_fields: `id`, `dialogue_activity_id`, `speaker_key`, `content`, `step_type`, `sort_order`, `visual_config_json`.
- relationships: Has choices.

`dialogue_choices`
- purpose: Store learner options.
- important_fields: `id`, `step_id`, `label`, `next_step_id`, `condition_json`, `effect_json`.
- relationships: Belongs to step.

`learner_dialogue_states`
- purpose: Track progress through a dialogue.
- important_fields: `id`, `user_id`, `dialogue_activity_id`, `current_step_id`, `completed_at`, `choice_history_json`.
- relationships: Belongs to user and dialogue.

# Relationships

A dialogue activity belongs to an activity. It has many steps. Steps may have many choices. Choices may lead to other steps or trigger effects.

# State and Lifecycle

Dialogue states: `not_started`, `in_progress`, `waiting_for_choice`, `completed`, `abandoned`, `repeat_available`.

# Configuration Options

Admins can configure speakers, text, choices, branching, conditions, effects, feedback, voice/audio assets and whether learners can replay the dialogue.

# Visual Configuration

Dialogue can appear as chat, scroll, radio log, hologram, messenger, speech bubbles or minimal text depending on world style. Speaker portraits and panels must be configurable assets.

# API / Backend Responsibilities

The backend should provide the current dialogue step, validate choices, store history, apply effects and prevent invalid branch jumps.

# Frontend Responsibilities

The frontend renders speaker presentation, message progression, choices, replay state and transitions while keeping text readable on mobile.

# Admin Interface

Required screens include dialogue script editor, branching graph, speaker catalogue, choice/effect editor and preview.

# Permissions and Privacy

Learner choices are private learning data. Admins may inspect aggregate choice statistics for improving dialogue design.

# Edge Cases

- Choice points to deleted step.
- Branching dialogue has no completion step.
- Learner replays after script changed.
- Speaker asset is missing.

# Open Questions

- Should dialogue support free-text AI responses in MVP?
- Should choices affect competency state directly or only through activity completion?
- Should dialogue scripts be reusable?

# MVP Scope

- Linear dialogue with optional choices.
- Choice history tracking.
- Completion effect.
- Speaker and panel visual configuration.

# Later Extensions

- Branching graph editor.
- AI roleplay dialogue.
- Voice and audio.
- Relationship or trust states.
