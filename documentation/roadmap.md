# Roadmap

This is a small strategic roadmap, not a changelog or an archive of completed
tasks. Finished work is represented by Git history and, when useful, by the
[Feature Overview](features.md). Detailed executable tasks belong in focused
issues or the implementation plan for the current slice.

Priorities reflect dependency and learning risk, not a promise of delivery
dates. The research priorities come from the 22 August 2026 review after
reconciling it with the implementation that exists today.

## Current research priorities

### 1. Evidence semantics

Complete the evidence-event contract without replacing qualitative competence
with a hidden score. Activity-appropriate evidence may include quality or
correctness, attempt number, confidence, assistance, latency, objectives,
concepts and source links. Different evidence types must retain different
meanings: participation, retrieval, reflection, explanation, application,
review and transfer are not interchangeable.

The immutable event model, authored learning-purpose snapshots, question
calibration slice, optional completion-latency observation and conservative
learner evidence-claim layer are now the foundation. Retrieval support can
build on this without collapsing participation, retrieval and transfer into a
single hidden score.

### 2. Retrieval and spacing

Add transparent learner-controlled retrieval support: recall items, review
schedules, review attempts, deterministic due explanations, snooze and
replacement. The first finite return queue now persists its due state, queries
only bounded due candidates, and records explicit due-review attempts without
turning them into independent competence claims. It now also exposes the
indexed ready time and learner-facing pause or postpone reason; extend it with
recall items and richer due explanations. Adaptive or AI scheduling should wait
until the baseline is measurable and understandable.

### 3. Self-explanation and transfer

Add explicit authorable self-explanation and transfer task contracts with
observable rubrics. A reflection or completed activity must not silently count
as an explanation or a transfer demonstration. Feedback should describe the
observable response and invite a useful next action.

### 4. Explanatory feedback and calibration

Make confidence-before-feedback, explanatory critique and later independent
checks first-class where an activity can support them. Keep the existing
feedback-guidance contract and question calibration work, then extend the
pattern only where the activity actually collects meaningful signals.

### 5. Source provenance

Add versioned sources and reusable excerpts with authorship, publication
metadata, rights and stable anchors. Link sources to activities, concepts and
AI-generated drafts so authors and learners can inspect the basis of factual
content and feedback.

### 6. Learner regulation and focus

Explore optional intent and time-box settings, transparent recommendation
reasons with alternatives, an optional focus workspace and authoring checks for
meaningful segmentation and accessible alternatives. These controls must reduce
friction without becoming deadlines, attention traps or opaque personalization.

### 7. Effort-preserving learner AI

Only deepen learner-facing AI after evidence and provenance foundations exist.
Define explicit assistance levels such as AI-off, questions-only, hints and
post-attempt support. Ground responses, disclose uncertainty and record
assistance so supported performance is not silently interpreted as independent
capability.

### 8. Privacy-conscious evaluation

Create research and operational measures for delayed unaided retrieval,
transfer, confidence calibration, need satisfaction, self-regulation, help
quality and AI-off performance. Keep these measures privacy-conscious and
separate from learner rankings or public success definitions.

### 9. Structured cooperation

Extend the existing shared-task and message foundations into structured peer
explanation, help and counterexample workflows plus mentor digests. Evaluate
the quality and resolution of intellectual support, not message volume,
popularity or public status. Participation remains optional.

## Product development

### Authoring and reuse

- Add version history, rollback and safe collaborative editing locks for maps
  and worlds.
- Add bulk import/export for maps and MapAssets with explicit reference
  handling.
- Add configuration profiles with visible inherited values and local overrides.
- Expand local activity templates into cross-map reuse only after context,
  asset and portal references have explicit resolution controls.

### Collaboration

- Expand shared tasks into project briefs, decomposition and assignment.
- Support peer review, revision and presentation of group work.
- Allow scoped group authoring of worlds, maps and routes with clear ownership
  and moderation boundaries.

### AI authoring

- Move longer provider executions to queued jobs with progress and cancellation.
- Add guarded administrator-selected context loaders and provider adapters.
- Expand reviewed authoring to questions, feedback, branching routes and wider
  world design.
- Add side-by-side authoring conversation for scoped inspection and proposed
  revisions before save or apply.
- Let the world-design assistant propose reuse, merging or extension before
  creating new content.

### Optional expansion

- Add map ambience and dedicated portal, tool-use and dialogue-typing sounds.
- Add currencies or merchant interactions only where their learning purpose is
  explicit and they do not recreate reward pressure.
- Add map lenses, richer competence relationships and learner notes when their
  interpretation is clear.
- Reconsider a browser extension only after core workflows are stable and its
  privacy boundary is explicit.

## Roadmap decision rule

When choosing the next slice, prefer work that:

1. protects an existing learner or author workflow;
2. establishes a contract needed by a higher-priority research capability;
3. improves evidence quality without inflating pressure or surveillance;
4. reuses existing models, actions, queries, serializers and UI primitives; and
5. can be tested with a focused behavioral or browser-level check.

If a proposal conflicts with the product boundaries, it must explain the
intended boundary change here and in the product document before implementation.
