# Roadmap

This is a small strategic roadmap, not a changelog or an archive of completed
tasks. Finished work is represented by Git history and, when useful, by the
[Feature Overview](features.md). Detailed executable tasks belong in focused
issues or the implementation plan for the current slice.

Priorities reflect dependency and learning risk, not promised delivery dates.
The research direction was reconciled with the implementation on 22 August
2026. Evidence, retrieval, calibration and provenance foundations are mature
enough to support product work; new research instrumentation should wait for a
concrete learner or author need.

## Stabilization checkpoint

The current priority is to keep the existing learner and author journeys
trustworthy while their recent foundations settle. In particular, verify that
Companion context, assistance attribution, scoped authoring permissions and AI
capability disclosures follow the active activity and play run. Preserve the
privacy boundary around learner words, confidence and assistance context, and
keep AI unable to navigate or mutate content directly.

## Current product priorities

### Exploration and orientation

Improve continuity between the Learning Desk, routes, maps, places and
activities. Make next-step choices understandable without turning exploration
into a linear course or a score system. Continue improving focus order,
responsive layouts and recovery when a learner returns to an earlier place.

### Learning interactions

Deepen bounded retrieval, self-explanation, transfer and explanatory feedback
where an activity can support them meaningfully. Keep participation, recall,
reflection, application and transfer distinguishable, and let learners inspect
their own evidence without exposing a hidden competence score.

### Authoring and reuse

- Expand map, world, node-placement and activity histories into safe rollback
  and collaborative editing workflows. Activity history now includes outgoing
  route connections while keeping start routes and NPC dialogue graphs as
  separate authoring boundaries.
- Keep the bounded map, world and MapAsset import/export contracts stable as
  media packages are used in practice. Single-map, world and standalone
  MapAsset packages now transfer explicitly referenced uploaded media with
  reference handling; JSON world transfers remain reference-only.
- Add configuration profiles with visible inherited values and local
  overrides.
- Continue growing the private and organization-scoped activity-template
  library with clear versioning and broader asset-resolution controls.

### Cooperation and support

Extend shared tasks, peer explanation and Learning Support into optional,
privacy-conscious help and revision workflows. Evaluate whether support helped
resolve a learning need rather than ranking people, measuring message volume or
exposing private learner writing.

### AI and provenance

Continue guarded, reviewable authoring with bounded context and grounded
sources. Queue longer provider work only when real usage requires it. Expand
AI authoring to additional activity types and scoped proposals before saving;
do not build a general orchestration layer or give AI direct content or
navigation authority.

### Evaluation and optional expansion

Add privacy-conscious evaluation for delayed unaided recall, transfer,
confidence calibration, motivation, support quality and AI-off performance
when the corresponding learner experience is stable. Consider ambience,
purposeful tool or inventory interactions, richer map lenses and a browser
extension only when their learning purpose and privacy boundaries are clear.

## Explicit boundaries

- No hidden score, ranking, reward pressure or public competence comparison.
- No adaptive or AI-generated scheduling before the transparent retrieval
  baseline is measurable and understandable.
- No generic dashboard or broad visual redesign in place of improving the
  existing exploration and authoring language.
- No new documentation hierarchy; product rationale, current capabilities,
  technical truth and strategy remain separated in the existing documents.

## Roadmap decision rule

When choosing the next slice, prefer work that:

1. protects an existing learner or author workflow;
2. improves orientation, exploration or learning interaction quality;
3. reuses existing models, actions, queries, serializers and UI primitives;
4. preserves privacy and the qualitative meaning of evidence; and
5. can be tested with a focused behavioral or browser-level check.

If a proposal conflicts with the product boundaries, explain the intended
boundary change in this document and `product.md` before implementation.
