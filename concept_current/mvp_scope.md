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
- Admins can create configurable roles and set permission levels per admin resource.
- Registration can require a one-use registration token.
- Platform About, Imprint and Data Protection pages exist for public and authenticated use.
- Admins can edit platform information pages with Markdown.
- Admins can edit public presentation settings for welcome pages and authentication backgrounds.
- Admins can upload public presentation background images and download them again.
- Admins can manage reusable visual assets and choose existing images from upload fields.
- Admins can manage reusable sound assets with volume, loop and playback-duration settings.
- Admins can configure themed cursor images.
- Admins can open a separate world-editing workbench from Settings.
- Admins can see maps as graph nodes and portal links as graph edges.
- Admins can open a map editor and add or edit tiles through an overlay.
- Admins can configure dark/light node images, transparency, lock state, hover text, image visibility and label visibility.
- Admins can open an activity graph editor for a tile.
- Admins can create generic activity nodes, set the start activity, connect activity connectors and remove transitions.
- Admins can configure NPC dialogue, portal, tool-grant and obstacle activity prototypes.
- Learners can acquire tools and use them on obstacles or map-hidden nodes.
- Learner-specific obstacle and hidden-node progress is stored.

Not in the first slice:

- AI generation.
- Full portal-polish beyond the current linked portal activity prototype.
- Multiplayer or group activities.
- Browser extension.
- Full analytics dashboards.
- Full specialized content authoring UI for reflection storage and richer learning analytics.
- Complete item and currency systems.
- Full sound integration into every activity type.
- Rich media-library lifecycle controls beyond the current reusable picker and admin screens.
