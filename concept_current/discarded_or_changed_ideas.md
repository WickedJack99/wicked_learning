# Discarded Or Changed Ideas

## Linear node activity sequence

Changed to node activity graph.

Reason: a graph supports autonomy and richer learning encounters. A learner can review a clue, branch to a different activity, retry, or continue forward based on what happened.

## Global points

Rejected for the core platform.

Reason: points can shift attention from learning itself to earning an external token. This conflicts with the Self-Determination Theory direction.

## Competitive leaderboards

Rejected for the core platform.

Reason: leaderboards create social comparison and status pressure. Future relatedness features should support cooperation, shared reflection and mutual help instead.

## Full admin UI before a learner slice

Changed.

Reason: full content administration is still deferred, but concrete user administration is now needed early because registration tokens, roles, bans and disabled login shape how a public deployment can be operated safely.

## Authenticated system appearance option

Removed for now.

Reason: storing `system` in the backend caused ambiguous behavior between browser state, backend state and first render. Authenticated settings now store the resolved user choice. Public pages may still use a local unauthenticated preference before login.

## Inline registration-token creation form

Changed to overlay dialog.

Reason: displaying token roles, expiration picker and actions inline made the Users panel too convoluted. Token creation is a focused task and belongs in an overlay panel.

## Editing information pages from each individual settings page

Changed to a public presentation admin panel.

Reason: About, Imprint and Data Protection editing belongs with other public-facing presentation controls. Keeping those controls in one admin subpanel prevents the Settings main view from becoming too crowded.

## Editing controls inside the learner map

Rejected for now.

Reason: admins are also normal learners. Editing tools inside the learner map would make the learning view feel like a workbench. World editing now starts from Settings and uses separate admin pages.
