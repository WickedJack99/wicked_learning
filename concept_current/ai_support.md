# AI Support

The platform can support AI-assisted authoring and learner-facing feedback, but AI should remain a configurable helper rather than a required core dependency.

## Current Direction

Admins can configure:

- provider credentials
- model and budget metadata
- reusable agent templates
- system and task instructions
- whether a template requires guarded learner context

The first implementation focuses on configuration and authoring infrastructure. Runtime execution, job queues and provider-specific adapters can be added behind the template boundary later.

## Agent Instruction Files

Agent templates can export and import their instruction text as Markdown files. The expected structure is:

```markdown
## System prompt

Behavior, boundaries and long-lived rules.

## Task prompt

The specific task pattern the agent should follow.
```

The repository includes `agent-instruction-sets/` as a public place for starter instruction sets and community improvements.

## Design Constraints

- Do not expose private learner data unless a guarded context flow explicitly permits it.
- Do not preload hidden answer keys, solution notes or route logic into learner-visible translation or prompt bundles.
- Keep humans responsible for authoring decisions that affect learning content.
- Generated feedback should be informational and autonomy-supportive.
- AI should support competence, reflection and creation rather than introduce pressure mechanics.

## Example Agent Responsibilities

- SDT design helper for admins
- learner reflection feedback
- asset generation brief helper
- competence question designer

These can share the same storage shape while using different templates, provider keys and budgets.
