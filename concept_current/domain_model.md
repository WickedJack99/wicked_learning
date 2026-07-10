# Domain Model

## Current Tables

- `learning_worlds`: top-level themed learning spaces.
- `learning_maps`: hex-map learning areas inside a world.
- `learning_nodes`: places on a map, positioned with axial `q` and `r` coordinates.
- `learning_portal_links`: links between portal nodes, usually across maps.
- `learning_activities`: interactions inside nodes, including generic graph position data for the admin activity editor.
- `learning_activity_starts`: route starts from a node's Start connector to first activities.
- `activity_transitions`: graph edges from one activity connector to another activity connector or to the special end point.
- `dialogue_stages`: staged NPC dialogue content.
- `learning_questions`: question configuration for question activities.
- `learning_question_options`: answer options with optional outcome keys and weights.
- `npc_dialogue_nodes`: nested NPC dialogue graph nodes, including interactions, answer nodes and end nodes.
- `npc_dialogue_transitions`: nested NPC dialogue graph edges.
- `npc_dialogue_answers`: stored learner answers for NPC dialogue questions.
- `learner_activity_progress`: minimal reached/completed activity state.
- `learner_question_answers`: selected answers and feedback history.
- `learning_tools`: reusable tools that learners can acquire and use.
- `user_learning_tools`: learner-owned tool assignments.
- `learner_node_discoveries`: learner-specific hidden-node discovery state.
- `learning_sounds`: reusable sound assets with playback metadata.
- `user_preferences`: authenticated user preferences such as appearance.
- `registration_tokens`: one-use tokens for controlled registration.
- `access_roles`: configurable roles seeded with system `admin` and `user` roles.
- `access_role_permissions`: resource permission levels per role.
- `access_role_user`: many-to-many assignments between users and access roles.
- `platform_info_pages`: editable Markdown-backed public/settings information pages.
- `platform_presentation_settings`: backend-stored public presentation configuration such as auth backgrounds and welcome-page text.

## Current User And Access Fields

- `users.role`: legacy primary role kept for compatibility and seeding bridges.
- `users.roles`: legacy JSON role list kept while configurable role assignments mature.
- `users.login_disabled_at`: disables login when set.
- `users.banned_until`: blocks login until the chosen date when set in the future.
- `registration_tokens.role`: legacy primary role granted by a token.
- `registration_tokens.roles`: JSON role list granted by a token.
- `registration_tokens.created_by_user_id`: user who created the token.
- `registration_tokens.used_by_user_id`: user who registered with the token.
- `registration_tokens.used_at`: timestamp when the token was consumed.
- `registration_tokens.expires_at`: optional token expiration timestamp.

## Design Direction

Nodes are places. Activities are what happens there.

This keeps the system generic enough for different domains: cybersecurity nodes can be servers or signal gates, medieval nodes can be towers or camps, and astronomy nodes can be planets or stations without changing the core model.

Activity types are registered as data-shaped definitions with at least one input connector and one output connector. Dialogue, question, reflection, placeholder and portal activities share the same graph foundation even when their detailed configuration forms differ later.

Portal links connect two portal nodes. The current prototype treats them as sibling tiles so the admin graph can show relationships between maps before learner travel behavior is finalized.

Users are accounts. Roles are configurable permission bundles. Tokens are invitations and audit records.

This keeps public registration intentional without turning access management into a separate learning incentive system.

Tools are learner capabilities. They may be granted by activities or NPC dialogue nodes, then used against obstacles or hidden map nodes. Tool ownership should support exploration and competence, not public status.

Reusable media is split by behavior. Visual assets are selected through image/animation pickers, while sounds have their own model because volume, looping, previewing and layered playback are sound-specific concerns.
