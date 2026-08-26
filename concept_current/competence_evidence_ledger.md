# Competence Evidence Ledger

The evidence ledger is the learning substrate behind the star map. It records
what kind of learning interaction happened without turning those interactions
into a checklist or score. Learner topic pages and selected-light readings may
show a bounded, linked set of recent moments from the ledger as orientation.

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
The categories support explanations, topic trails, support conversations and
richer star-map lenses. The map explains its visual channels in the learner
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

When a learner selects a light, the map can show up to three recent pulse
observations connected to that topic. They remain the learner's own words and
simple feeling labels: they are not converted into evidence, interpreted by
AI, or used to adjust the visual signal.

Selecting a light can also offer an optional return to the latest learning
place that contributed to that topic. The link is a doorway back into the
world, not a required next step or a corrective assignment.

When a reflection is authored with the `review` learning purpose, the learner
sees it as `Review / revisit` with language that invites comparison over time.
If earlier private reflections exist in the same journal category, the
activity can offer up to three of them as optional, collapsible context before
the learner writes. The learner can skip the comparison; the notes are never
graded, summarized into a competence claim, or sent to AI as part of this
context.

The activity editor receives the active competence-topic vocabulary as gentle
authoring guidance. Existing labels are suggested while free-text entry remains
available for a genuinely new concept. This keeps the ledger's categories
consistent enough for meaningful aggregation without turning the vocabulary
into a rigid curriculum or a learner-facing taxonomy.

Learner activity surfaces may name the related learning areas so the learner
can connect an activity with the wider trail. A competence area and a formal
learning topic do not need to be the same concept: topic pages can connect
evidence through the published map where it was encountered while retaining
the competence area as its own category. Topic pages can offer the connected
area as a focused star-map doorway and retain a bounded link to the learning
moment that formed the trail. The internal contribution
weights are not included in learner responses and are never presented as
points. When a topic has a stable slug, its label can open that light directly
on the star map; this is an optional orientation link, not a required route.
The optional completion pause can repeat these labels beside the learner's
feeling check-in. When a label has a stable topic slug, it can open that
topic's focused competence reading; this is a learner-chosen orientation link,
not a claim that the activity produced an immediate change.

Published topic pages also show the authored learning areas woven through their
accessible map activities, even before the learner has recorded evidence. Each
area links to its focused star-map reading and names the learning purposes
present in that topic. This describes the opportunities a topic offers without
turning the topic page into a curriculum checklist.

## Next evolution

Next, add confidence and feedback outcomes where the activity actually collects
them, without making a feeling check or reflection require an answer from the
learner.
