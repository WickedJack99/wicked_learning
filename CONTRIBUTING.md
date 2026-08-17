# Contributing

Thank you for taking an interest in this project. It explores learning
environments built around curiosity, autonomy, competence and meaningful
progress instead of points, streak pressure or ranking loops.

## Project Direction

Contributions should support the platform as a domain-agnostic learning
environment. New features should be configurable enough to fit different
stories, visual styles and learning domains without hardcoding one subject area.

Please avoid features that push learners toward external reward chasing, such as
global leaderboards, streak pressure, public ranking or point farming.

## Development Setup

Install PHP, Composer, Node.js and a Laravel-supported database. Then run:

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
```

Start the local development stack with:

```bash
composer run dev
```

You can also start the pieces separately with `php artisan serve`,
`php artisan queue:listen` and `npm run dev`.

## Architecture Expectations

- Keep Laravel controllers thin.
- Put write behavior into Actions or Services.
- Put read-heavy loading into Query classes.
- Put large frontend payload shaping into Serializer classes.
- Keep React pages thin and compose smaller components and hooks.
- Do not add more logic to already oversized controllers, pages or components.
- Preserve existing clean-code direction when touching older prototype code.

For larger changes, identify where the logic belongs before implementing it:

- which controller receives the request
- which Action, Service or Query handles the behavior
- which Serializer shapes the frontend data
- which React component or hook owns the UI behavior

## Quality Checks

Before opening a pull request, run the checks that fit the changed area:

```bash
vendor/bin/pint --parallel --test
php artisan test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

For broader changes, prefer:

```bash
composer run ci:check
```

## Commit Conventions

Use English Conventional Commit subjects for all new commits:

```text
<type>(<scope>): <imperative summary>
```

Examples:

```text
feat(map-assets): add state-switching interactions
fix(map-assets): align hit areas with visible image pixels
refactor(ai): centralize provider request handling
docs(concepts): describe the MapAsset content model
chore(deps): update frontend dependencies
```

Use these types consistently:

- `feat`: add or extend a user-visible capability
- `fix`: correct unintended behavior
- `refactor`: restructure code without changing intended behavior
- `perf`: improve performance without changing intended behavior
- `docs`: change documentation only
- `test`: add or correct tests only
- `style`: apply formatting-only changes
- `build`: change dependencies or the build system
- `ci`: change automated checks or delivery workflows
- `chore`: perform repository maintenance not covered above
- `revert`: revert an earlier commit

Choose a domain scope rather than an implementation layer. Prefer established
scopes such as `ai`, `content-api`, `map-assets`, `world-builder`,
`learner-map`, `activities`, `settings`, `learning-support`, `journal`,
`assets`, `media`, `auth`, `access`, `translations`, `deployment`, `database`
and `deps`. Avoid vague scopes such as `frontend`, `backend`, `ui` or `misc`
when a domain scope describes the change. A scope is expected for code changes
and may be omitted for truly repository-wide documentation, CI or maintenance.

Keep the subject lowercase after the colon, use an imperative verb, omit the
trailing period and keep the complete subject line at 72 characters or fewer.
Use `!` and a `BREAKING CHANGE:` footer when a commit intentionally breaks a
public contract.

Group commits by functional outcome:

- Keep the backend, frontend, migration, translations and tests for one
  capability together when they form one coherent change.
- Separate unrelated features, fixes and maintenance even if they were developed
  at the same time.
- Do not create a separate commit for every file or combine several independent
  outcomes into a catch-all commit.
- Stage only the files that belong to the stated outcome and preserve unrelated
  worktree changes.
- Reword or rewrite existing history only when it is explicitly requested.

## Pull Requests

Please keep pull requests focused on one responsibility. A good pull request
should explain:

- what changed
- why it changed
- how it was verified
- any migration or setup steps
- any remaining limitations or follow-up ideas

## License

By contributing, you agree that your contribution is provided under this
project's AGPLv3 license. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Bundled default media assets in `public/images` and `public/sounds` are handled
separately under CC0 1.0. If you contribute media intended to ship as a default
asset, make sure it can be dedicated under the terms described in
[ASSET_LICENSE.md](ASSET_LICENSE.md), or clearly document the different license
before it is added.
