# Platform Vision

Learning Worlds is an open-source learning platform experiment focused on intrinsic motivation.

The platform should help learners explore knowledge through configurable worlds, maps, nodes, characters and activities. It should not rely on points, streak pressure, public rankings or status rewards as the main reason to return.

The product goal is to support:

- Autonomy: learners can choose meaningful paths and retry without shame.
- Competence: feedback helps learners understand what improved and what to inspect next.
- Relatedness: future social features should support cooperation and care, not comparison.
- Wellbeing: learning loops should feel inviting, active and humane.

Future collaboration should enable learners to work on meaningful projects together. A group might receive a project brief such as designing or developing a system, artifact or learning world that fits the group's current competence level. The platform should help turn that brief into feasible shared tasks, scaffold cooperation, and make progress visible without turning the group into a leaderboard.

One possible direction is to group learners and assign each group responsibility for designing a world, map or activity path around a topic. The platform would then support project planning, task distribution, review, iteration and presentation of the created world as part of learning, not as a separate project-management module bolted onto the side.

The first implementation is intentionally small, but now contains more than the learner slice:

- One seeded world map with configurable hex nodes.
- A small activity graph with dialogue, question, review and reflection activities.
- A themed welcome and authentication flow.
- Authenticated light and dark appearance preferences.
- Settings navigation with user-facing and admin-facing panels.
- Admin registration-token and user-access management.
- Editable platform information pages for About, Imprint and Data Protection.

The platform should stay generic and usable for any learning domain. A deployment should be able to change terminology, visuals, maps, characters, media and story framing without rewriting the core learning logic.
