# Reusable Media, Tools And Sounds

The platform now has three related but separate concepts:

- reusable media assets
- learner tools
- reusable sounds

They should stay separate because they answer different questions.

## Reusable media assets

Reusable media assets are files that can be referenced by many configuration forms. A background image, node image, NPC portrait, route preview or animation should not need to be uploaded again every time it is reused.

Current behavior:

- Image inputs should offer upload, download, select existing and clear.
- Clearing a field removes the reference from that one configuration. It does not delete the uploaded asset.
- Selecting existing media opens a searchable/scrollable library of already uploaded or generated assets.
- Visual assets are administration-level resources, not learner rewards.

Future direction:

- Add safer replace/delete behavior with clear warnings about which objects reference an asset.
- Add tags or categories so domains can group media by world, character, map, topic or visual style.
- Add better preview metadata for transparent images, animated images and large backgrounds.

## Learner tools

Tools are reusable learner capabilities. They are configured by admins and acquired by learners through activity routes.

Current behavior:

- Tools have dark/light images.
- Tools can have dark/light animation images or GIFs.
- Resting image width and animation width are configurable.
- Animation duration is configurable.
- A tool can be granted by a standalone tool-grant activity or by an NPC dialogue node.
- A tool can be selected from the floating side action bar.
- An equipped tool follows the cursor until used, cancelled with Escape, or toggled off.
- Tools can resolve obstacle activities.
- Tools can reveal hidden nodes on the world map when the node is configured for that tool.

Design notes:

- Tools are not badges. They should not create status pressure.
- Tools should increase capability, access or interpretation in the world.
- A learner who already owns a tool should not be forced through the same acquisition moment again.

Future direction:

- Add items and currencies only when their learning purpose is clear.
- Add optional tool categories, such as scanner, key, brush or measuring device.
- Add richer tool animations later if GIF/WebP assets become too limiting.

## Reusable sounds

Sounds are reusable audio assets with playback metadata.

Current behavior:

- Sounds have a name, slug, icon category and file URL.
- Sounds can configure volume.
- Sounds can loop for ambience or background music.
- Sounds can optionally play only the first configured number of seconds.
- The frontend sound player supports layered playback, so ambience and effects can play together.

Design notes:

- Sounds should support atmosphere, feedback and orientation without becoming reward jingles.
- Volume defaults should be conservative.
- Future playback should respect user comfort settings such as mute, reduced motion-like audio comfort, or separate ambience/effects sliders.

Future direction:

- Add sound picker fields to activity editors.
- Add map ambience and activity ambience.
- Add interaction sound effects for portals, tool use, dialogue typing and obstacle clearing.
- Add accessible controls for muting or reducing sound intensity.
