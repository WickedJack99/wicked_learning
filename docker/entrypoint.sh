#!/bin/sh

set -eu

mkdir -p \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chmod -R ug+rwX storage bootstrap/cache

if [ ! -L public/storage ]; then
    echo "Creating Laravel public storage link..."
    rm -rf public/storage
    php artisan storage:link --force
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running database migrations..."

    attempt=1

    until php artisan migrate --force; do
        if [ "$attempt" -ge 15 ]; then
            echo "Database migration failed after ${attempt} attempts." >&2
            exit 1
        fi

        echo "Database is not ready yet. Retrying..."
        attempt=$((attempt + 1))
        sleep 2
    done
fi

echo "Caching Laravel configuration, events, routes and views..."
php artisan optimize

exec "$@"
