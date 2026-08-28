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
map context, the active competence-topic vocabulary, and a strict, versioned
ContentPlan schema. Each generated
activity also declares one to three competence topics and one learning intent;
the apply path gives those topics equal initial contribution weight and uses the
existing competence configuration.

The resulting draft is stored with warnings, contract versions, provider/model
metadata and token usage. The admin reviews it before applying and can edit its
MapAsset and Activity fields. Saving edits revalidates the plan before it is
stored. Apply revalidates it once more and creates one focusable MapAsset plus a
short linear route in one transaction. Human approval is mandatory; generation
alone never mutates the map.

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

## Activity review queue

Learning activities keep the normal `updated_at` timestamp plus an explicit AI
review state. Creating or materially editing an activity places it in a
`needs_review` queue and clears `ai_reviewed_at`. The queue is shown in the
authoring scope so a tutor can see which activity definitions still need
attention without implying that an AI provider has already inspected them.

AI review is opt-in and scoped to the selected activity, its learning purpose,
its competence topics, and only the nearby graph context needed for a useful
judgment. The review also receives the active competence-topic vocabulary so
optional metadata suggestions can reuse established labels; learner data,
thresholds and contribution weights are excluded. The review writes
`ai_reviewed_at` and a structured result, while the tutor remains responsible
for deciding whether any suggestion is useful. Layout-only changes should not
create pedagogical review noise.
Each completed run is also stored as immutable authoring history. The activity's
latest result remains the current review state, while the World Builder can
show the five most recent summaries on request. This history is not part of
learner playback.

The activity review dialog shows the edit time and review time together. This
makes freshness visible before a tutor relies on a previous review, while the
tutor remains responsible for deciding whether any suggestion is useful. The
same review action is also available from the activity editor when a review
helper is configured. It is disabled while the editor contains unsaved changes
so the tutor cannot accidentally review an older saved version while believing
the draft is being inspected.
After a result is available, the dialog can open the next pending activity in
the same scoped queue, so reviewing several activities does not require
re-finding each one in the graph.
When no activity-review template exists, the queue links directly to a new
template form with the correct review purpose selected.

The review endpoint checks the AI update permission independently of the
World Builder activity permission. Editors who can change activities but are
not allowed to manage AI helpers can still see that review work is pending,
but they are not offered a setup link and cannot invoke a review request.

The local activity-template action now makes its scope explicit before a copy
is saved. Message topics and portal destinations are called out when they are
copied because those references may need deliberate replacement in a future
cross-map workflow. Cross-map reuse remains deferred until every
context-sensitive reference has an explicit resolution path.

At the World Builder graph, each map card also shows its current activity
review state. A map with waiting reviews links directly to the first affected
node, making the scoped queue discoverable before an author opens individual
maps.

World Builder also provides a world-level Review queue section. It gathers
waiting activities across the current world, paginates the list as it grows
and opens each entry directly in its scoped review dialog. The review
operation remains scoped to one activity at a time; the world-level view is an
entry point, not a batch approval mechanism.

The content-authoring contract supports Markdown, Reflection, Message
prompt, Shared task and Open practice activities. An Open practice activity
receives a concrete invitation for a learner-owned next step. A Message prompt
receives a scoped shared topic and input label. A Shared task is applied as a
text contribution task with a concrete prompt, optional instructions and the existing minimum-length
validation defaults; tutors can refine its participation settings afterward.
All activity types use the same validated activity creation path, and the AI
does not receive or invent learner messages.

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
