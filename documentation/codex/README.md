# Codex Working Environment

This folder documents how Codex should work inside this repository.

## Instruction Hierarchy

Codex should read instructions in this order:

1. System and developer instructions from the active Codex environment.
2. Repository root `AGENTS.md`.
3. Any scoped `AGENTS.md` in the directory being edited.
4. The user request for the current task.
5. Relevant project documentation and concept files.

Scoped files should only add local guidance. They should not contradict the root file.

## Repository Guidance Files

- `AGENTS.md` covers product direction, design lenses, architecture boundaries, safety and verification.
- `app/Learning/AGENTS.md` covers backend learning-domain behavior.
- `resources/js/AGENTS.md` covers React, Inertia, feature modules and UI consistency.
- `tests/AGENTS.md` covers test priorities and scope.

## Repository-Local Skills

Repository-local skills live under `.agents/skills/`.

Current skills:

- `wicked-feature-slice`: feature ownership, architecture, reversible implementation and documentation sync.
- `wicked-activity-type`: activity graph, playback, progress and activity localization work.
- `wicked-ui-qa`: visual consistency, cursor behavior, map/settings layout and browser checks.
- `wicked-learning-design-review`: advisory SDT-informed concept review, product tensions and alternatives.

Each skill has a compact `SKILL.md` with YAML frontmatter containing `name` and `description`.

## Verification

For guidance-only changes, prefer lightweight checks:

- Confirm expected files exist.
- Validate skill frontmatter has `name` and `description`.
- Run `git diff --check`.
- Review `git diff --name-only` for unintended files.

For app changes, use targeted checks based on the touched layer. Do not run the full suite by default unless the change justifies it.

## Source Of Truth

- `README.md` is the public overview.
- `documentation/` contains stable implementation and setup docs.
- `concept_current/` contains current design thinking.
- `concept/` and `conversations/` contain older, exploratory or historical thinking.
- Code, migrations and tests show how the application currently behaves.

None of these sources alone defines the final intended product. Wicked Learning is developed through iterative exploration rather than from a complete fixed specification.

When sources disagree:

1. Do not assume the code is the intended final design.
2. Do not assume a concept document is a binding specification.
3. Do not silently revive an old idea.
4. Follow the newest explicit user direction when it is clear.
5. Use existing material to understand context, terminology and consequences.
6. Report important contradictions when they affect architecture, stored data, security or substantial future work.
7. For smaller reversible decisions, make a reasonable choice and state the assumption afterward.

Do not require the user to fully specify the entire surrounding concept before implementing one developing idea.

## Exploratory Product Work

Implementation may help clarify the concept. When building an exploratory feature:

- Identify clearly requested parts.
- Distinguish settled requirements from assumptions.
- Prefer reversible structures where the design is still developing.
- Avoid unnecessary abstractions based on an imagined final system.
- Implement the smallest version that makes the idea tangible and testable.
- Note design questions discovered during implementation.
- Update concept documents only when the new direction is clear enough to record.
- Do not rewrite broad concept documents merely to make them match every prototype experiment.

A prototype may intentionally leave surrounding behavior unresolved. Report those boundaries instead of pretending the whole concept is complete.

## Conflict Handling

If instructions conflict:

1. Follow higher-priority Codex instructions.
2. Follow the most specific repository instruction that applies.
3. Follow the newest explicit user request when it does not violate higher-priority instructions.
4. Ask only when a safe assumption would be risky.

## Safety

Codex should not inspect or copy:

- credentials
- auth files
- private Codex session databases
- private logs
- personal browser profiles
- unrelated directories
- private conversations outside this repository

Codex should not modify user-level Codex configuration while working on this repository unless the user explicitly asks for that exact file.

## Git

Use focused commits grouped by responsibility. Preserve user changes and avoid force pushes. If asked to push, push the current branch and report the result.

The user prefers commit messages that make Codex authorship clear. Product ideas from the project creator can be referred to as WickedJack99's direction in docs or concept notes when helpful.

## Command Rules

No repository-local command-rule files were added in this pass.

Reason: the installed Codex executable path was discoverable, but invoking `codex --help` from this shell returned `Access is denied`, so the supported local rule format could not be validated safely. Until the installed Codex Desktop documents a repo-local rule format that can be checked locally, safety expectations should stay in `AGENTS.md` and this document.

## Examples

For a new learner feature, start with `wicked-feature-slice`, then use a more specific skill if the feature touches activities or UI polish.

For a new activity type, use `wicked-activity-type`, then update `concept_current/activity_system.md` if the graph or playback model changes.

For a visual bug in settings, map editing or cursors, use `wicked-ui-qa`.

For motivation or learning design questions, use `wicked-learning-design-review`.

## Deferred Work

- Validate repository-local skill discovery in Codex Desktop once a supported local command or official repo-local skill discovery document is available.
- Add supported repository-local command rules only after the rule format can be verified.
- Consider linking this guide from the public documentation index after the team is happy with the workflow.
