# Feature Overview

Learning Worlds is a generic prototype for explorable learning without points, streaks or leaderboards. The current app is small, but it already has the main shape of a platform that can be adapted to any learning domain through configurable maps, activities, visuals, media and public content.

## Learner experience

### Welcome and public pages

Visitors can view the welcome screen, About, Imprint and Data Protection pages before logging in. The public appearance can use light or dark mode, and admins can edit public text and presentation assets.

The public footer also exposes a source-code page. The default source points to the origin repository, and deployments can add their own source links so network users can find the corresponding source for the running version.

### World map

Learners enter a draggable hex map. Each visible node can be focused to open a side panel with its description, route choices and actions.

Current map behavior includes:

- dark and light map styling
- configurable map description panel
- custom cursor assets
- draggable map surface
- node focus through URL query parameters
- locked or empty nodes
- node labels that can be hidden per node
- full-tile node images for dark and light mode
- completed-node dimming instead of badge-like check marks on the tile image
- hidden nodes that can be revealed by using a configured tool on the map
- locked nodes that can be unlocked through configured completion rules, tool use or both

### Search

The map search is server-side, so it can find visible nodes on other maps. Search results are shown as map and node matches and can navigate the learner to the selected node.

### Bookmarks

Learners can bookmark nodes. Bookmarked nodes appear on a personal bookmark map arranged in a spiral layout. Selecting a bookmark opens the same style of node panel with orientation text and a button to go to the original node.

### Activities and routes

A node can have multiple start routes. The learner chooses a route from the node panel and then plays activities on a separate page, keeping the world map lighter.

Route playback stores backend progress per learner and route run. This lets the application resume the current activity or dialogue position after refresh, while still allowing a learner to intentionally start the route from the beginning. Resetting a route from the node panel starts a fresh run and can allow grant activities to be earned again according to their rules.

Supported prototype activity ideas include:

- nested NPC dialogue graphs
- question and answer dialogue nodes with private correctness tracking
- reflection-style content
- placeholder activities
- portal activities
- tool-grant activities
- item-grant activities
- obstacle activities
- item-obstacle activities
- markdown page activities

### Portals

Portal activities can move the learner to another node or map. Portal activities support Entry and Exit modes, configurable portal visuals, mirrored foreground/background assets, optional click-to-enter behavior and linked portal edges in the admin world graph.

Entry portals own the destination link. Exit portals are receiving activities and can choose whether their arrival scene is displayed or skipped.

### Tools

Learners can acquire tools through activities. A floating side action bar opens the current tool selection, and an equipped tool follows the cursor until it is used or cancelled.

Tools can be used:

- inside obstacle activities
- on the world map to reveal configured hidden nodes
- on locked map nodes when unlock rules allow a configured tool interaction

The prototype treats tools as capabilities, not rewards. They should open possibilities in the environment rather than become status markers.

## Auth and user settings

Users can register only with a valid registration token. Authenticated users can manage their profile, password, passkeys and appearance preference.

Theme preference is stored for authenticated users. Public, unauthenticated appearance can be handled separately so the welcome and auth pages still feel coherent before login.

## Admin features

Admins can access extra settings panels.

### User management

Admins can:

- list registered users
- inspect registration-token metadata
- create one-use registration tokens
- choose token roles and expiration date
- assign multiple roles to users
- create and edit configurable roles
- grant roles permission levels per administrative resource
- disable login
- ban users until a date
- delete users

Permission levels currently use:

- `No`: no access to the resource
- `RO`: read-only
- `RU`: read and update
- `RUD`: read, update and delete

### Presentation editing

Admins can edit public-facing content and visuals:

- About page
- Imprint page
- Data Protection page
- welcome-page sections
- login and registration backgrounds
- upload and download presentation files
- default cursor, pointer and drag cursor images

### Reusable media

Admins can manage reusable media separately from world objects:

- uploaded images and animations can be selected again in image fields
- image inputs support upload, download, selecting an existing asset and clearing a field without deleting the asset
- reusable sounds can be named, categorized with an icon, previewed and configured with volume, looping and optional playback duration
- a layered sound player can play multiple sounds at once, so later activities can combine ambience with interaction sounds

The media library is an abstraction layer. Tools, nodes, presentation pages and activities should reference reusable assets instead of forcing admins to upload duplicate files. This helps each deployment build a coherent domain-specific visual and audio language without coupling those assets to one fixed subject.

### Tools, items and currencies

The tools/items/currencies area is reserved for reusable world objects. Tools and consumable items are implemented; currencies remain reserved for later.

Tool editing currently supports:

- unique name and slug
- dark and light tool images
- dark and light animation images or GIFs
- separate display widths for the resting image and animation
- animation duration
- a preview area where the admin can see cursor and click animation behavior

Item editing currently supports:

- unique name and slug
- description
- dark and light item images
- reuse through grant-item and item-obstacle activities

### World editing

Admins edit worlds from settings, not from the learner map. This keeps admin controls away from the normal learning experience.

The current world editor includes:

- graph view of maps
- portal edges between maps
- creation of new maps without requiring a portal first
- separate map configuration page for map details, map visuals, access and deletion
- full-screen map editing page
- draggable hex editing surface
- node creation and editing overlays
- empty-space nodes
- hidden empty-space nodes
- node image upload and download
- selecting existing reusable images
- dark and light node images and colors
- square node artwork convention: generated source tile images should be square, borderless scene artwork; the runtime hex component is responsible for clipping them to the map tile shape
- tile label visibility controls
- node-image visibility controls
- node lock state and editable hover text
- unlock conditions with completion rules, OR/AND grouping and optional tool unlock behavior
- completed-node dimming levels per light and dark mode
- node swapping and insertion helpers
- map-level access roles, including public map access for later unauthenticated exploration modes
- map deletion with cleanup for related nodes, links, progress references and stale unlock rules

Map visuals are moving away from small accordion dialogs toward larger configuration pages. The current configuration page separates map details, visuals, access and deletion. Visual editing can switch between dark and light configuration values without changing the admin page appearance itself, and preview panels show how each configured control will look.

### Activity graph editing

Admins can open a node's activities and configure an activity graph.

The current activity editor includes:

- Start and End graph nodes
- multiple routes from the Start node
- Entry and Exit connectors
- activity creation and deletion
- transition wiring between activities
- delete confirmation overlays
- route-card image configuration
- route button and border color configuration
- portal activity settings in accordion sections
- NPC dialogue graph editing
- obstacle activity configuration with allowed tool selection
- tool-grant activity configuration
- item-grant activity configuration with server-side probability rolls
- item-obstacle activity configuration with item slots, sounds and optional retry lockouts
- markdown page-graph editing with page colors, images and video embeds
- route progress persistence with current activity and completion timestamps

Obstacle activities can persist per learner. Admins can choose whether a solved obstacle reappears on replay or stays cleared for the learner. If it stays cleared, a separate revisit state can show its own background, cleared obstacle image and text bubble.

Item-grant activities roll on the server and write to learner inventory through backend services so the frontend cannot repeatedly trigger a lucky grant by replaying only the browser action.

Item-grant playback displays the granted items directly, grows the item display only as needed up to three columns, and then lets the learner continue.

Markdown activities use their own page graph. Each page can carry Markdown content, media embeds and theme-specific page colors while still fitting into the same parent activity-route graph.

### AI support

Admins can configure AI provider credentials and reusable agent templates from settings. Provider credentials are intended to stay encrypted server-side, while templates define the behavior, task purpose, model preferences, budgets and guardrails for future AI-assisted jobs.

Agent templates support importing and exporting their instruction text as Markdown files. The repository also contains `agent-instruction-sets/` with starter instruction sets for SDT design support, learner reflection feedback, asset brief generation and competence-oriented question design. These files are meant to be improved through issues and pull requests without mixing private learner data or deployment-specific secrets into the public repo.

## Intentional non-goals

The prototype deliberately avoids:

- global point totals
- streak pressure
- leaderboards
- reward loops that make the reward more important than learning

The platform can still be playful and game-like. The difference is that interaction should support autonomy, curiosity and competence instead of replacing them.
