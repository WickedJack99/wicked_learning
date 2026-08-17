# Wicked Learning

An open-source experiment in building an explorable learning environment around intrinsic motivation instead of points, streaks, badges or leaderboards.

Wicked Learning is currently a Laravel, Inertia and React prototype. The long-term idea is a domain-agnostic platform that can be adapted to any learning domain. Admins shape the story, visual theme, maps, MapAssets, activities, media and public text while the core learning model stays reusable.

The concept direction comes from the project creator. The implementation is evolving through hands-on prototyping, concept notes and frequent iteration.

## Why this exists

Many digital learning platforms try to keep people active through external rewards. This project explores another question:

> What if people wanted to learn even without external rewards?

The design is inspired by Self-Determination Theory, Cognitive Load Theory, Multimedia Learning, self-regulated learning and game design. The goal is to support curiosity, autonomy, competence, orientation and meaningful progress without making the learner chase a score.

## Current prototype

This repository is no longer only a concept archive. It contains a working vertical slice with:

- public welcome, about, imprint and data protection pages
- configurable light and dark appearance
- Laravel authentication with registration tokens
- configurable access roles seeded with `admin` and `user`
- admin user management with role assignment, bans, disabled login and deletion
- freeform world maps composed from transparent MapAsset images
- focus panels for interactive MapAssets
- bookmarks and a personal bookmark map
- server-side map and MapAsset search
- editable worlds, maps and freely positioned MapAssets
- focusable, decorative, hide-on-hover and two-state MapAsset interactions
- image-alpha-aware hit areas for irregular transparent artwork
- configurable MapAsset labels, borders, highlights and alternate highlight images
- discoverable hidden MapAssets that can be revealed with tools
- locked MapAssets with configurable unlock conditions and optional tool unlocks
- editable public presentation content and auth page backgrounds
- reusable visual and sound libraries for uploaded assets
- configurable cursor images for normal, action, grab, text and denied states
- public source-code links for AGPL network deployments
- graph-based activity editing with multiple route starts per MapAsset
- route cards with optional light and dark images
- activity playback on a separate page with backend route progress
- portal activities that can move learners between MapAssets and maps
- NPC dialogue, markdown, tool-grant, item-grant, obstacle and item-obstacle activity prototypes
- learner tool and item side controls for selecting acquired tools and viewing consumable inventory
- learner journal pages with Markdown editing, search, autosaved drafts and export
- optional learner requests for journal feedback from permitted review domains
- learner-message prompt and message-wall activities with moderation tools
- learner-facing competence history and non-competitive support signals for authorised staff
- organizations, learning groups and shared-task activity prototypes
- configurable AI providers and reusable agent templates with structured provider errors
- reviewable AI content drafts that create a MapAsset and short activity route only after admin approval
- a permission-controlled Content API console and machine-readable authoring contract

The prototype intentionally avoids point totals, streak pressure and ranking loops. The interaction goal is exploration first, reward-chasing last.

## Main ideas

### Learning as exploration

Learners explore maps made from freely positioned MapAssets. A MapAsset can represent a topic, scenario, conversation, portal, exercise, reflection or a purely visual layer. Transparent PNG or WebP artwork can overlap to form a domain-specific surface instead of being forced into a fixed tile grid.

### Generic worlds

The same structure is intended to work for any subject area. A deployment can configure its own visual language, story framing, map access, MapAsset artwork, activities, cursors, sounds and public text without changing the platform's learning logic.

### Activity routes

Focusable MapAssets can contain multiple activity routes. A route starts from the MapAsset panel and then plays activities in the configured order. Activities are modeled as graph nodes, so future activity types can be added without forcing every MapAsset into one fixed sequence.

### Admins are also learners

World editing lives in settings instead of on the learner map. Admins can use the platform normally, then switch into editing when they want to prepare maps, MapAssets, activities or public pages.

## Tech stack

- Laravel 13
- Inertia.js
- React 19
- TypeScript
- Tailwind CSS
- PostgreSQL or another Laravel-supported database
- React Flow for graph editing
- Pest/PHPUnit, Pint, PHPStan, ESLint, Prettier and TypeScript checks

## Local development

Install PHP, Composer, Node.js and a database supported by Laravel. The project was developed with PostgreSQL, but the default Laravel `.env.example` still starts from SQLite.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Configure `.env` for your local database, then run:

```bash
php artisan migrate --seed
composer run dev
```

The bootstrap seeder creates:

- an admin user: `test@example.com`
- password: `password`
- an empty world shell called `Learning World`

It deliberately creates no maps, MapAssets or activities. Change the seeded
password before exposing any instance outside a disposable local environment.

The Composer `dev` script starts the Laravel server, queue listener and Vite together. You can also run the pieces separately with `php artisan serve`, `php artisan queue:listen` and `npm run dev`.

## Docker and deployment

The repository includes a production Dockerfile for Coolify and a local Docker Compose smoke test with PostgreSQL. See [documentation/deployment.md](documentation/deployment.md) for the exact commands, Coolify settings and the safe first-deploy steps for a temporary public test instance.

## Quality checks

Useful checks before committing:

```bash
vendor/bin/pint --parallel --test
php artisan test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

The repository also contains a Composer shortcut:

```bash
composer run ci:check
```

## License

This project is licensed under the GNU Affero General Public License v3.0 only.
See [LICENSE](LICENSE) for the full license text and [NOTICE](NOTICE) for the
generic project notice.

Bundled default media assets under `public/images` and `public/sounds` are
dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), unless a file
states otherwise. See [ASSET_LICENSE.md](ASSET_LICENSE.md).

Public network deployments should provide a visible Source link or equivalent
route to the corresponding source code for the deployed version.

## Project structure

Important areas:

- `app/Models` - learning worlds, maps, MapAssets, internal content nodes, activities, users and preferences
- `app/Ai` - provider transport, agent templates and reviewable content authoring
- `app/ContentApi` - the versioned content-authoring contract and serializers
- `app/Access` - configurable role and permission-level support
- `app/Learning` - actions, queries, serializers, services and validation for learning features
- `app/Http/Controllers` - learner views, admin world editing, settings and public pages
- `database/migrations` - schema changes for the evolving prototype
- `database/seeders` - bootstrap admin, empty world shell and optional legacy demo seeder
- `resources/js/pages` - Inertia pages
- `resources/js/features` - larger React feature areas
- `resources/js/theme` - appearance and presentation configuration helpers
- `public/images` - CC0 cursors, route images, MapAsset images and theme assets
- `public/sounds` - CC0 demo sound effects and background loops
- `concept*` - concept notes and evolving project ideas
- `conversations` - archived development conversations

## Documentation and concept notes

The `documentation` folder contains slower-moving project documentation:

- [Documentation index](documentation/README.md)
- [Local setup](documentation/setup.md)
- [Feature overview](documentation/features.md)
- [Architecture notes](documentation/architecture.md)
- [AI-assisted authoring](documentation/ai-authoring.md)
- [Content API](documentation/content-api.md)

This repository also documents both implementation and thinking. Older concept files may contain ideas that changed or were discarded. The most useful concept documents should be treated as living notes rather than a fixed specification.

The direction at the moment is practical prototyping: build a usable slice, test how it feels, then update the concept when the implementation teaches us something.

## Status

Early development.

Expect database structures, UI flows, activity types and admin tooling to change. The project is meant to be public and inspectable, but it is not production-ready yet.

## Contributions

Ideas, criticism, research references, accessibility feedback and design critique are welcome. The project is especially interested in approaches that make learning feel more autonomous, clear, playful and humane without falling back to extrinsic reward loops.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening larger changes.
Community expectations are described in
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Motivation

[Motivation Playlist](https://youtube.com/playlist?list=PL6aYkE4NLbmp06bQhMWiT147qcEPf4g5p&si=T9TxsLuS7m3VhWz-)

## Sources

### Self-Determination Theory

- Intrinsic Motivation and Self-Determination in Human Behavior - [Edward L. Deci](https://en.wikipedia.org/wiki/Edward_L._Deci) and [Richard M. Ryan](https://en.wikipedia.org/wiki/Richard_M._Ryan)
- [Center for Self-Determination Theory](https://selfdeterminationtheory.org/)
- [motivation-science-learning](https://github.com/mattx2/motivation-science-learning/tree/main) - [Matt Kiba](https://github.com/mattx2)

### Gamification

- [The Hidden Cost of Gamification](https://youtu.be/Y5-q-HZ6VO4?si=FucLUTulbfqXYPnf) - [struthless](https://www.youtube.com/@struthless)
