# Competence Evidence Ledger

The evidence ledger is the learning substrate behind the star map. It records
what kind of learning interaction happened without turning those interactions
into a learner-facing checklist or score.

## Evidence types

The first activity-derived categories are:

- `participate` for generic activity completion where the current activity does
  not provide stronger evidence semantics.
- `retrieve` for question activities.
- `reflect` for reflection activities.
- `explain` for shared-task and learner-message activities.
- `apply` for obstacle activities.
- `review` for an authored return to earlier material, where the learner can
  reconnect, retrieve, or notice a change in understanding.
- `transfer` is reserved for authored transfer tasks.

Each event also records a contribution value used only to calibrate the visual
map, an outcome, and an assistance level. The current prototype uses
`untracked` assistance until activities capture meaningful assistance details.
In the selected-light reading, these categories are paired with plain-language
descriptions so learners can understand the kinds of moments represented by a
light without seeing the internal event record.

## Activity learning purpose

An activity renderer and its learning purpose are separate decisions. A tutor
can keep an existing activity surface (for example, a markdown scene,
reflection, obstacle, or message) and label the intended learning purpose as
`review`, `retrieve`, `explain`, `apply`, `reflect`, `participate`, or `transfer`.
Existing activities infer a purpose from their type until a tutor chooses a
more precise one.

The purpose describes the opportunity the activity creates; it is not a claim
that competence increased immediately. Repeated exposure, retrieval,
reflection, and later application can form a pattern whose meaning becomes
clear only over time. The star map therefore remains a qualitative reflection
of accumulated evidence rather than a live test result.

## Rendering rule

The learner map aggregates events by topic and derives a visual profile. It does
not expose event counts, contribution totals, or evidence categories as grades.
The categories remain available to future explanations, support conversations,
and richer star-map lenses. The map explains its visual channels in the learner
surface: size represents how established a pattern is over time, glow represents
activity in the current month, and paths represent topics encountered together.
These are interpretive signals, not a hidden score scale presented in disguise.

## Learning pulse check-in

After an authenticated activity completion, the learner may choose a short
phrase describing the experience: something clicked, still taking shape, it
stretched me, or I got stuck. They can also continue without answering.

This is a learner-owned observation, not an evidence event, competence score,
diagnosis, or answer for an AI system. The prototype keeps a bounded history in
that learner's activity-progress metadata so it can support later reflection
without changing the star-map calculation or exposing a new tutor ranking. When
an activity is connected to competence topics, the learner can follow that
context back to the related light without seeing the internal topic weights.
Each pulse entry also offers a route back to its node; this is a learner-chosen
revisit path, not a remediation assignment or a claim that the learner is
behind.

Selecting a light can also offer an optional return to the latest learning
place that contributed to that topic. The link is a doorway back into the
world, not a required next step or a corrective assignment.

When a reflection is authored with the `review` learning purpose, the learner
sees it as `Review / revisit` with language that invites comparison over time.
It still uses the private reflection journal and does not become a test or
require the learner to prove that competence increased.

The activity editor receives the active competence-topic vocabulary as gentle
authoring guidance. Existing labels are suggested while free-text entry remains
available for a genuinely new concept. This keeps the ledger's categories
consistent enough for meaningful aggregation without turning the vocabulary
into a rigid curriculum or a learner-facing taxonomy.

## Next evolution

Next, add confidence and feedback outcomes where the activity actually collects
them, without making a feeling check or reflection require an answer from the
learner.
