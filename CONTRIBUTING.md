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
