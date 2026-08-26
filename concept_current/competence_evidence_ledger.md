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
- `transfer` is reserved for authored transfer tasks.

Each event also records a contribution value used only to calibrate the visual
map, an outcome, and an assistance level. The current prototype uses
`untracked` assistance until activities capture meaningful assistance details.

## Rendering rule

The learner map aggregates events by topic and derives a visual profile. It does
not expose event counts, contribution totals, or evidence categories as grades.
The categories remain available to future explanations, support conversations,
and richer star-map lenses.

## Next evolution

Add authored evidence configuration for activities that can distinguish
retrieval, explanation, application and transfer more precisely than activity
type inference. Then add confidence and feedback outcomes where the activity
actually collects them.
