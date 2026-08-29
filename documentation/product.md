# Product Direction

Wicked Learning is an evolving, domain-agnostic environment for explorable
learning. It is an experimental product and research prototype, not a claim
that one interface or one learning theory can mechanically produce learning.

This document answers: **what is Wicked Learning, and what should remain true
as the implementation changes?** It describes durable product direction. For
implemented behavior, use [Feature Overview](features.md). For implementation
structure, use [Architecture Notes](architecture.md). For active work, use
[Roadmap](roadmap.md).

## Purpose

Wicked Learning explores learning through curiosity, meaningful activity,
understanding and learner choice rather than retention mechanics, external
rewards or competitive status. A deployment can use a forest, workshop,
laboratory, archive or another story without changing the underlying learning
model.

The platform should help a learner:

- understand where they are and what they can do;
- encounter ideas in a context that invites exploration;
- act, retrieve, explain, apply or reflect in meaningful ways;
- receive useful, informational feedback;
- notice patterns in their own learning over time; and
- choose a sensible next direction without manufactured urgency.

The map is a spatial representation of knowledge and activity, not a course
list. Spatial presentation is meaningful, but it must remain an accessible
doorway into learning rather than decoration that hides the available choices.

## Design lenses

Self-Determination Theory, retrieval and spacing research, Cognitive Load
Theory, Multimedia Learning, self-regulated learning, accessibility, privacy
and humane game design inform decisions. They are lenses for asking better
questions, not algorithms that determine a feature automatically.

Research findings should be translated into bounded hypotheses and tested
features. The project must not claim that a star, route, reflection or AI
interaction proves competence or motivation on its own.

Useful foundations include [Ryan and Deci on Self-Determination
Theory](https://doi.org/10.1037/0003-066X.55.1.68), [Roediger and Karpicke on
test-enhanced learning](https://doi.org/10.1111/j.1467-9280.2006.01693.x),
[Cepeda et al. on distributed practice](https://doi.org/10.1037/0033-2909.132.3.354),
[Sweller on Cognitive Load Theory](https://doi.org/10.1016/S0959-4752(01)00018-4),
[Mayer and Moreno on multimedia learning](https://doi.org/10.1207/S15326985EP3801_6),
and [Panadero's review of self-regulated learning](https://doi.org/10.3389/fpsyg.2017.00422).
Accessibility work follows the [Web Content Accessibility Guidelines](https://www.w3.org/TR/WCAG22/)
as a practical baseline, not as a substitute for testing with people.

## Product principles

### Autonomy

Offer meaningful choices, multiple routes where they are pedagogically useful,
normal retries and learner control over optional reflection or support. A
choice is only autonomy-supportive when the learner can understand its effect
and can continue without shame or coercion.

### Competence

Give informational feedback, useful context, inspectable evidence and chances
to try again. Competence is a developing interpretation of learning encounters,
not a single hidden number. The learner should be able to understand what a
surface represents without needing to decode an algorithm.

### Relatedness

Make cooperation, reciprocal help and shared work possible without turning
participation into popularity, public status or a requirement for belonging.
Support requests, peer responses and group work need consent, moderation and a
clear exit.

### Exploration

Maps, places, tools, obstacles, portals and activity routes should make
discovery meaningful. Exploration may be open-ended, but the learner should
always be able to orient themselves, return to a known place and understand
which actions are available.

### Orientation

The platform should explain context, route choice, current location and next
actions at the point they matter. Navigation is part of the learning
experience, not an afterthought. Bounded sections and pagination are preferred
to letting an arbitrary collection push important actions outside the view.

### Wellbeing

Do not manufacture urgency, shame, fear of missing out, streak pressure or
compulsive return loops. Revisit support should be quiet, optional and
learner-controlled. Sound, animation and visual intensity should be adjustable
and respectful of reduced-motion and other accessibility preferences.

### Agency over AI

AI may assist authoring, feedback or exploration, but it is configurable,
inspectable and optional. Humans remain responsible for decisions that affect
learning content. AI should not become a hidden evaluator or a required path
through the platform.

## Core product model

```text
World
└── Map
    └── MapAsset
        └── Activity route
            └── Activities
```

- Worlds provide a configurable context and visual/narrative frame.
- Maps are explorable spatial learning surfaces.
- MapAssets are learner-facing places or objects on a map.
- Routes offer authored ways through activities without implying one compulsory
  curriculum path.
- Activities are the actual learning interactions: for example retrieval,
  dialogue, reflection, explanation, application, collaboration or travel.
- Tools and items change what learners can do or discover when that change has
  a meaningful learning purpose.
- The Journal belongs to the learner and holds private notes and reflections.
- Competence surfaces help learners notice patterns in learning evidence over
  time; they are not a score or ranking.
- Topics and paths provide semantic and prepared ways to find material beside
  spatial exploration.

The internal compatibility model may use different names or records. That is
an implementation concern and belongs in [Architecture Notes](architecture.md),
not in the learner's product model.

## Learner experience

The intended loop is:

```text
orient → explore → encounter → act / think →
receive useful feedback → reflect / connect → choose what comes next
```

Not every activity has to contain every step, and not every learner has to
follow the same sequence. A route is a supported way in, not proof of learning
and not the only valid path.

Evidence describes kinds of encounters over time. A participation event can
show engagement; a later independent retrieval can show successful recall; an
explanation or transfer task can provide different evidence. These claims must
remain distinct rather than being collapsed into one disguised score.

The qualitative competence map and topic trails should therefore answer
“what can I notice or revisit?” rather than “how many points did I earn?”.
Learner words, confidence and assistance context are private by default. The
implemented sharing path is an explicit learner request for feedback on a
selected journal page and selected eligible domain; it does not make journal
content generally visible to staff or peers. The request is then available in
the permission-controlled feedback queue; the separate support-signals view
receives scoped evidence signals, not journal text.

## Authoring philosophy

Wicked Learning is also an engine for building learning worlds.

- Domain-specific presentation belongs to authored or deployment-configured
  content.
- Generic learning mechanics belong in reusable backend and frontend modules.
- Administrators should be able to create meaningful structure without changing
  source code.
- Authoring tools should make pedagogical intent visible without pretending to
  automate pedagogy.
- AI-generated content remains reviewable and must not mutate the world without
  explicit human approval.
- Existing content, routes, media and references should be inspected before
  proposing new structures.
- Complexity should be introduced when an actual authoring need justifies it,
  not because an earlier concept draft imagined a larger system.

## Established boundaries

- There is no global point total, competitive learner ranking or streak
  progression model.
- Maps remain freeform and domain-configurable.
- Activities use graph-based composition with optional route starts.
- Learner reflections and journal pages remain learner-owned by default.
- Administration is separate from the normal learner map flow.
- AI is optional, scoped and subject to human review for content-changing work.
- Internal numeric values may support consistent rendering, but learner-facing
  competence language remains qualitative and interpretable.
- Privacy, accessibility and source provenance are product requirements, not
  post-processing tasks.

## Developing direction

The following areas are important but not settled product rules:

- richer evidence semantics for quality, confidence, assistance and transfer;
- transparent retrieval and spacing support controlled by the learner;
- inspectable sources and reusable excerpts;
- optional regulation and focus support;
- effort-preserving learner AI with assistance-aware evidence; and
- meaningful peer explanation, help and shared work.

These are hypotheses to implement in small slices, evaluate and revise. The
active order is maintained in [Roadmap](roadmap.md).

## Open questions

- Which evidence combinations are strong enough to support a learner-facing
  narrative, and which should remain only private research data?
- How can retrieval support remain transparent and useful without becoming a
  compulsory queue or a maintenance burden?
- What kinds of peer help improve understanding rather than message volume?
- How should a learner control AI assistance while preserving independent
  evidence and avoiding unnecessary effort?
- Which privacy-conscious measures can evaluate delayed recall, transfer,
  calibration, motivation and AI-off performance without creating learner
  surveillance?
- When does a playful visual mechanic clarify learning, and when does it become
  a reward loop or cognitive distraction?

Changes to these boundaries should be explicit, evidence-informed and reflected
here before they become platform-wide abstractions.
