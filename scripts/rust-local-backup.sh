#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    printf 'Usage: %s BACKUP_DIRECTORY\n' "$0" >&2
    exit 64
fi

backup_directory=$1
compose=(docker compose -f compose.rust.yaml)

if [[ -e "$backup_directory" ]]; then
    printf 'Refusing to overwrite existing backup target: %s\n' "$backup_directory" >&2
    exit 65
fi

for service in application-db identity-db backend; do
    if [[ -z "$(${compose[@]} ps -q "$service")" ]]; then
        printf 'The local Rust %s service is not running. Start compose.rust.yaml first.\n' "$service" >&2
        exit 69
    fi
done

umask 077
mkdir -p "$backup_directory"

${compose[@]} exec -T application-db pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --username=wicked_application \
    wicked_application > "$backup_directory/application.dump"

${compose[@]} exec -T identity-db pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --username=wicked_identity \
    wicked_identity > "$backup_directory/identity.dump"

${compose[@]} cp backend:/var/lib/wicked-learning/media "$backup_directory"

application_principal_count=$(
    ${compose[@]} exec -T application-db \
        psql --tuples-only --no-align --username=wicked_application \
        --dbname=wicked_application \
        --command='SELECT COUNT(*) FROM application_principals'
)
identity_subject_count=$(
    ${compose[@]} exec -T identity-db \
        psql --tuples-only --no-align --username=wicked_identity \
        --dbname=wicked_identity \
        --command='SELECT COUNT(*) FROM identity_subjects'
)
media_file_count=$(find "$backup_directory/media" -type f -print | wc -l | tr -d ' ')

(
    cd "$backup_directory"
    sha256sum application.dump identity.dump
    find media -type f -print0 | sort -z | xargs --null --no-run-if-empty sha256sum
) > "$backup_directory/SHA256SUMS"

created_at=$(date --utc +%Y-%m-%dT%H:%M:%SZ)
cat > "$backup_directory/manifest.txt" <<EOF
format=wicked-learning-rust-local-backup-v1
created_at=$created_at
application_principal_count=$application_principal_count
identity_subject_count=$identity_subject_count
media_file_count=$media_file_count
EOF

printf 'Created local Rust backup at %s\n' "$backup_directory"
