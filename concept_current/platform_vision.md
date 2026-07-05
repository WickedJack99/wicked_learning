# Platform Vision

Learning Worlds is an open-source learning platform experiment focused on intrinsic motivation.

The platform should help learners explore knowledge through configurable worlds, maps, nodes, characters and activities. It should not rely on points, streak pressure, public rankings or status rewards as the main reason to return.

The product goal is to support:

- Autonomy: learners can choose meaningful paths and retry without shame.
- Competence: feedback helps learners understand what improved and what to inspect next.
- Relatedness: future social features should support cooperation and care, not comparison.
- Wellbeing: learning loops should feel inviting, active and humane.

The first implementation is intentionally small, but now contains more than the learner slice:

- One seeded world map with configurable hex nodes.
- A small activity graph with dialogue, question, review and reflection activities.
- A themed welcome and authentication flow.
- Authenticated light and dark appearance preferences.
- Settings navigation with user-facing and admin-facing panels.
- Admin registration-token and user-access management.
- Editable platform information pages for About, Imprint and Data Protection.

The platform should stay generic. A deployment about medieval history, astronomy, cybersecurity or biology should be able to change visuals and story framing without rewriting learning logic.
