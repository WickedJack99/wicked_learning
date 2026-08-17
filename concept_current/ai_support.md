# AI Support

The platform can support AI-assisted authoring and learner-facing feedback, but AI should remain a configurable helper rather than a required core dependency.

## Current Direction

Admins can configure:

- provider credentials
- model, reasoning, token and supported generation controls
- reusable agent templates
- system and task instructions
- whether a template requires guarded learner context
- a content-authoring purpose for reviewable MapAsset drafts

The current provider path can execute and test Responses-compatible templates.
It applies connection/read timeouts, bounded transient retries, request IDs,
model-aware parameter filtering and sanitized error categories. Longer jobs are
still synchronous and should move behind a queue later.

## Current Content Authoring

World Builder can invoke an enabled `content_authoring` template for one map.
The administrator supplies a learning goal, optional audience and prior
knowledge, route length and allowed Activity types. The model receives scoped
map context plus a strict, versioned ContentPlan schema.

The resulting draft is stored with warnings, contract versions, provider/model
metadata and token usage. The admin reviews it before applying. Apply revalidates
the plan and creates one focusable MapAsset plus a short linear
Markdown/Reflection route in one transaction. Human approval is mandatory;
generation alone never mutates the map.

The separate Content API publishes its live contract and supports scoped
read/create operations through an administration console. It uses the existing
session, CSRF and resource-permission boundaries rather than bypassing the World
Builder rules.

## Agent Instruction Files

Agent templates can export and import their instruction text as Markdown files. The expected structure is:

```markdown
## System prompt

Behavior, boundaries and long-lived rules.

## Task prompt

The specific task pattern the agent should follow.
```

The repository includes `agent-instruction-sets/` as a public place for starter instruction sets and community improvements.

## Learning-World Design Agent

An AI assistant that proposes new learning-world structure should first inspect the learning structures that already exist in the current deployment. It should not assume that every requested topic needs a new world, map, tool, item or isolated path.

Depending on the administrator-selected scope, the agent should receive or load relevant context such as:

- existing worlds and maps
- existing topics and subtopics
- MapAssets and their learning purpose
- current activity routes
- portal connections
- prerequisites and unlock conditions
- existing tools and items
- where tools and items are acquired and used
- existing characters, visual themes and narrative framing
- learner progression structures
- planned or draft content that has not yet been published
- relevant learning objectives and target groups

The administrator should be able to control the context scope before the agent reasons about a request. Useful scopes include:

- the whole platform
- one world
- selected maps
- selected topics
- only published content
- published and draft content

Using that context, the agent should decide whether the requested topic should:

- extend an existing map
- become a new map inside an existing world
- become a separate world
- reuse existing MapAssets, activities, tools, items or characters
- connect to existing topics through portals or prerequisites
- replace, merge with or clarify overlapping content
- remain separate because its purpose or audience is materially different

The proposal should explicitly identify:

- which existing structures were considered
- which existing elements should be reused
- where overlap or duplication was found
- which new elements are actually necessary
- how the proposed topic connects to the existing learning landscape
- possible effects on current learner routes or progression
- assumptions caused by incomplete or outdated platform data

The current implementation data may not fully represent the creator's intended future direction. The agent should treat existing platform structure as context, not as an immutable specification. When current content, draft concepts or the administrator's request conflict, the agent should surface the uncertainty instead of silently preserving every existing design decision.

The broad world-design agent in this section remains future direction. The
implemented authoring slice currently loads only one map and its MapAsset
summaries and creates one reviewed linear route.

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
