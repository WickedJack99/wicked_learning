#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    printf 'Usage: %s BACKUP_DIRECTORY\n' "$0" >&2
    exit 64
fi

backup_directory=$1

for required_file in application.dump identity.dump manifest.txt SHA256SUMS; do
    if [[ ! -f "$backup_directory/$required_file" ]]; then
        printf 'Backup is missing %s: %s\n' "$required_file" "$backup_directory" >&2
        exit 66
    fi
done
if [[ ! -d "$backup_directory/media" ]]; then
    printf 'Backup is missing media directory: %s\n' "$backup_directory" >&2
    exit 66
fi

(
    cd "$backup_directory"
    sha256sum --check --status SHA256SUMS
)

manifest_value() {
    local key=$1
    sed -n "s/^${key}=//p" "$backup_directory/manifest.txt" | head -n 1
}

expected_application_principals=$(manifest_value application_principal_count)
expected_identity_subjects=$(manifest_value identity_subject_count)
expected_media_files=$(manifest_value media_file_count)
for expected_value in "$expected_application_principals" "$expected_identity_subjects" "$expected_media_files"; do
    if [[ ! "$expected_value" =~ ^[0-9]+$ ]]; then
        printf 'Backup manifest has an invalid verification count.\n' >&2
        exit 66
    fi
done

restore_project="wicked-learning-restore-$(date +%s)-$$"
# The restored backend needs Mailpit, but the development stack already owns
# its normal host port. Docker assigns an ephemeral port only inside this
# isolated project; the drill does not start the frontend or expose the API.
compose=(env RUST_MAILPIT_PORT=0 docker compose -p "$restore_project" -f compose.rust.yaml)
completed=false

cleanup() {
    local status=$?
    if [[ "$completed" == true ]]; then
        ${compose[@]} down --volumes --remove-orphans >/dev/null
        printf 'Removed isolated restore-drill project %s.\n' "$restore_project"
    else
        printf 'Restore drill did not complete. The isolated project %s was retained for inspection.\n' "$restore_project" >&2
    fi
    return "$status"
}
trap cleanup EXIT

${compose[@]} up --detach --wait application-db identity-db

application_database_container=$(${compose[@]} ps -q application-db)
identity_database_container=$(${compose[@]} ps -q identity-db)
docker cp "$backup_directory/application.dump" "$application_database_container:/tmp/application.dump"
docker cp "$backup_directory/identity.dump" "$identity_database_container:/tmp/identity.dump"

${compose[@]} exec -T application-db sh -ec '
    dropdb --username=wicked_application wicked_application
    createdb --username=wicked_application wicked_application
    pg_restore --username=wicked_application --dbname=wicked_application --no-owner --no-privileges /tmp/application.dump
'
${compose[@]} exec -T identity-db sh -ec '
    dropdb --username=wicked_identity wicked_identity
    createdb --username=wicked_identity wicked_identity
    pg_restore --username=wicked_identity --dbname=wicked_identity --no-owner --no-privileges /tmp/identity.dump
'

${compose[@]} run --rm --no-deps backend migrate
${compose[@]} up --detach --wait backend

backend_container=$(${compose[@]} ps -q backend)
docker cp "$backup_directory/media/." "$backend_container:/var/lib/wicked-learning/media/"
${compose[@]} restart backend
${compose[@]} exec -T backend wget --spider --quiet http://127.0.0.1:3000/api/v1/health/ready

restored_application_principals=$(
    ${compose[@]} exec -T application-db \
        psql --tuples-only --no-align --username=wicked_application \
        --dbname=wicked_application \
        --command='SELECT COUNT(*) FROM application_principals'
)
restored_identity_subjects=$(
    ${compose[@]} exec -T identity-db \
        psql --tuples-only --no-align --username=wicked_identity \
        --dbname=wicked_identity \
        --command='SELECT COUNT(*) FROM identity_subjects'
)
restored_media_files=$(
    ${compose[@]} exec -T backend sh -ec 'find /var/lib/wicked-learning/media -type f -print | wc -l | tr -d " "'
)

if [[ "$restored_application_principals" != "$expected_application_principals" ]] \
    || [[ "$restored_identity_subjects" != "$expected_identity_subjects" ]] \
    || [[ "$restored_media_files" != "$expected_media_files" ]]; then
    printf 'Restore verification counts do not match the backup manifest.\n' >&2
    exit 70
fi

completed=true
printf 'Verified isolated Rust restore drill for %s.\n' "$backup_directory"
