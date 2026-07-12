# Codex Conversation: Learning Worlds Continued

- Project: `D:\Repositories\learning`
- Conversation date: `2026-07-12`
- Export note: this is a condensed conversation record. Hidden system/developer instructions, shell output, and repetitive verification details are intentionally omitted.

## 1. Public Source, Licensing And Governance

WickedJack99 decided the application code should use AGPLv3 and that bundled default media should use a separate CC0-style public-domain dedication.

Implemented direction:

- Added AGPL project governance files and notice text.
- Added an asset license note for bundled default media under `public/images` and `public/sounds`.
- Removed Laravel default icon assets from public defaults.
- Added a public source-code page and a small source icon link so network deployments can expose corresponding source code.
- Made the source page configurable for downstream deployments that need to link their modified sources.

## 2. Public Presentation And Cursor Configuration

The welcome page and public/auth presentation settings continued to evolve.

Implemented direction:

- Removed duplicate About navigation from the welcome header.
- Added Home/Back style navigation improvements on public information pages.
- Made public welcome colors more configurable, including accent-linked controls.
- Cleaned up welcome page button borders and light/dark toggle styling.
- Added cursor configuration for multiple cursor states, including default, action pointer, text input, grabbing and unavailable/denied states.
- Added cursor image size settings and preview areas so cursor tip alignment can be tuned.

## 3. Reusable Media And Fantasy Assets

WickedJack99 wanted richer fantasy-style default visuals while keeping deployments free to remove or replace defaults.

Implemented direction:

- Replaced simple mentor placeholder SVGs with richer fantasy-oriented PNG portraits.
- Added fantasy cursor images, pickaxe images and pickaxe animation.
- Added activity backgrounds and fantasy node/tile images.
- Kept generated tile source images square/borderless where useful, because runtime hex tiles clip them into shape.
- Continued improving reusable media selection so image fields can upload, download, select existing and clear current references.

## 4. World Map And Map Configuration

The world map and admin map editor gained more persistent configuration and lifecycle behavior.

Implemented direction:

- Added backend storage of the learner's last map so the bottom map navigation can return them to their current world.
- Added map deletion with cleanup for related nodes, portal links, learner state references and stale unlock-rule references.
- Added full-page map configuration for map details, visuals, access and deletion.
- Moved dense map-level configuration out of tiny overlay buttons.
- Added dark/light visual value editing without changing the admin screen's own appearance.
- Added preview-driven visual sections for map controls such as title panel, node side panel, bottom nav and right control bar.
- Added configurable decorative map assets with image, x/y placement, width and opacity.

## 5. Node State And Unlock Rules

Node visibility and access continued moving toward rule-based control.

Implemented direction:

- Locked nodes can be controlled from the node editor.
- Locked nodes remain visible but are dimmed and show a lock.
- Tool interactions remain possible on locked nodes if a configured unlock rule requires a tool.
- Unlock conditions can combine node completion rules, tool unlocks and time-based conditions.
- Admins can reset per-user unlock state with a lock-for-all action.
- Hidden tile titles are still shown while hovering or selecting so image-first maps remain readable.

## 6. Activity Playback And Route Progress

WickedJack99 noticed refreshes and returns should not restart the wrong activity or duplicate grants.

Implemented direction:

- Added backend route progress tracking for current route run state.
- Added a fast return path from the bottom play button to the last active route/activity.
- Added route reset behavior from the node panel.
- Added current NPC dialogue bubble state so browser refresh can resume inside a dialogue instead of jumping to its first bubble.
- Kept URLs cleaner by preferring backend state over exposing activity internals in query parameters.

## 7. Portal Activities

Portal activity behavior and visuals were refined.

Implemented direction:

- Entry portals own travel links to exit portal activities.
- Exit portals are receiving activities and are not shown as normal route-start buttons.
- Exit portals can choose whether the arrival scene is displayed or skipped.
- Portal visuals support dark/light background and foreground images, mirroring, foreground position/width, swirl rotation, duration and click-to-enter mode.
- Portal preview and runtime rendering were aligned so previews better match playback.
- Fixed an exit portal save issue where empty target fields could prevent exit-portal settings from being stored.

## 8. Items, Tools And Obstacles

Consumable items and reusable tools were expanded.

Implemented direction:

- Added item inventory behavior with item counts.
- Grant-item activities can give configured items and quantities.
- Item-grant playback now displays received items directly instead of generic package text.
- Item display grows only as needed up to three columns.
- Tools unmount from the cursor after use and can be cancelled with Escape.
- Obstacle activities can place obstacle images by x/y/width and preserve placement while transitioning to the cleared image.
- Obstacle hover behavior no longer shifts the obstacle image.
- Obstacle settings use dropdowns for available tools instead of raw ids.

## 9. NPC Dialogue And Activity Visuals

NPC dialogue visuals moved from one portrait/background pair toward composable scenes.

Implemented direction:

- NPC dialogue stages can use multiple image assets with x/y position, width and horizontal mirroring.
- This allows portraits, props, foreground covers, regional bubble frames or other layered storytelling assets.
- Activity visual forms gained more mirroring options for images and backgrounds.
- Activity configuration menus continued moving toward grouped responsibility tabs and preview scenes.

## 10. Documentation And Concept Sync

The documentation and current concept files were updated to reflect:

- generic domain-agnostic positioning
- AGPL code license and CC0 bundled default media
- public source-code page
- route progress persistence
- richer map configuration
- node unlock rules
- reusable media, tools, items and sounds
- portal Entry/Exit behavior and persistence details
