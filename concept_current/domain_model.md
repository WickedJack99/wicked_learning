# Domain Model

## Core Learning Structure

- `learning_worlds`: top-level themed learning spaces.
- `learning_maps`: spatial learning areas inside a world.
- `learning_map_assets`: the product-level visual and functional objects placed
  on maps. They own placement, imagery, focusability and presentation config.
- `learning_nodes`: internal compatibility records used by activities,
  progression and portals. A MapAsset owns at most one node record; admins do
  not manage MapAssets and nodes as separate concepts.
- `learning_activities`: interactions belonging to a MapAsset through its
  internal node record.
- `learning_activity_starts`: learner-facing route choices.
- `activity_transitions`: graph edges between activities or a route end.
- `learning_portal_links`: travel relationships between MapAssets/activities.
- `learner_activity_progress` and `learner_route_progress`: reached, completed,
  current-run learner state and optional learner-owned activity check-ins.
- `learning_message_topics`: reusable MapAsset-scoped topics that connect a
  message prompt Activity with one or more message wall Activities.
- `learner_messages`: one short learner contribution per topic and user,
  including moderation visibility and author attribution.
- `ai_provider_credentials` and `ai_agent_templates`: encrypted provider
  configuration and reusable instruction/model profiles.
- `ai_content_authoring_runs`: versioned generated plans, scoped context,
  warnings, provider usage and human-approval state.

## Activity-Specific Structure

- `learning_questions` and `learning_question_options`: questions, answers and
  informational feedback.
- `npc_dialogue_nodes`, `npc_dialogue_transitions` and
  `npc_dialogue_answers`: nested NPC conversation graphs and learner answers.
- `learning_shared_task_submissions`: contributions to shared activities.
- `learner_reflections`, journal pages and feedback requests: private learner
  reflection and requested support.

## Reusable World Objects

- `learning_tools` and `user_learning_tools`: reusable learner capabilities and
  ownership.
- `learning_items` and `user_learning_items`: consumable definitions and
  learner quantities.
- `learning_sounds`: reusable audio assets with playback metadata.
- Reusable visual media is selected through shared media pickers and reference
  paths rather than duplicated uploads.

## Accounts, Access And Presentation

- `users` and `user_preferences`: accounts and persistent personal settings.
- `access_roles`, `access_role_permissions` and `access_role_user`: configurable
  permission bundles and assignments.
- `registration_tokens`: controlled invitations and their usage records.
- `platform_info_pages` and `platform_presentation_settings`: editable public
  copy, legal information and presentation configuration.

## Design Rules

MapAssets are places; Activities are what happens there.

Activity types are registered as small data-shaped definitions with connectors
so every type can participate in the same route graph. Runtime mutations such
as progress, item quantities and shared-task contributions stay backend-owned.

Learner messages use the same Activity graph instead of a route-completion
special case. A `message_prompt` Activity asks for one contribution per user
and topic. A `message_wall` Activity presents visible contributions as
dismissible cards. Both Activities link the same MapAsset-scoped message topic.
Peer walls may opt into a separate, one-response-per-learner interaction; those
responses keep the same moderation boundary without exposing author identity to
learners.

Users are accounts, roles are permission bundles, and registration tokens are
invitations. None of these should become learning rewards.

Tools increase capability or interpretation. Items are consumable world
objects. Sounds and visual media remain separate because their playback and
preview behavior differs.

The Content API is a versioned application contract over existing authoring
Actions and validation rules, not a second content model. AI ContentPlans are
stored as drafts and revalidated before one explicit transaction creates the
MapAsset, Activities, route start and transitions.
