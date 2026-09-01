#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly WORKSPACE_ROOT=/workspace
readonly RUNS_ROOT="${WORKSPACE_ROOT}/runs"
readonly PROMPT_PATH=/opt/codex-worker/prompt.md
readonly ASKPASS_PATH=/opt/codex-worker/git-askpass.sh

: "${GITHUB_TOKEN:?Set a fine-grained GitHub token in Coolify}"

GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-WickedJack99/wicked_learning}"
GITHUB_DEFAULT_BRANCH="${GITHUB_DEFAULT_BRANCH:-main}"
GITHUB_USERNAME="${GITHUB_USERNAME:-WickedJack99}"
CODEX_TIMEOUT_SECONDS="${CODEX_TIMEOUT_SECONDS:-14400}"

if [[ ! "${GITHUB_REPOSITORY}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "GITHUB_REPOSITORY must use the owner/repository form." >&2
    exit 1
fi

if [[ ! "${GITHUB_DEFAULT_BRANCH}" =~ ^[A-Za-z0-9._/-]+$ ]]; then
    echo "GITHUB_DEFAULT_BRANCH contains unsupported characters." >&2
    exit 1
fi

install -d -m 0750 -o codex -g codex "${RUNS_ROOT}"

exec 9>"${WORKSPACE_ROOT}/codex-worker.lock"
if ! flock -n 9; then
    echo "Another scheduled Codex run is still active; skipping this occurrence."
    exit 0
fi

github_api() {
    curl \
        --fail-with-body \
        --silent \
        --show-error \
        --header "Accept: application/vnd.github+json" \
        --header "Authorization: Bearer ${GITHUB_TOKEN}" \
        --header "X-GitHub-Api-Version: 2022-11-28" \
        "$@"
}

echo "Checking the Codex login and pull-request review gate..."
gosu codex env \
    CODEX_HOME="${CODEX_HOME}" \
    HOME=/home/codex \
    codex login status >/dev/null

open_pulls="$(github_api "https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls?state=open&per_page=100")"
if jq --exit-status 'any(.[]; .head.ref | startswith("codex/"))' <<<"${open_pulls}" >/dev/null; then
    echo "An earlier codex/* pull request is still open; waiting for human review."
    exit 0
fi

run_id="$(date -u +'%Y%m%d-%H%M%S')"
branch_name="codex/scheduled-${run_id}"
run_dir="${RUNS_ROOT}/${run_id}"
repository_dir="${run_dir}/repository"
final_message="${run_dir}/codex-final.md"

install -d -m 0750 -o codex -g codex "${run_dir}"

echo "Cloning ${GITHUB_REPOSITORY} at ${GITHUB_DEFAULT_BRANCH}..."
gosu codex git clone \
    --branch "${GITHUB_DEFAULT_BRANCH}" \
    --single-branch \
    "https://github.com/${GITHUB_REPOSITORY}.git" \
    "${repository_dir}"

gosu codex git -C "${repository_dir}" checkout -b "${branch_name}"
gosu codex cp "${repository_dir}/.env.example" "${repository_dir}/.env"

echo "Installing the locked PHP and JavaScript dependencies..."
gosu codex env \
    COMPOSER_CACHE_DIR="${COMPOSER_CACHE_DIR}" \
    composer \
        --working-dir="${repository_dir}" \
        install \
        --no-interaction \
        --prefer-dist \
        --no-progress

gosu codex env \
    npm_config_cache="${npm_config_cache}" \
    npm --prefix "${repository_dir}" ci \
        --no-audit \
        --no-fund

gosu codex php "${repository_dir}/artisan" key:generate --force --no-interaction

codex_command=(
    codex exec
    --dangerously-bypass-approvals-and-sandbox
)

if [[ -n "${CODEX_MODEL:-}" ]]; then
    codex_command+=(--model "${CODEX_MODEL}")
fi

if [[ -n "${CODEX_REASONING_EFFORT:-}" ]]; then
    codex_command+=(-c "model_reasoning_effort=${CODEX_REASONING_EFFORT}")
fi

codex_command+=("$(<"${PROMPT_PATH}")")

echo "Starting Codex on ${branch_name}..."
set +e
(
    cd "${repository_dir}"
    timeout \
        --signal=TERM \
        --kill-after=30s \
        "${CODEX_TIMEOUT_SECONDS}" \
        env \
            -u GITHUB_TOKEN \
            -u GITHUB_USERNAME \
            CODEX_HOME="${CODEX_HOME}" \
            HOME=/home/codex \
            COMPOSER_CACHE_DIR="${COMPOSER_CACHE_DIR}" \
            npm_config_cache="${npm_config_cache}" \
            gosu codex \
            "${codex_command[@]}" \
        | tee "${final_message}"
)
codex_status="${PIPESTATUS[0]}"
set -e

if [[ "${codex_status}" -ne 0 ]]; then
    echo "Codex exited with status ${codex_status}; preserving ${run_dir} for inspection." >&2
    exit "${codex_status}"
fi

mapfile -t changed_paths < <(
    {
        gosu codex git -C "${repository_dir}" diff --name-only "origin/${GITHUB_DEFAULT_BRANCH}"
        gosu codex git -C "${repository_dir}" ls-files --others --exclude-standard
    } | sort -u
)

if [[ "${#changed_paths[@]}" -eq 0 ]]; then
    echo "Codex completed without repository changes; no branch will be pushed."
    exit 0
fi

for changed_path in "${changed_paths[@]}"; do
    case "${changed_path}" in
        AGENTS.md|.codex/*|.github/workflows/*|docker/codex-worker/*|composer.json|composer.lock|package.json|package-lock.json)
            echo "The run changed protected path ${changed_path}; preserving the run without pushing." >&2
            exit 1
            ;;
    esac
done

echo "Running the full repository verification gate..."
gosu codex env \
    COMPOSER_CACHE_DIR="${COMPOSER_CACHE_DIR}" \
    npm_config_cache="${npm_config_cache}" \
    composer --working-dir="${repository_dir}" run ci:check
gosu codex env \
    npm_config_cache="${npm_config_cache}" \
    npm --prefix "${repository_dir}" run build
gosu codex git -C "${repository_dir}" diff --check

gosu codex git -C "${repository_dir}" config user.name "Wicked Learning Codex"
gosu codex git -C "${repository_dir}" config user.email "codex-bot@users.noreply.github.com"
gosu codex git -C "${repository_dir}" add --all

if gosu codex git -C "${repository_dir}" diff --cached --quiet; then
    echo "Verification left no committable changes; no branch will be pushed."
    exit 0
fi

if gosu codex git -C "${repository_dir}" diff --cached | grep --fixed-strings --quiet "${GITHUB_TOKEN}"; then
    echo "The GitHub token appeared in the staged diff; refusing to commit or push." >&2
    exit 1
fi

gosu codex git -C "${repository_dir}" commit -m "chore: scheduled Codex maintenance slice"

echo "Pushing ${branch_name}..."
GIT_ASKPASS="${ASKPASS_PATH}" \
GIT_TERMINAL_PROMPT=0 \
GITHUB_TOKEN="${GITHUB_TOKEN}" \
GITHUB_USERNAME="${GITHUB_USERNAME}" \
git -c "safe.directory=${repository_dir}" \
    -C "${repository_dir}" \
    push --set-upstream origin "${branch_name}"

pull_body="$(
    jq --null-input \
        --arg title "Scheduled Codex maintenance slice" \
        --arg head "${branch_name}" \
        --arg base "${GITHUB_DEFAULT_BRANCH}" \
        --arg body "This pull request was created by the isolated scheduled Codex worker.\n\nVerification: \`composer run ci:check\` and \`npm run build\` passed.\n\nThe complete Codex final message is available in the corresponding Coolify scheduled-task output." \
        '{title: $title, head: $head, base: $base, body: $body, draft: true}'
)"

pull_response="$(
    github_api \
        --request POST \
        --data "${pull_body}" \
        "https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls"
)"

echo "Created draft pull request: $(jq --raw-output '.html_url' <<<"${pull_response}")"
