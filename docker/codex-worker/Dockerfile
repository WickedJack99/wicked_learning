# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS node

FROM dunglas/frankenphp:1-php8.3-bookworm

ARG CODEX_VERSION=0.152.0

RUN install-php-extensions \
        bcmath \
        intl \
        mbstring \
        pcntl \
        pdo_pgsql \
        pdo_sqlite \
        zip \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        gosu \
        jq \
        openssh-client \
        ripgrep \
        sqlite3 \
        unzip \
        util-linux \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local /usr/local
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

RUN npm install --global "@openai/codex@${CODEX_VERSION}" \
    && npm cache clean --force \
    && useradd --create-home --uid 10001 --shell /bin/bash codex

COPY --chmod=0755 docker/codex-worker/entrypoint.sh /opt/codex-worker/entrypoint.sh
COPY --chmod=0755 docker/codex-worker/git-askpass.sh /opt/codex-worker/git-askpass.sh
COPY --chmod=0755 docker/codex-worker/run.sh /opt/codex-worker/run.sh
COPY --chmod=0644 docker/codex-worker/config.toml /opt/codex-worker/config.toml
COPY --chmod=0644 docker/codex-worker/prompt.md /opt/codex-worker/prompt.md

ENV CODEX_HOME=/var/lib/codex \
    COMPOSER_CACHE_DIR=/workspace/cache/composer \
    npm_config_cache=/workspace/cache/npm

VOLUME ["/var/lib/codex", "/workspace"]

ENTRYPOINT ["/opt/codex-worker/entrypoint.sh"]
