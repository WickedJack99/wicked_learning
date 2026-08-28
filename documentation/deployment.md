# Deployment

The repository contains a production Docker image. It builds the Laravel application and its Vite assets, runs migrations when the container starts, creates the public storage link and caches Laravel's production configuration.

The application container deliberately does not include PostgreSQL. Keep the database as its own managed Coolify resource so backups, credentials and its persistent data stay independent of application deployments.

## Quick local production check

Docker Desktop is enough; PHP, Composer and Node.js do not need to be installed on the host for this check.

1. Create the normal local `.env` file and application key if it does not exist yet:

    ```powershell
    Copy-Item .env.example .env
    php artisan key:generate
    ```

2. Start the production-like application and PostgreSQL:

    ```powershell
    docker compose up --build
    ```

3. Open [http://localhost:8080](http://localhost:8080). On first use, create the bootstrap account and empty world shell once:

    ```powershell
    docker compose exec app php artisan db:seed --force
    ```

    The bootstrap administrator is `test@example.com` with password `password`.
    The seeder creates no maps, MapAssets or Activities. Do not expose that
    account on a public instance; change or remove it immediately.

The Compose volumes retain database data and uploads. Reset only this disposable local test instance with:

```powershell
docker compose down -v
```

The image configures PHP for the application's upload contract: individual
uploads may be up to 64 MB at the PHP boundary, while Laravel validates them
at 50 MB. The slightly higher `post_max_size` also covers multipart form
fields. Rebuild the container after changing these limits.

## Coolify application

Create a **Dockerfile** application from this repository. Set the Dockerfile location to `/Dockerfile`, the application port to `80`, and the health-check path to `/up`.

Create PostgreSQL as a separate Coolify database resource and use its internal hostname and generated credentials in the application environment. Do not expose PostgreSQL publicly.

Add persistent storage for user uploads:

```text
/app/storage/app/public
```

The remainder of `storage` contains logs and temporary framework files and should not be persisted.

Use environment variables similar to these, replacing every placeholder with the value generated for that particular deployment:

```dotenv
APP_NAME="Wicked Learning"
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:generated-per-deployment-key
APP_URL=https://learning.example.example

LOG_CHANNEL=stderr
LOG_LEVEL=info

DB_CONNECTION=pgsql
DB_HOST=the-internal-coolify-postgres-host
DB_PORT=5432
DB_DATABASE=learning
DB_USERNAME=learning
DB_PASSWORD=generated-database-password

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=public

PASSKEYS_ALLOWED_ORIGINS=https://learning.example.example
RUN_MIGRATIONS=true
```

`APP_KEY`, database credentials and other secrets belong in Coolify, never in Git. Generate a separate `APP_KEY` for every independently deployed instance. `trustProxies(at: '*')` is already configured in `bootstrap/app.php`, so HTTPS URLs and secure cookies work behind Coolify's reverse proxy.

## First public test instance

For a short-lived public test, create a separate Coolify application and a separate PostgreSQL database from the same repository. Give it its own subdomain, `APP_KEY`, database credentials and upload volume. Deploy it, then bootstrap it **once** through Coolify's application terminal:

```sh
php artisan db:seed --force
```

The included seeder creates the bootstrap administrator and an empty world shell
and is intentionally not run automatically. Rerunning it resets fields on the
well-known bootstrap account, including its password, so it is not a safe normal
deployment action. Before sharing the test URL, change or delete that account and
author the desired maps through World Builder.

For the current single-container setup, `RUN_MIGRATIONS=true` is convenient. If the application is later scaled to multiple containers, set it to `false` and run migrations once as a dedicated deployment job instead.
