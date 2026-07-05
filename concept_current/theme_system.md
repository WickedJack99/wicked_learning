# Theme System

The platform should not hard-code one genre.

Current configurable visual fields include:

- Global platform theme tokens in `resources/js/theme/platform-theme.json`.
- Separate dark and light mode theme values where useful.
- World accent and surface colors.
- Map background image and overlay.
- Node tile color.
- Node foreground color.
- Node hover highlight color.
- Node icon key.
- Dialogue portrait image per stage.
- Dialogue text and speaker metadata.
- Cursor assets for the themed map/settings experience.
- Authentication and welcome-page color treatment.

Appearance behavior:

- Authenticated users store their resolved appearance preference in the backend user preference table.
- The earlier `system` option was removed from authenticated settings to avoid ambiguous backend state.
- Public pages use a local unauthenticated preference before login.
- When a user registers or logs in, authenticated state should become the source of truth.

Future themes should be able to replace these with medieval, astronomy, biology, abstract or other visuals without changing the learning logic.
