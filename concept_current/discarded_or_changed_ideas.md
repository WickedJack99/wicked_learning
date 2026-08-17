# Discarded Or Changed Ideas

## Linear MapAsset activity sequence

Changed to an Activity graph with multiple route starts per MapAsset.

Reason: a graph supports autonomy and richer learning encounters. A learner can review a clue, branch to a different activity, retry, or continue forward based on what happened.

## Global points

Rejected for the core platform.

Reason: points can shift attention from learning itself to earning an external token. This conflicts with the Self-Determination Theory direction.

## Competitive leaderboards

Rejected for the core platform.

Reason: leaderboards create social comparison and status pressure. Future relatedness features should support cooperation, shared reflection and mutual help instead.

## Full admin UI before a learner slice

Changed.

Reason: administration grew incrementally beside usable learner slices. World
Builder, access, presentation, support, AI and API tools now exist, but each
area should still follow an exercised learner or authoring need rather than a
speculative all-purpose admin suite.

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

## Node/tile fallback image as primary visual source

Changed first to image-first tiles and then to freeform MapAsset artwork.

Reason: the fallback concept came from the early icon-based hex prototype. The
current surface uses transparent MapAsset images with optional highlighted
images and alpha-aware interaction. The old fallback field is not part of the
MapAsset editor.

## Icon key as the main tile visual

Changed to image-first, freely positioned MapAssets.

Reason: configurable map artwork should follow the visual shape of the learning
domain rather than a fixed icon or hexagon. Transparent MapAssets can overlap,
act as decorative layers or open learner content.

## Static admin/user-only permission model

Changed to configurable roles with resource permission levels.

Reason: the project quickly grew beyond a single admin switch. User management, role management, world editing, assets, sounds and presentation need separate access decisions. New features should add permission resources and use gates instead of hard-coding role names.

## Visuals inside tools/items/currencies

Changed to separate administration areas.

Reason: tools, items and currencies are world objects. Images, animations and sounds are reusable media layers that can be referenced by many world objects and activities. Keeping them separate prevents the object menu from becoming a generic file cabinet.

## Re-uploading the same image everywhere

Changed to reusable media selection.

Reason: admins will often reuse backgrounds, portraits, MapAsset art and
animations. Upload fields should offer upload, download, select existing and
clear current reference so assets can be reused without duplication.

## Playing activities inside the map side panel

Changed to a separate Activity playback page.

Reason: keeping the full map active while playing Activities adds visual and
browser complexity. The focused MapAsset panel describes the place and offers
route starts; the Activity player runs on a separate page.

## Obstacle activity as one-time skipped activity after clearing

Changed to configurable replay behavior.

Reason: some obstacles should reappear for practice, while others should remain cleared for learner continuity. When an obstacle stays cleared, the learner should still see an authored revisit state instead of silently skipping context.
