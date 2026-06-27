# Purpose

Define learner-to-learner hint messages placed at the beginning of nodes.

The system should support generous peer guidance. It should not treat hints as cheating or attempt to prevent all spoilers.

# Core Concepts

- Player hint: Public or semi-public message from a learner to future learners.
- Hint board: Node-level message area shown near the beginning of a node.
- Visibility scope: Who can see a hint.
- Moderation state: Review status for safety and quality.
- Helpful signal: Lightweight feedback on whether a hint helped.

# User Experience

## Learner Experience

Learners can read messages from those who came before. They may post advice, warnings or perspective before or after completing a node depending on configuration.

Hints should feel like guidance, not illicit shortcuts.

## Admin Experience

Admins configure hint availability, moderation rules and visibility. They can remove abusive, unsafe or irrelevant hints.

# Data Model Draft

`node_hints`
- purpose: Store learner messages for a node.
- important_fields: `id`, `node_id`, `author_user_id`, `body`, `visibility_scope`, `moderation_state`, `created_at`, `deleted_at`.
- relationships: Belongs to node and author.

`node_hint_reactions`
- purpose: Store lightweight usefulness feedback.
- important_fields: `id`, `hint_id`, `user_id`, `reaction_type`, `created_at`.
- relationships: Belongs to hint and user.

`node_hint_reports`
- purpose: Store moderation reports.
- important_fields: `id`, `hint_id`, `reported_by_user_id`, `reason`, `status`, `created_at`.
- relationships: Belongs to hint.

# Relationships

A node has many hints. A user can author many hints. Hints can receive reactions and reports.

# State and Lifecycle

Hint states: `draft`, `visible`, `hidden_by_moderation`, `reported`, `removed`.

If pre-moderation is enabled, hints move through `pending_review` before `visible`.

# Configuration Options

Admins can configure whether hints are enabled per world/map/node, who can post, whether completion is required to post, visibility scope, moderation mode and reaction types.

# Visual Configuration

Hint boards must be themeable. They may appear as message boards, terminals, camp notes, beacon logs, constellations of notes or minimal panels.

Configurable assets include board icon, message card style, author display mode, report icon and helpful indicator.

# API / Backend Responsibilities

The backend should list visible hints, create hints, enforce visibility scopes, handle reports, apply moderation and protect author privacy according to configuration.

# Frontend Responsibilities

The frontend renders the hint board at the beginning of the node, posting form, helpful reactions and report actions. It should avoid framing hints as spoilers by default.

# Admin Interface

Required screens include hint moderation queue, reported hints, node hint settings and author activity audit for abuse cases.

# Permissions and Privacy

Learners see hints allowed by scope. Author display may be name, anonymous or pseudonymous depending on privacy settings. Admins can moderate but should not expose private identities unnecessarily.

# Edge Cases

- Hint contains incorrect advice.
- Hint reveals the exact answer to a question.
- Learner posts abusive content.
- Node is duplicated or moved.
- Author deletes account.

# Open Questions

- Should posting require node completion?
- Should hints be anonymous by default?
- Should hints be sorted by newest, helpfulness or curated order?
- How strict should moderation be about direct answers?

# MVP Scope

- Node hint board.
- Create and list visible hints.
- Report hint.
- Admin moderation.
- Configurable anonymous display.

# Later Extensions

- Helpful ranking.
- Cohort-only hints.
- AI-assisted moderation.
- Contextual hint categories.
