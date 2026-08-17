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
- `content_api.ru` can also create supported content.

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
| `GET`  | `/maps/{map}/map-assets`            | List a map's MapAssets and Activity counts      |
| `POST` | `/maps/{map}/map-assets`            | Create a MapAsset and internal content record   |
| `GET`  | `/map-assets/{mapAsset}/activities` | List a MapAsset's Activities                    |
| `POST` | `/map-assets/{mapAsset}/activities` | Create a validated Activity                     |

The contract response contains the authoritative fields and examples. The API
currently creates individual objects; update, delete, bulk import and automatic
graph wiring are not yet exposed.

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
