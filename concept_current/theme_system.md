# Theme System

The platform must not hard-code one genre. A deployment can replace terminology,
maps, MapAsset art, characters, media and story framing without changing the
learning logic.

## Current Configuration

- Learner UI and Settings palette tokens with dark/light variants.
- Public text, learner-shell, journal and Settings palettes remain separate so
  each surface has an explicit owner.
- World accent and surface colors.
- Map background image, overlay, title panel and navigation surfaces.
- MapAsset border, highlight, highlighted border, label and highlighted label
  colors.
- Normal and highlighted MapAsset images with shared learner/editor preview.
- MapAsset image size, opacity, free position and Z depth.
- Locked, hidden, hinted, recommended, focused and completed visual states.
- NPC dialogue backgrounds, portraits, speech bubbles and authored text.
- Route preview images and overlay colors.
- Tool and item images with dark/light variants.
- Tool animation images, widths and duration.
- Item-obstacle backgrounds, overlays and state visuals.
- Markdown activity surfaces, colors and embedded media.
- Journal paper, leather edge, text and interaction colors.
- Reusable visual and sound assets.
- Configurable normal, action, grab, text and denied cursors.
- Authentication, welcome and public-page presentation settings.

## Appearance Behavior

- Authenticated appearance is stored in user preferences.
- Public pages use a local preference until authentication.
- Image inputs share upload, download, select-existing and clear behavior.
- Sounds remain separate assets because volume, looping and duration are
  sound-specific.
- Optional sound can be muted and adjusted by each learner.
- Equipped tools may temporarily override the configured cursor.
- Public pages expose the deployment source link required by the project
  licensing direction.

Default media may use a permissive public-domain dedication such as CC0 while
the application code remains AGPL.
