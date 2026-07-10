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

## Node fallback image as primary visual source

Changed to dark/light node images.

Reason: the fallback image concept came from the early icon-based tile prototype. The current visual direction needs images to be the main node artwork, with separate dark and light variants for theming. The old fallback image field was removed from the node editor.

## Icon key as the main tile visual

Changed to image-first tile visuals.

Reason: the long-term platform direction is configurable landscape/map artwork rather than small symbols. If an admin hides a node image, the map should not quietly replace it with an unrelated default icon.

## Static admin/user-only permission model

Changed to configurable roles with resource permission levels.

Reason: the project quickly grew beyond a single admin switch. User management, role management, world editing, assets, sounds and presentation need separate access decisions. New features should add permission resources and use gates instead of hard-coding role names.

## Visuals inside tools/items/currencies

Changed to separate administration areas.

Reason: tools, items and currencies are world objects. Images, animations and sounds are reusable media layers that can be referenced by many world objects and activities. Keeping them separate prevents the object menu from becoming a generic file cabinet.

## Re-uploading the same image everywhere

Changed to reusable media selection.

Reason: admins will often reuse backgrounds, portraits, node art and animations. Upload fields should offer upload, download, select existing and clear current reference so assets can be reused without duplication.

## Playing activities inside the map side panel

Changed to a separate node-play page.

Reason: keeping the full map active while playing activities adds visual and browser complexity. The map side panel now describes the node and offers route starts; the activity player runs on a separate page.

## Obstacle activity as one-time skipped activity after clearing

Changed to configurable replay behavior.

Reason: some obstacles should reappear for practice, while others should remain cleared for learner continuity. When an obstacle stays cleared, the learner should still see an authored revisit state instead of silently skipping context.
