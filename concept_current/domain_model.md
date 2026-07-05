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
- `user_preferences`: authenticated user preferences such as appearance.
- `registration_tokens`: one-use tokens for controlled registration.
- `platform_info_pages`: editable Markdown-backed public/settings information pages.

## Current User And Access Fields

- `users.role`: legacy primary role kept for compatibility and simple checks.
- `users.roles`: JSON role list for users with multiple roles.
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

Users are accounts. Roles describe broad capability levels. Tokens are invitations and audit records.

This keeps public registration intentional without turning access management into a separate learning incentive system.
