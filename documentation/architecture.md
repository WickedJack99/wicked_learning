# Architecture Notes

Learning Worlds is a Laravel application with an Inertia/React frontend. The architecture is still evolving, but the current shape is stable enough to document.

## Request flow

Laravel routes return Inertia pages. React receives page props and renders the current learner, settings or admin editing view.

Important route areas:

- `routes/web.php` - public pages, learner world, bookmarks, search and activity playback
- `routes/settings.php` - profile/security/appearance settings and admin tools

## Backend model areas

Important models live in `app/Models`.

Learner and account models:

- `User`
- `UserPreference`
- `RegistrationToken`

Public presentation models:

- `PlatformInfoPage`
- `PlatformPresentationSetting`

World models:

- `LearningWorld`
- `LearningMap`
- `LearningNode`
- `LearningNodeBookmark`

Activity models:

- `LearningActivity`
- `LearningActivityStart`
- `ActivityTransition`
- `LearningPortalLink`
- `DialogueStage`
- `LearningQuestion`
- `LearningQuestionOption`
- `LearnerActivityProgress`
- `LearnerQuestionAnswer`

## Frontend areas

Important React areas:

- `resources/js/pages/welcome.tsx` - public landing experience
- `resources/js/pages/world.tsx` - learner world map
- `resources/js/pages/bookmarks.tsx` - bookmark map
- `resources/js/pages/learning/node-play.tsx` - activity playback
- `resources/js/pages/settings/index.tsx` - settings overview and admin panels
- `resources/js/pages/settings/worlds/index.tsx` - admin world graph
- `resources/js/pages/settings/worlds/edit-map.tsx` - admin map editor
- `resources/js/pages/settings/worlds/edit-node-activities.tsx` - admin activity graph editor
- `resources/js/features/world` - shared world and activity-panel pieces
- `resources/js/theme` - appearance and presentation helpers

## Theme and visuals

Theme data is split between:

- backend user preferences for authenticated appearance
- frontend helpers for resolving light or dark mode consistently
- database-backed presentation settings for public/auth page visuals
- map and node configuration for world-specific visuals

World visuals are intended to be configurable per deployment. Current node visuals support dark and light full-tile images, colors, label visibility and image visibility.

## Activity graph model

Activities are connected through transitions. A node can have multiple route starts, represented by `LearningActivityStart` records. Each start points to the first activity in a route and can store route-card presentation data.

This lets one map node offer several learning paths, such as:

- an easy route
- a deeper route
- a portal route
- a reflection route

Portal activities are special because they can connect activity playback to another node or map through `LearningPortalLink`.

## Admin boundaries

Admin editing is intentionally placed in settings and separate edit pages. The learner map should stay focused on learning and exploration, even for admins.

The rule of thumb:

- learner-facing map: explore, focus, bookmark, search and start routes
- admin settings: create users, configure presentation, edit worlds and wire activities

## Implementation boundaries

Controllers and React pages should stay thin. Larger behavior belongs in classes or components named after what they do.

Laravel controllers may authorize, validate or delegate validation, call an Action, Service, Query or Serializer, and return an Inertia response, redirect or JSON response. They should not contain graph traversal, progress rules, portal-link rules, slug generation, long serialization blocks, hex-grid positioning, file-upload rules or multi-step editing workflows.

Preferred backend homes:

- Actions for write operations such as `CreateLearningMap`, `UpdateLearningNode`, `InsertLearningNodeIntoHexGrid` or `AnswerLearningQuestion`.
- Services for reusable behavior such as `LearnerProgressService`, `PortalLinkService`, `NodePositionService` or `UniqueSlugGenerator`.
- Query classes for read-heavy loading such as `LoadPlayableNode`, `SearchLearningWorld` or `LoadEditableWorldGraph`.
- Serializers for Inertia and JSON payload shaping such as `LearningWorldSerializer`, `LearningNodeSerializer` or `AdminWorldGraphSerializer`.
- Validation classes or Form Requests when validation starts making controllers noisy.

React pages should compose smaller feature components and hooks. Map math, graph editing rules, form transformations and API state should not accumulate directly in page components. Pure logic, such as hex-grid geometry, should live in feature modules that can be reused and tested independently.

As rough size guides:

- controllers should usually stay below 150 lines
- services should usually stay below 200 lines
- methods should usually stay below 40 lines
- classes should have one clear responsibility

When implementing a larger feature, briefly identify the controller, Action or Service, Serializer or Query, and React component or hook that should own the work before editing.

## Database evolution

The schema is changing quickly because the app is still a prototype. Changes should be made through migrations so a real application database can be upgraded later.

Demo data belongs in seeders and should stay resettable. Production-like content should not be hard-coded into React components when it can be configured through the database.
