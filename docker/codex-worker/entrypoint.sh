#!/usr/bin/env bash

set -Eeuo pipefail

install -d -m 0700 -o codex -g codex "${CODEX_HOME}"
install -d -m 0750 -o codex -g codex /workspace /workspace/cache
install -d -m 0750 -o codex -g codex "${COMPOSER_CACHE_DIR}" "${npm_config_cache}"

if [[ ! -f "${CODEX_HOME}/config.toml" ]]; then
    install -m 0600 -o codex -g codex /opt/codex-worker/config.toml "${CODEX_HOME}/config.toml"
fi

exec sleep infinity
