# syntax=docker/dockerfile:1

# Node is only needed to build the Vite assets. The application image itself
# stays PHP-only.
FROM node:22-bookworm-slim AS node

# Debian is the recommended FrankenPHP base and matches the Node build stage.
FROM dunglas/frankenphp:1-php8.3-bookworm AS base

RUN install-php-extensions \
    intl \
    mbstring \
    opcache \
    pcntl \
    pdo_pgsql \
    zip

COPY docker/php/uploads.ini /usr/local/etc/php/conf.d/uploads.ini
COPY docker/Caddyfile /etc/caddy/Caddyfile

WORKDIR /app

FROM base AS build

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

COPY . .

# The Wayfinder Vite plugin runs Artisan, so Composer must be installed before
# the frontend build.
RUN mkdir -p \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && composer install \
        --no-dev \
        --no-interaction \
        --prefer-dist \
        --no-progress \
        --classmap-authoritative \
    && npm ci \
    && npm run build \
    && rm -rf node_modules

FROM base AS runtime

ENV APP_ENV=production \
    APP_DEBUG=false \
    SERVER_NAME=:80

COPY --from=build /app /app

RUN sed -i 's/\r$//' /app/docker/entrypoint.sh \
    && chmod +x /app/docker/entrypoint.sh \
    && mkdir -p \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

EXPOSE 80

ENTRYPOINT ["/app/docker/entrypoint.sh"]

# The image's Caddyfile serves /app/public and enables PHP handling.
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
