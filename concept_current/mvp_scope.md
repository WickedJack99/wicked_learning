# MVP Scope

The first practical slice should make the core idea tangible.

Implemented now:

- Authenticated world route renders a seeded learning world.
- A map contains configurable hex tiles.
- Hex tile hover highlights are configurable per node.
- Tile rendering separates base, content and hover overlay layers.
- The world map is usable on desktop and mobile.
- The world map keeps map description, node details and active activity state separate.
- A node can contain multiple activities.
- Activities can transition to other activities.
- Dialogue activities support multiple stages with configurable portrait images.
- Question activities support configurable answer options and informational feedback.
- Minimal activity and question progress is stored.
- A bottom navigation bar replaces the default Laravel sidebar for the main learner flow.
- Authenticated users can switch between light and dark mode in settings.
- Unauthenticated pages can use a local light/dark preference before login.
- Admins can manage users, registration tokens, roles and access restrictions.
- Registration can require a one-use registration token.
- Platform About, Imprint and Data Protection pages exist for public and authenticated use.
- Admins can edit platform information pages with Markdown.

Not in the first slice:

- AI generation.
- Multi-map portals.
- Multiplayer or group activities.
- Browser extension.
- Full analytics dashboards.
- Full content authoring UI for worlds, maps, nodes and activities.
- Visual activity graph editor.
- Fine-grained role and permission editor beyond `admin` and `user`.
