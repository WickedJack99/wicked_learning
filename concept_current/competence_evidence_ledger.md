# Competence Evidence Ledger

The evidence ledger is the learning substrate behind the star map. It records
what kind of learning interaction happened without turning those interactions
into a checklist or score. Learner topic pages and selected-light readings show
a bounded, linked set of recent moments from the ledger as orientation. The
current window is twelve events, presented in small paginated groups so a
longer history remains inspectable without expanding the reading panel
indefinitely.

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
When a question activity records a correct or incorrect answer, that concrete
outcome is retained on the internal event alongside the retrieval evidence.
It does not change the contribution, star rendering or learner-facing labels.
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
activity in the trailing 30-day window, and paths represent topics encountered together.
These are interpretive signals, not a hidden score scale presented in disguise.

Learner-facing copy should describe what a person can notice, choose or revisit
in positive terms. Avoid defensive explanations about what the map is not
unless a specific interaction could otherwise be misunderstood.

## Learning pulse check-in

After an authenticated activity completion, the learner may choose a short
phrase describing the experience: something clicked, still taking shape, it
stretched me, or I got stuck. They may also add a brief private note in their
own words, or continue without answering.

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
AI, or used to adjust the visual signal. Notes are bounded to 500 characters
and kept in the same private activity-progress history as the feeling phrase.

The related topic page can show up to four of the learner's recent pulse
observations when their connected learning areas belong to that topic. This
keeps reflection close to the subject where it happened and links each entry
back to its learning place. The topic page does not turn these observations
into a progress measure.

Selecting a light can also offer an optional return to the latest learning
place that contributed to that topic. The link is a doorway back into the
world, not a required next step or a corrective assignment.

When a reflection is authored with the `review` learning purpose, or when an
explicit `review` activity is used, the learner sees `Review / revisit` with
language that invites comparison over time.
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

When a connected area also has learner evidence, its focused topic-page link may
include the same qualitative evidence vocabulary used by the star map. Keep this
inside the existing area surface so one area is not repeated as a second ledger
or checklist. If the area maps to a separate formal topic, retain that topic as
a small related-topic doorway rather than repeating the evidence narrative.

When a learner revisits a question they have answered before, the activity may
offer a compact, collapsible view of up to three earlier tries. It can show the
chosen option, starting sense and feedback outcome so a learner can notice a
change in their own reasoning. This is a reflection aid, not an attempt counter,
grade or public performance signal.

When a topic has at least two private reflections connected to its published
map, the topic trail can place the earliest and latest reflection side by side.
This bounded before-and-after view keeps the learner's own words central and
links back to the Journal for the complete record. It is available as an
optional look back, not a verdict about improvement; a single reflection stays
in the Journal and does not create an empty comparison panel.

The Paths directory uses the same area labels on route cards. This keeps a
prepared route connected to the competence reading without implying that
following the route is the only way to develop an area.

When a learner opens an area from a topic page, the competence reading retains
that topic as its return context. This is navigation state only: it does not
make a competence area into a formal topic or change how the star map is
calculated.

The learning desk uses the same compact links on current and recent route rows.
This keeps the learner's return surface connected to the same authored context
without adding another progression view.

## Feedback guidance

Every activity can optionally carry a small feedback guidance contract with
three author fields: the purpose of the task, something observable to notice in
the learner's response or action, and one useful next action. The contract is
not a learner result and does not create a score. Playback shows the guidance
beside the activity so the learner has a clear frame for the work; the scoped AI
review checks whether each part is concrete enough to support informational
feedback. Empty guidance remains valid for activities where it would add
clutter.

## Next evolution

Continue adding confidence or feedback outcomes only where an activity actually
collects them, without making a feeling check or reflection require an answer.
The completion pause now also stores an optional learner-chosen next direction
(`revisit`, `related` or `settle`) beside the private observation. This is
orientation for later, not evidence of immediate growth. Future revisit support
uses a small learner-controlled spacing window in the Journal. Learners can
postpone or hide an invitation; it creates no notification or required queue.
Retrieval-specific prompts remain a later refinement.

Question retrieval is the first activity-specific calibration slice. Each
attempt keeps its correctness outcome, the confidence chosen before feedback,
its attempt order and whether the attempt was answered independently. The
competence reading surfaces that context beside the learning moment so a
learner can notice changes in certainty without turning the trail into a
grade. Other activity types remain on the broader evidence-contract roadmap
until they collect equally meaningful signals.

An activity may also carry a short author-written context sentence explaining
why a learner might choose one of the three directions after that activity.
The sentence is shown above the choices and does not change their meaning or
make a choice required. Keeping this context separate from the private
check-in preserves the learner's own reflection while giving the author a way
to make the choice relevant to the task.
