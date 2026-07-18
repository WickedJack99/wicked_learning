# Codex Repository Guide

This file is the first instruction layer for Codex work in this repository. More specific `AGENTS.md` files in subdirectories override or extend this guidance for their area.

## Product Direction

Wicked Learning is a generic, explorable learning platform. It should be adaptable to any learning domain through configured worlds, maps, nodes, activities, media, sounds, cursors, public pages and access rules.

Preserve these product invariants:

- Support autonomy, competence, curiosity, orientation and wellbeing.
- Avoid global points, streak pressure, leaderboards and reward loops that make the reward more important than learning.
- Keep admins as normal learners first. Admin editing belongs in settings and dedicated edit pages, not in the learner map.
- Keep domain content configurable. Do not hard-code one story, subject area, image set or terminology into core learning logic.
- Treat ideas from the project creator as product direction from WickedJack99. If concept notes are updated, mark changed or discontinued ideas clearly.

## Source Of Truth

- `README.md` is the public overview.
- `documentation/` is slower-moving implementation and setup documentation.
- `concept_current/` is the current living concept layer.
- Older `concept*` files can contain historical thinking and should not overrule `concept_current/`.
- `app/Learning` owns learning-domain behavior.
- `resources/js/features` owns larger frontend feature behavior.

If implementation and concept notes disagree, inspect the current code first, then update the concept notes when the implementation intentionally changes the idea.

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
