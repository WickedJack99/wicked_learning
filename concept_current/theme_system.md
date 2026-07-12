# Theme System

The platform should not hard-code one genre.

Current configurable visual fields include:

- Global platform theme tokens in `resources/js/theme/platform-theme.json`.
- Separate dark and light mode theme values where useful.
- World accent and surface colors.
- Map background image and overlay.
- Node tile color.
- Node tile opacity.
- Node foreground color.
- Node hover highlight color.
- Node tile image, with dark/light variants.
- Node image position, width and rotation inside the runtime hex mask.
- Node image visibility.
- Node lock, completed and hidden/revealed visual states.
- Dialogue portrait image per stage.
- Dialogue text and speaker metadata.
- Cursor assets for the themed map/settings experience.
- Separate cursor assets for default cursor, pointer cursor and drag/grab cursor states.
- Authentication and welcome-page color treatment.
- Admin-editable login, registration and welcome background image paths.
- Admin-uploaded background images stored through Laravel's public storage disk.
- Admin-editable welcome page text blocks.
- Route preview images and overlay button/frame colors per dark/light mode.
- Tool images and tool animation images, with dark/light variants and configurable display widths.
- Item images, with dark/light variants.
- Obstacle activity backgrounds, obstacle images and cleared-state images, with dark/light variants.
- Markdown page colors and embedded media.
- Reusable visual assets that can be selected by multiple forms instead of uploaded repeatedly.
- Reusable sound assets with icon, volume, loop and optional playback-duration metadata.

Appearance behavior:

- Authenticated users store their resolved appearance preference in the backend user preference table.
- The earlier `system` option was removed from authenticated settings to avoid ambiguous backend state.
- Public pages use a local unauthenticated preference before login.
- When a user registers or logs in, authenticated state should become the source of truth.
- Public presentation settings are stored in the backend and shared through Inertia so welcome/auth pages can render configured content without code changes.
- Uploaded public presentation images are stored below `/storage/presentation/backgrounds/...` and can be downloaded again from the admin panel.
- Node tile images are now the primary visual source for map tiles and render as full hex artwork.
- Admin editing exposes dark/light node image fields directly and no longer exposes the older fallback node image field.
- Image fields should support upload, download, selecting an existing asset and clearing the current reference.
- Sounds are modeled separately from images because playback requires volume, loop and duration behavior.
- Cursor settings are global presentation settings. Equipped tools are a special override and may temporarily replace the cursor with a tool image or animation.

Future deployments should be able to replace these with any domain-specific visual language without changing the learning logic.
