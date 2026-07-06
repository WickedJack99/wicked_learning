# Local Setup

This guide describes a normal local development setup for Learning Worlds.

## Requirements

- PHP 8.3 or newer
- Composer
- Node.js and npm
- A Laravel-supported database

The project has been developed with PostgreSQL. The default `.env.example` still uses Laravel's SQLite defaults, so adjust `.env` before running migrations if you want PostgreSQL.

## Install dependencies

```bash
composer install
npm install
```

Create the application environment file and key:

```bash
cp .env.example .env
php artisan key:generate
```

On Windows PowerShell, use this instead of `cp`:

```powershell
Copy-Item .env.example .env
php artisan key:generate
```

## Configure the database

Update `.env` for your database. For PostgreSQL, the important values are usually:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=learning
DB_USERNAME=postgres
DB_PASSWORD=your-password
```

Then run migrations and seed demo data:

```bash
php artisan migrate --seed
```

The development seeder creates:

- admin email: `test@example.com`
- admin password: `password`
- demo world: `Signal Garden`

## Start development servers

The project includes a Composer script that starts Laravel, the queue listener and Vite together:

```bash
composer run dev
```

You can also run the processes separately:

```bash
php artisan serve
php artisan queue:listen
npm run dev
```

## Useful checks

Run these before publishing changes:

```bash
vendor/bin/pint --parallel --test
php artisan test
npm run lint:check
npm run format:check
npm run types:check
npm run build
```

There is also a combined Composer check:

```bash
composer run ci:check
```

## Common development notes

- Run `php artisan migrate --seed` after pulling schema or demo-content changes.
- The demo data is intentionally small and should remain easy to reset.
- Uploaded or generated visual assets currently live below `public/images`.
- Public pages and auth-page presentation can be edited by admins inside settings.
