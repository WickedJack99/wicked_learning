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

The immutable event model, authored objective, lightweight concept-label and learning-purpose snapshots,
question calibration slice, optional completion-latency observation and
conservative learner evidence-claim layer are now the foundation. Retrieval
support can build on this without collapsing participation, retrieval and
transfer into a single hidden score. The first bounded reusable concept catalog
now supports stable authoring vocabulary without changing evidence snapshots.
Saved source records can now carry those labels, and copied activity provenance
snapshots retain the source concept context. Richer concept relationships and
source-to-concept linkage beyond this bounded snapshot remain open parts of
this contract.

### 2. Retrieval and spacing

Add transparent learner-controlled retrieval support: recall items, review
schedules, review attempts, deterministic due explanations, snooze and
replacement. The first finite return queue now persists its due state, queries
only bounded due candidates, and records explicit due-review attempts without
turning them into independent competence claims. It now also exposes when the
learner chose to return, the indexed ready time and the learner-facing pause
or postpone reason. Continue with transparent timing and richer review attempt
contracts. Adaptive or AI scheduling should wait until the baseline is
measurable and understandable. Reopened activity evidence now retains the same
attempt sequence as its corresponding review-attempt record, and question
revisits preserve their correctness and confidence in that record. Question
activities now pause after showing question feedback so an optional
post-feedback-confidence signal can be captured without collapsing it into the
answer or a score. They also provide a private, learner-controlled recall queue
links back to the existing activity without introducing a second scheduler.
Review history now retains whether a due return followed a learner's pause or a
later postponement, keeping the learner's spacing choice inspectable without
turning it into a performance measure.
The first transparent timing baseline for question recall is now implemented:
the desk distinguishes ready items from future items and explicit recall answers
record the next interval. Recall history also retains the optional confidence
reflection made after feedback. Richer review outcomes for other activity types,
including optional learner confidence before and after a review response and
learner-selected observable cues, are now partly supported; a small descriptive
review-outcome vocabulary is now also supported. Richer outcome contracts and
adaptive scheduling remain open.

### 3. Self-explanation and transfer

Add explicit authorable self-explanation and transfer task contracts with
observable rubrics. A reflection or completed activity must not silently count
as an explanation or a transfer demonstration. Feedback should describe the
observable response and invite a useful next action.
The current evidence-guidance slice preserves up to three author-written
observable cues for explanation and transfer moments. Reflection activities now
connect those cues to a task-specific learner response, with transfer also
recording the changed context named by the learner. Learners can also mark the
cues they noticed in their own response; this is a private self-observation
snapshot, not an automated assessment. Continue by adding richer feedback and
review contracts. Explanation, transfer and review responses with authored
guidance now also pause for a learner-controlled comparison with the purpose,
“what to notice” cues and possible next action, without treating these responses
or cues as a rubric pass.
Reflection and review completion also now stays at participation until the
matching private response is saved, so the evidence label reflects the learner
action that actually occurred.
Authors can also provide an optional response-feedback note for that pause; it
offers a bounded explanatory comparison without grading the learner. Richer
individualized feedback and independent checks remain open.

### 4. Explanatory feedback and calibration

Make confidence-before-feedback, explanatory critique and later independent
checks first-class where an activity can support them. Question answers now
preserve and explain a neutral confidence/result relationship after feedback.
Explanation and transfer activities now also collect optional starting
confidence before their authored guidance pause. Keep the existing
feedback-guidance contract; they may now also collect an optional confidence
signal after that pause and retain the pair for learner inspection. Continue
calibration only where the activity actually collects meaningful signals and
later independent checks can support a stronger claim.

### 5. Source provenance

The first slice now lets authors attach up to five bounded source references to
an activity, lets learners inspect them during playback, and includes them in
the scoped activity-review context. Authors can also save a validated source
reference to a bounded catalog and reuse it in another activity; the reuse
copies metadata into the activity so existing evidence snapshots remain stable.
The catalog now supports bounded author-side editing and deletion without
rewriting copied references, and each update preserves a paginated immutable
revision history for authors. The source catalog also supports Concept Library
labels that are copied into activity provenance snapshots and shown with
learner-visible sources, and authoring reuse can now filter by those labels.
Add richer concept linkage and reusable excerpts later. Authors can also
restore a listed revision without losing the current state. AI authoring now
accepts up to five explicitly selected catalog records as optional grounding
and stores their metadata and excerpts with the reviewable draft. The author
can now attribute those selected records per Activity during review, and only
those attribution snapshots are copied when the draft is applied. Continue
with richer concept linkage and reusable excerpts when the authoring contract
can express more precise support relationships.

### 6. Learner regulation and focus

Explore optional intent and time-box settings, transparent recommendation
reasons with alternatives, an optional focus workspace and authoring checks for
meaningful segmentation and accessible alternatives. These controls must reduce
friction without becoming deadlines, attention traps or opaque personalization.
The Learning Desk now exposes source-specific reasons for its active, recent,
revisit and recall areas; richer recommendation reasons and learner-selected
alternatives remain open.

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

- Add map ambience and dedicated portal and tool-use sounds. Dialogue-typing
  sound sets now have an initial implementation; broader sound authoring and
  additional sound layers remain future work.
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
