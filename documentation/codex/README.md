# Codex Working Environment

This folder documents how Codex should work inside this repository.

## Instruction Hierarchy

Codex should read instructions in this order:

1. System and developer instructions from the active Codex environment.
2. The user request for the current task.
3. Any scoped `AGENTS.md` in the directory being edited.
4. `CONTRIBUTING.md` and relevant project documentation.
5. Current concept files when product direction is involved.

Scoped files should only add local guidance. They should not contradict the root file.

## Repository Guidance Files

- `app/Learning/AGENTS.md` covers backend learning-domain behavior.
- `resources/js/AGENTS.md` covers React, Inertia, feature modules and UI consistency.
- `tests/AGENTS.md` covers test priorities and scope.
- Root `AGENTS.md` contains the Laravel Boost guidelines shared with Codex and
  other compatible agents.
- `.agents/skills/` contains the committed Boost skills for the Laravel,
  Inertia React, Tailwind, Wayfinder, testing and AI conventions.
- `CONTRIBUTING.md` covers architecture expectations, verification and the
  repository commit convention.

`boost.json` records the selected Boost features and agents. The local Codex MCP
configuration is in `.codex/config.toml`. Refresh generated guidance after a
Boost or supported-package update with:

```bash
php artisan boost:update --no-discover --no-interaction
```

## Verification

For documentation-only changes, prefer lightweight checks:

- Confirm expected files exist.
- Run `git diff --check`.
- Check Markdown links and stale terminology.
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

After each feature slice, perform a documentation-and-concept pass. Check the
public README, stable implementation documentation and `concept_current/` for
claims that the slice has changed. Update or remove stale active guidance in
the same functional change, and label superseded ideas as historical rather
than allowing them to look like current requirements. Keep `concept/`,
`concrete_concept_i1/` and `conversations/` as history unless a newer product
decision explicitly promotes material from them.

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
- When a slice replaces an earlier product concept, update the active docs and
  remove the old concept from current guidance before committing the code.

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

Follow the Commit Conventions in `CONTRIBUTING.md`. Use domain-scoped
Conventional Commit subjects and group commits by functional outcome. Preserve
user changes and avoid force pushes. If asked to push, push exactly the branch
requested and report the commit hashes and subjects.

## Examples

For a new Activity type, inspect `ActivityTypeRegistry`, the existing Activity
graph editor and playback renderer, then update `concept_current/activity_system.md`
when the graph or learner contract changes.

For a visual bug in Settings or map editing, reuse the existing configuration
shells and shared MapAsset renderer and verify the affected browser route when
practical.

## Deferred Work

- Keep Boost-generated guidance synchronized when Laravel or supported package
  conventions change.
- Add custom repository-local skills only with a documented discovery mechanism
  and a concrete workflow that is not already covered by Boost.
