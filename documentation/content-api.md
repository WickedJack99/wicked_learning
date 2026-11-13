# Content API

The Wicked Learning Content API is a permission-controlled administration API
for inspecting and creating learning structures through the same backend rules
used by World Builder. It is intended for the Settings console and future
AI-assisted tools, not as a public learner API.

## Access And Authentication

The current base path is:

```text
/api/content/v1
```

Requests use the signed-in, verified administrator's web session. Mutating
requests also require the page CSRF token in `X-CSRF-TOKEN`.

Role permissions are separate:

- `content_api.ro` can read the contract and scoped content.
- `content_api.ru` can create or update supported content.
- `content_api.rud` is required for the advertised destructive operations.

Normal map edit scope still applies. The API does not bypass resource
permissions merely because a user can open the console.

## Contract

`GET /api/content/v1/contract` returns the canonical machine-readable contract.
It includes:

- contract version and base path
- authentication instructions
- AI authoring rules
- registered Activity type definitions and connectors
- the strict ContentPlan schema
- supported operations with request and response examples
- expected HTTP error meanings

Consumers should load this document instead of relying on a copied, unversioned
prompt. IDs returned by the API are opaque and should be reused exactly.

## Current Operations

| Method | Path                                | Purpose                                         |
| ------ | ----------------------------------- | ----------------------------------------------- |
| `GET`  | `/contract`                         | Read the authoring contract                     |
| `GET`  | `/maps`                             | List maps in the administrator's editable scope |
| `POST` | `/maps`                             | Create a map in the current world               |
| `GET` | `/maps/{map}` | Read one map's complete editable details and concurrency timestamp |
| `PATCH` | `/maps/{map}` | Replace one map's complete source Map Details form |
| `DELETE` | `/maps/{map}` | Delete one map through the scoped authoring cascade |
| `GET`  | `/maps/{map}/map-assets`            | List a map's MapAssets and Activity counts      |
| `POST` | `/maps/{map}/map-assets`            | Create a MapAsset and internal content record   |
| `PATCH` | `/map-assets/{mapAsset}` | Replace one MapAsset's authored surface |
| `DELETE` | `/map-assets/{mapAsset}` | Delete one MapAsset through the scoped authoring cascade |
| `GET`  | `/map-assets/{mapAsset}/activities` | List a MapAsset's Activities                    |
| `POST` | `/map-assets/{mapAsset}/activities` | Create a validated Activity                     |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/reflection` | Replace one complete Reflection Activity form |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/review` | Replace one complete Review Activity form |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/open-practice` | Replace one complete Open Practice Activity form |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/markdown` | Replace one complete Markdown Activity page graph |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/question` | Replace one complete Question Activity form |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/shared-task` | Replace one complete Shared Task Activity form |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/item-grant` | Replace one complete Item Grant Activity form |
| `PATCH` | `/map-assets/{mapAsset}/activities/{activity}/tool-grant` | Replace one complete Tool Grant Activity form |
| `GET`  | `/map-assets/{mapAsset}/activity-transitions` | List source-ordered Activity connections |
| `POST` | `/map-assets/{mapAsset}/activity-transitions` | Connect two Activities through the scoped graph writer |
| `PATCH` | `/map-assets/{mapAsset}/activity-transitions/{transition}` | Update a scoped Activity connection's presentation |
| `DELETE` | `/map-assets/{mapAsset}/activity-transitions/{transition}` | Delete one scoped Activity connection |

The contract response contains the authoritative fields and examples. The API
creates individual objects, reads, replaces or deletes one scoped map, replaces
or deletes one MapAsset surface through the existing scoped World Builder
commands, and explicitly manages individual Activity connections within one
MapAsset. Map replacement requires the current `updatedAt` from its read
response and changes only the source Map Details form; visual configuration,
access rules and MapAssets retain their separate commands. MapAsset replacement deliberately
does not rename the linked compatibility node: its title and description are
the creation metadata. A MapAsset or transition mutation remains subject to
the command's map scope; a transition update or deletion additionally proves
that the addressed transition belongs to the URL's MapAsset before delegation.
Map deletion retains the established scoped cascade/reference cleanup. Bulk
import and automatic graph wiring are not exposed. Activity reads include each
record's `updatedAt` timestamp. Reflection, Review, Open Practice, Markdown,
Question, Shared Task, Item Grant and Tool Grant replacement each require that
timestamp, the full source form, and a URL whose MapAsset and typed Activity
are proven to belong together. Their typed commands retain each Activity's
source-specific configuration. Item Grant resolves every catalog item UUID and
Tool Grant resolves its catalog tool UUID server-side. Other Activity types
remain behind their own typed adapters.

## Settings Console

Open **Settings -> API** to use:

- **API Console** for choosing a documented operation, editing its JSON body and
  sending the request with the current session; and
- **API Documentation** for reading the live contract and examples.

The console is intentionally aimed at administrators who understand the effect
of an operation. AI tools should show the planned mutation to the administrator
before sending it.

## Errors And Safe Usage

- `401` means there is no authenticated administration session.
- `403` means the role or map scope does not allow the operation.
- `404` means the addressed content object is unavailable in the current scope.
- `422` identifies request fields that do not satisfy the contract.

When validation fails, correct only the named fields and preserve the author's
instructional intent. Do not invent media paths; use a path selected by the
administrator or leave the image empty. Content-changing clients should log the
contract version they used and require human approval for generated plans.
