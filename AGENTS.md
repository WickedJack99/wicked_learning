# Codex Repository Guide

This file is the first instruction layer for Codex work in this repository. More specific `AGENTS.md` files in subdirectories override or extend this guidance for their area.

## Product Direction

Wicked Learning is a generic, explorable learning platform. It should be adaptable to any learning domain through configured worlds, maps, nodes, activities, media, sounds, cursors, public pages and access rules.

The product is developed through iterative exploration rather than from a complete fixed specification. The creator may hold parts of the concept mentally, discover the shape of a feature while seeing it implemented, or intentionally contradict an older concept note after using a prototype.

Preserve these product invariants:

- Support autonomy, competence, curiosity, orientation and wellbeing.
- Avoid global points, streak pressure, leaderboards and reward loops that make the reward more important than learning.
- Keep admins as normal learners first. Admin editing belongs in settings and dedicated edit pages, not in the learner map.
- Keep domain content configurable. Do not hard-code one story, subject area, image set or terminology into core learning logic.
- Treat ideas from the project creator as product direction from WickedJack99. If concept notes are updated, mark changed or discontinued ideas clearly.

Use the learning principles as design lenses, not as automatic blockers. Playful mechanics, tools, items, progression and rewards are not automatically inappropriate. Consider what behavior they encourage, explain important tensions, suggest learner-supportive alternatives when useful, and let the creator make the product decision.

## Source Of Truth

- `README.md` is the public overview.
- `documentation/` is slower-moving implementation and setup documentation.
- `concept_current/` is the current living concept layer.
- `concept/` and older `concept*` files can contain historical thinking and should not silently overrule `concept_current/`.
- `conversations/` contains exploratory history and should be used for context, not as binding specification.
- `app/Learning` owns learning-domain behavior.
- `resources/js/features` owns larger frontend feature behavior.

None of these sources alone defines the final intended product. If implementation, documentation and concept notes disagree:

- Do not assume the code is the intended final design.
- Do not assume a concept document is a binding specification.
- Do not silently revive an old idea.
- Follow the newest explicit user direction when it is clear.
- Use existing material to understand context, terminology and consequences.
- Report important contradictions when they affect architecture, stored data, security or substantial future work.
- For smaller reversible decisions, make a reasonable choice and state the assumption afterward.

Do not require the user to fully specify the entire surrounding concept before implementing one developing idea.

## Exploratory Implementation

Implementation may clarify the concept. When building an exploratory feature:

- Identify which parts are clearly requested.
- Distinguish settled requirements from assumptions.
- Prefer reversible structures where the design is still developing.
- Avoid unnecessary abstractions based on an imagined final system.
- Implement the smallest version that makes the idea tangible and testable.
- Note design questions discovered during implementation.
- Update concept documents only when the new direction is clear enough to record.
- Do not rewrite broad concept documents merely to make them match every prototype experiment.

A prototype may intentionally leave surrounding behavior unresolved. Report those boundaries instead of pretending the whole concept is complete.

## Architecture Rules

Keep controllers and React pages thin.

Laravel controllers may authorize, validate or delegate validation, call an Action, Service, Query or Serializer, and return an Inertia response, redirect or JSON response.

Do not add graph traversal, progress rules, portal logic, slug generation, long serialization, hex-grid math, file-upload rules or multi-step workflows directly to controllers.

Prefer:

- Actions for write operations.
- Services for reusable domain behavior.
- Query classes for read-heavy loading.
- Serializers for Inertia or JSON payloads.
- Form Requests or validation classes when validation becomes noisy.
- Reusable React components and hooks for shared UI state, configuration shells, graph editing, map math, media pickers, color inputs, cursor behavior, sound playback and inventory/tool interactions.

Avoid God classes. A class, hook or component should have one clear responsibility.

## Before Larger Changes

Briefly identify where the logic belongs:

- Which controller receives the request.
- Which Action, Service or Query handles behavior.
- Which Serializer shapes frontend data.
- Which React component or hook owns UI behavior.

Inspect surrounding implementations before editing. Reuse shared abstractions when responsibilities match, but do not force reuse when behavior is materially different.

## Working Safely

- Check `git status --short` before edits.
- Preserve user changes. Never reset or revert unrelated work unless explicitly requested.
- Keep commits focused by responsibility.
- Do not copy secrets, tokens, local paths, private chat logs or credentials into docs or code.
- Do not inspect private Codex session databases, browser profiles or unrelated user directories.
- Do not add dependencies, hooks, CI, deployment scripts or generated assets unless the task asks for them.
- Use migrations for database changes.
- Keep generated default media removable by deployments.

## Verification

Choose checks based on risk. For code changes, prefer targeted tests and static checks before broad suites.

Useful checks include:

- `vendor/bin/pint --parallel --test`
- `php artisan test`
- `npm run lint:check`
- `npm run format:check`
- `npm run types:check`
- `npm run build`
- `composer run ci:check`

For docs-only or guidance-only changes, use lightweight validation such as `git diff --check`, metadata checks and targeted file review.

## Final Reporting

In the final answer, state what changed, what was verified, what was not run, and any remaining risks. If Git actions were requested, report the branch, commit and push result.
