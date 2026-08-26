# Competence Visual Language

The competence map is a learner-facing visual interpretation of internal
learning signals. It is not a score display, reward inventory, ranking or
comparison surface.

## Current calibration

The backend `CompetenceVisualScale` converts the existing stored topic signals
into three bounded ratios:

- `sizeRatio` controls the star's base size and uses the topic growth threshold.
- `brightnessRatio` controls the star's presence and uses the topic brightness
  threshold.
- `auraRatio` controls the surrounding aura and uses the current-period signal.

The learner reading translates the aura ratio into a qualitative recent-rhythm
description. It can say that recent learning is gently or strongly lighting an
area, or that the glow is resting while the established pattern remains. The
description does not expose the ratio, threshold or event count.

The selected-light reading also shows a bounded learning trail of months in
which the topic appeared. These markers make continuity visible without
turning the map into an activity counter or requiring the learner to maintain a
streak.

The ratios are capped at `1` and are converted into stable visual tiers:
`spark`, `star`, `beacon` and `constellation`. Learner accessibility text uses
the tier description instead of exposing raw totals or thresholds.

The demo now stores immutable `LearnerEvidenceEvent` records instead of
cumulative competence and monthly point tables. Each event records its topic,
evidence type, contribution, outcome and assistance state. The visual contract
can therefore change its aggregation rules without changing the learner's map
experience.

## Design boundaries

- Internal numeric values may support consistent rendering, but they are not
  learner goals.
- A brighter or larger star must never imply that one learner outranks another.
- Recent activity may gently affect the aura, but competence must not decay as a
  pressure mechanic.
- Future evidence categories should enrich the visual profile rather than turn
  the learner map into a dashboard of LMS metrics.

## Next evolution

Add explicit evidence events behind this contract. Retrieval, explanation,
application and transfer can then contribute to a topic profile without
changing the learner's primary experience of exploring worlds and places.
