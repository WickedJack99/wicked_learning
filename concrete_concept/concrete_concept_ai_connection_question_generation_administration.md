# Purpose

Define AI provider administration and human-reviewed generation of competence-oriented questions.

The system should help domain experts create scenario-based learning interactions. It should not publish AI output directly to learners without review.

# Core Concepts

- AI connection: A configured provider and model endpoint.
- Global AI context: Platform-wide generation guidance.
- Local AI context override: World, map, node or activity-specific instructions.
- Generation job: A request to create structured question candidates.
- Review candidate: AI-generated content awaiting human approval.
- Competence metadata: Expected answer points, feedback and topic links.

# User Experience

## Learner Experience

Learners encounter reviewed, practical questions that ask them to reason through realistic situations. Feedback should be informational and help them improve.

## Admin Experience

Admins configure AI providers, define contexts, generate question candidates, edit them, reject weak results and approve useful ones into activities.

# Data Model Draft

`ai_connections`
- purpose: Store AI provider configuration.
- important_fields: `id`, `name`, `provider_type`, `base_url`, `model`, `encrypted_api_key`, `default_context`, `enabled`.
- relationships: Used by generation jobs.

`ai_contexts`
- purpose: Store global and local prompt context.
- important_fields: `id`, `scope_type`, `scope_id`, `inherit_global`, `additional_context`, `generation_goal`, `difficulty`, `question_style`.
- relationships: Applies to world, map, node, activity or module.

`ai_generation_jobs`
- purpose: Track asynchronous generation requests.
- important_fields: `id`, `connection_id`, `requested_by_user_id`, `target_type`, `target_id`, `status`, `request_payload_json`, `error_message`.
- relationships: Produces generated question candidates.

`question_candidates`
- purpose: Store AI-generated drafts before approval.
- important_fields: `id`, `job_id`, `question_text`, `type`, `difficulty`, `expected_answer_points_json`, `feedback_json`, `competencies_json`, `status`.
- relationships: May become an approved question.

`questions`
- purpose: Store learner-facing approved questions.
- important_fields: `id`, `activity_id`, `source_candidate_id`, `question_text`, `type`, `difficulty`, `rubric_json`, `feedback_json`.
- relationships: Belongs to activity and topics.

# Relationships

An AI connection has many generation jobs. A context may apply to a learning object. A generation job creates many candidates. Approved candidates become questions connected to activities and competencies.

# State and Lifecycle

Generation jobs move through `queued`, `running`, `succeeded`, `failed` and `cancelled`.

Question candidates move through `draft`, `needs_edit`, `approved`, `rejected` and `published`.

# Configuration Options

Admins can configure provider type, model, base URL, API key, default context, global context, local override behavior, difficulty, question style, output count and review requirements.

# Visual Configuration

AI administration should use neutral admin visuals. Learner-facing generated content inherits activity and world visual configuration. AI should generate content structure and text, not hardcoded art style.

# API / Backend Responsibilities

The backend should securely store credentials, assemble prompts from inherited contexts, call providers through adapters, validate structured output, queue generation jobs and enforce review before publishing.

It should log provider errors without exposing API keys.

# Frontend Responsibilities

The frontend should provide connection management, context editors, generation forms, candidate review, inline editing and approval/rejection actions.

# Admin Interface

Required screens include AI Connections, Global Context, Local Context Overrides, Generation Job History and Candidate Review Queue.

# Permissions and Privacy

Only privileged admins can manage AI keys. Content authors may generate and review questions if allowed. Learner submissions used for AI evaluation must follow privacy rules and should avoid unnecessary personal data.

# Edge Cases

- Provider returns invalid JSON. Review note: Differ between responses, if service unavailable, display message like "Service unavailable, last time tried <timestamp>" on each area where ai requests can be made.
- Model generates factual recall instead of scenarios.
- API key expires. Review note: Add field api_key_expires_at to ai_connections where users can enter a date, if key is unlimited, enter 
- Local context conflicts with global principles.
- Candidate is approved after its target activity is deleted.

# Open Questions

- Which provider adapters are required first? Review note: Openai, also if possible display usage data inside dashboard.
- Should AI evaluation of learner answers be allowed in MVP? Review note: Admins, etc. should decide whether the topic of a lesson is easy enough for an ai to answer to reflection. So yes but make it optional.
- Should global context ever be non-inheritable? Review note: it should be asked whether it should be merged with local context or only local context used.
- How should generated content cite sources, if at all? Review note: Display an extra field called Sources with an i in a circle before it, at the bottom of each data / answer / question. Learners are allowed to check sources, that is exploration. But let this mode also decide by the admin. Display sources toggle. But default is on.

# MVP Scope

- Configure one or more AI connections.
- Store global context and activity-level override.
- Generate structured question candidates.
- Human review with edit, approve and reject.
- Publish approved candidates into question activities.

# Later Extensions

- Provider health checks.
- Batch generation.
- Rubric calibration tools.
- AI-assisted content quality checks.
- Model comparison and cost tracking.
