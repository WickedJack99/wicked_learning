# Rust/Axum Replatforming Baseline

## Status

This report records the phase 0 local baseline established on 1 November 2026
on the `replatform-discovery` branch. It is an observation report, not a
production readiness claim. No production infrastructure, user-facing route or
application behavior was changed.

The intended migration process is defined in the
[Rust/Axum Replatforming Plan](rust-axum-replatforming-plan.md). The companion
[inventory](replatforming-inventory.md) records the source-level endpoint,
data and media boundaries.

## Environment

| Item                                       | Observed value                                                    |
| ------------------------------------------ | ----------------------------------------------------------------- |
| PHP                                        | 8.5.12                                                            |
| Composer                                   | 2.10.3                                                            |
| Node.js / npm                              | 26.13.0 / 11.20.0                                                 |
| Rust / Cargo                               | 1.99.1 / 1.99.1                                                   |
| Laravel                                    | 13.15.0                                                           |
| Frontend stack                             | React 19, TypeScript and Vite 8, as locked in `package-lock.json` |
| Local runtime configuration without `.env` | production environment, SQLite default; no encryption key         |

`composer install --no-interaction --prefer-dist --no-progress` and `npm ci`
completed from the committed lock files. Dependencies are local ignored build
artifacts; neither lock file changed.

## Baseline checks

| Check                         | Result          | Evidence and interpretation                                                                                                                                                                                                      |
| ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production frontend build     | Pass            | `npm run build` succeeded in 8.44 seconds and regenerated the ignored Wayfinder route/action modules.                                                                                                                            |
| TypeScript after normal build | Pass            | `npm run types:check` passed once Wayfinder output was present. The pre-build failure was solely unresolved generated route/action imports.                                                                                      |
| Laravel/Pest suite            | Pass            | 618 tests and 9,453 assertions passed in 10.95 seconds with the committed in-memory SQLite test settings and a command-scoped test encryption key. No local `.env`, database, user data or deployment configuration was changed. |
| PHPStan with 1 GB limit       | Pass            | `vendor/bin/phpstan analyse --no-progress --memory-limit=1G` completed successfully. The default 128 MB limit exhausted memory while parsing; the failure is configuration capacity, not a reported static-analysis finding.     |
| Composer lint script          | Blocked locally | `composer run lint:check` invokes Pint with `--parallel`; Pint could not bind its local TCP worker socket in this environment.                                                                                                   |
| Pint without parallelism      | Fails           | One existing style finding: `tests/Feature/DeploymentConfigurationTest.php` requires the `single_quote` fixer. It was not changed because this phase preserves behavior and records baseline debt.                               |
| ESLint                        | Fails           | After generated routes exist, 51 existing errors remain across frontend files: import/type-import ordering, unused values, formatting and React state/effect rules. No automatic fixes were applied.                             |
| Prettier                      | Fails           | 17 existing files differ from configured formatting. No automatic fixes were applied.                                                                                                                                            |
| Docker runtime inventory      | Unavailable     | This workspace cannot access `/var/run/docker.sock`; container/database state was not inferred or altered.                                                                                                                       |

The first test invocation failed before tests because no `APP_KEY` was set in
the workspace. The passing invocation supplied an ephemeral command-scoped key
only for the test process. It did not create or reveal an application secret.

## Application shape baseline

| Surface                                                    | Observed source-level count |
| ---------------------------------------------------------- | --------------------------- |
| Registered application routes                              | 286                         |
| `GET` / `HEAD` route methods                               | 88 / 88                     |
| `POST`, `PATCH`, `PUT`, `DELETE` route methods             | 105, 64, 3, 30              |
| Eloquent models                                            | 80                          |
| Laravel migrations                                         | 167                         |
| Unique tables created by migration sources                 | 97                          |
| React route-page source files                              | 66                          |
| Frontend files importing Inertia or using its router/forms | 128                         |
| Learning actions / queries / serializers                   | 80 / 50 / 40                |

These counts are planning indicators, not complexity estimates. The inventory
identifies the important state and authorization boundaries that must be
preserved.

## Data and media baseline limitations

The local checkout contains only `storage/app/public/.gitignore`; it has no
uploaded-media objects. That is consistent with the accepted greenfield-data
scope: no legacy media, database rows, credentials, sessions or user accounts
will be migrated into the Rust platform.

The Laravel schema, migrations and models remain useful behavior/domain
evidence, but a live PostgreSQL inventory or anonymized restore is not a phase
0 requirement. Phase 2 will define fresh identity and application schemas,
their bootstrap data and their own backup/restore procedures.

## Phase 0 gate

The local executable baseline, route inventory and source-level data/media
inventory are complete. Phase 0 is passed for the accepted greenfield-data
scope. A separate PostgreSQL test environment is still required in phase 2 to
test the new Rust migrations and bootstrap procedures, not to restore Laravel
data.

## Reproduction commands

```sh
composer install --no-interaction --prefer-dist --no-progress
npm ci
npm run build
npm run types:check
APP_KEY='<ephemeral test key>' php artisan test --compact
vendor/bin/phpstan analyse --no-progress --memory-limit=1G
```

The lint/format commands are intentionally included in subsequent baseline
reviews, but currently report the documented existing findings:

```sh
npm run lint:check
npm run format:check
vendor/bin/pint --test --format agent
```
