# Codex Guide For `tests`

Tests should protect learner progress, access control, graph behavior and configurable content without turning the prototype into a brittle snapshot suite.

## Test Priorities

Prioritize tests for:

- Authorization and permission boundaries.
- Registration tokens, roles, bans and disabled login.
- Activity graph transitions and route progress.
- Portal traversal and destination safety.
- Granting tools or items without duplicate browser-triggered rewards.
- Node lock, unlock, reveal and completion conditions.
- Localization access boundaries for activity content.
- Media, sound and visual configuration persistence.

## Style

- Keep tests focused on behavior.
- Prefer factories and named helper setup over long repeated arrays.
- Avoid asserting implementation details of React layouts in backend tests.
- For frontend logic, test pure helpers where possible.

## Running Tests

Run the smallest relevant test first. Use broader suites only when a change touches shared behavior.
