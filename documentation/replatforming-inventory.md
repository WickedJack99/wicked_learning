# Rust/Axum Replatforming Inventory

## Status

This is the phase 0 source-level inventory for the proposed replatforming. It
is behavior/domain evidence, not a data-migration specification: the Rust
platform starts with fresh identity, application and media data.

## Endpoint inventory

Laravel registers 286 application routes. The route list was generated with
`php artisan route:list --except-vendor --json`; the route source files remain
the canonical per-endpoint inventory until the OpenAPI register is created.

| Route family                | Count | Current source                                  | Target Rust module                                              | Initial migration position                       |
| --------------------------- | ----: | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Public and learner shell    |    21 | `routes/web.php`                                | `platform_admin`, `identity_access`, `world_content`            | public presentation/read-only shell first        |
| Access links                |     3 | `routes/web.php`, settings controllers          | `identity_access`                                               | after identity decision                          |
| Versioned content API       |     7 | `routes/api.php`                                | `authoring`, `world_content`                                    | preserve as an explicit API-contract reference   |
| Learner interactions        |    49 | `routes/web.php`                                | `learner_state`, `world_content`, `collaboration`               | read-only exploration before mutations           |
| Organizations               |    15 | `routes/web.php`                                | `collaboration`                                                 | later vertical slice                             |
| Protected media             |     1 | `routes/web.php`, `ProtectedMapMediaController` | `media_presentation`                                            | retain serving authorization until media cutover |
| Settings and administration |   102 | `routes/settings.php`                           | `platform_admin`, `identity_access`, `media_presentation`, `ai` | after learner read/write parity                  |
| World authoring             |    86 | `routes/settings.php`                           | `authoring`, `world_content`                                    | read serializers before graph mutations          |
| Topics                      |     2 | `routes/web.php`                                | `world_content`, `learner_state`                                | read-only exploration slice                      |

The route table describes migration families, not HTTP ownership. The future
OpenAPI endpoint register must add one row per endpoint with actor,
permission/scope, input validation, transaction, tables/media touched,
response/error schema, existing tests, target endpoint, rollout flag and
owner.

### High-risk endpoint families

- Activity playback and mutations: transitions, play-run state, questions,
  journal/reflection writes, recall, item/tool grants and obstacle resolution.
- World authoring: graph editing, versions/restores, duplicate/import/export,
  templates, localization and portal references.
- Access control: registration tokens, access links, roles, verified-user
  checks, map edit scopes and account status.
- Media: uploads, replacements, reusable-asset references, deletion and
  protected delivery.
- Collaboration: messages, organizations, shared-task submissions/reviews and
  moderation.

## Data model inventory

The source contains 80 models, 167 migrations and 97 distinct migration-created
tables. Use these records to identify product behavior and model decisions;
design fresh identifiers, foreign keys, timestamps and JSON structures for the
Rust databases rather than inheriting Laravel persistence by default.

The accepted target separates identity into its own PostgreSQL database.
Credential hashes, passkeys, MFA/recovery material, sessions and verification
tokens move there. The application database receives only an immutable opaque
identity-subject mapping; it must not retain a second live credential store
after cutover.

| Bounded context               | Important current records                                                                                                                                   | First-Rust rule                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and access           | `User`, `UserPreference`, `AccessRole`, `AccessRolePermission`, `RegistrationToken`, `AccessLink`, `AccessLinkRedemption`, `AccessChangeEvent`              | create fresh identity records in the separate identity database; map the application principal by immutable subject and do not deserialize or import Laravel sessions |
| World content                 | `LearningWorld`, `LearningMap`, `LearningMapAsset`, `LearningNode`, `LearningActivity`, `LearningActivityStart`, `ActivityTransition`, `LearningPortalLink` | preserve learner/author behavior, but decide whether the fresh model needs a separate Node compatibility record                                                       |
| Learner state                 | progress, discovery, bookmark, answer, recall, reflection, review-attempt and evidence models                                                               | server resolves access and transitions; writes are transactional and single-writer                                                                                    |
| Authoring history             | map/world/asset/activity versions, templates and revisions, source records, concepts, topics and translations                                               | preserve revision/restore and import/export integrity before schema refactoring                                                                                       |
| Collaboration                 | groups, group messages, shared submissions/reviews, organizations, memberships, join requests and moderation                                                | migrate authorization and visibility rules together with each record family                                                                                           |
| Media and configurable assets | reusable metadata, tools, items, sounds, dialogue sounds and platform presentation                                                                          | do not delete/rewrite a referenced object without an explicit lifecycle check                                                                                         |
| Platform and AI               | info pages, feedback, languages, journal/presentation/organization/companion settings, provider credentials, templates and authoring runs                   | keep credentials server-only and retain reviewable AI boundaries                                                                                                      |

### Current graph as behavior evidence

```text
LearningWorld
  -> LearningMap
    -> LearningMapAsset
      -> LearningNode (internal compatibility record)
        -> LearningActivityStart -> LearningActivity -> ActivityTransition
```

`LearningMapAsset` is the product-facing authoring object in the current
implementation. `LearningNode` currently roots progress, bookmarks, unlock
rules and portal relations. The greenfield model must explicitly decide whether
one or two records best preserve those behaviors; it is not required to retain
the Laravel compatibility structure or identifiers.

## Media inventory

The current source uses `LearningMediaUploadService` as the common upload path,
with specialized services for node, item, tool, sound, profile and presentation
media. `ReusableMediaAssetManager` handles reusable-asset references, and
`ProtectedMapMediaController` authorizes protected map delivery.

Current deployment documentation describes `/storage/*` public-upload cache
headers and a public storage symlink. The static source also retains a
protected-media route. The Rust media adapter must therefore explicitly model:

1. public versus protected visibility;
2. ownership and role/map-scope authorization;
3. upload validation, generated storage paths and byte limits;
4. references from configuration JSON, versions and transfer packages;
5. replacement/deletion/orphan detection; and
6. cache headers, preview and download behavior.

No uploaded objects are present locally, and none will be transferred. The new
media implementation starts with a fresh store and must test its own
public/protected split, object references and orphan detection from bootstrap.

## Existing behavior protection assets

The repository has 618 passing Pest tests after a standard test-key setup.
Important test families include access links, activity/player behavior,
authoring/import/export, learner authorization, journals, messages, recall,
groups, organizations, settings and media. These are the initial parity-test
source, supplemented by browser coverage because no frontend test files are
currently present.
