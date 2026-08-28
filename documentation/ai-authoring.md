# AI-assisted Authoring

Wicked Learning can use a configured AI provider to draft a small, reviewable
piece of learning content. AI remains optional, and generated output does not
change the learning world until an administrator explicitly approves it.

## Configure A Provider

Open **Settings -> AI & Integrations** and create a provider credential. The
current transport expects a Responses-compatible endpoint; OpenAI uses
`https://api.openai.com/v1` by default. API keys are stored encrypted and are
never sent to the browser after saving.

Create and enable an Agent template with the purpose **Content authoring**. The
template selects the provider, model, system/task instructions and generation
controls. Use the test request in Settings before opening the authoring flow.

Generation controls are capability-aware. Known unsupported parameters are
omitted rather than sent blindly. Provider failures are returned as sanitized
authentication, permission, quota, rate-limit, invalid-request, connection or
availability errors with a request identifier where available.

## Generate A Draft

Open **Settings -> World Builder -> Graph -> Configure MapAssets**, select a map
and choose **Create with AI**. The brief asks for:

- a learning goal
- optional target audience
- optional prior knowledge
- one to three Activities
- allowed Activity types

The current ContentPlan supports Markdown, Reflection, Message prompt, Shared
task and Open practice Activities. Generation
receives the selected map's title, description and existing MapAsset summaries
so the model can avoid obvious duplication. It does not receive learner records
or hidden answer data.

The response must satisfy a strict, versioned JSON schema. A valid draft stores:

- the proposed MapAsset title, description and label
- the ordered Activity route
- contract versions and validation warnings
- provider/model identifiers and request metadata
- input, output and total token usage
- the administrator and target map

Nothing has been added to the map at this point.

## Review And Apply

Review the summary, MapAsset and every Activity in the draft dialog. Warnings
identify conditions such as a duplicate title or an occupied center position.
Choose **Change brief** to generate a replacement instead of applying a poor
draft.

Applying a draft:

1. verifies that the current user can edit the target map;
2. checks that the draft belongs to that user and has not already been applied;
3. validates the ContentPlan and normal World Builder rules again;
4. creates one focusable MapAsset at X/Y 50 with default size 14;
5. creates the selected Activities and route start;
6. connects the linear transitions; and
7. records who applied the draft and when.

These writes run in one database transaction. A validation or write failure
does not leave a partially created route.

Activity review results are available from the same World Builder graph. A
tutor can open the Activity editor directly from a result, then decide whether
to save any content or metadata changes. Saving a change places the Activity
back in the review queue. After a result is available, the dialog can also move
to the next pending Activity in that node's scoped queue.
Each completed review is also retained as a compact, immutable review run. The
dialog shows the five most recent runs on request, while the activity keeps its
latest result as the current review state. Review history is authoring data and
is never included in learner playback.

## Current Boundaries

- Generation is synchronous; it is not a queued background job yet.
- A draft creates one MapAsset and a short linear route, not a complete world.
- Images are not invented or uploaded by the authoring flow.
- Administrators can edit the MapAsset and Activity fields in a draft before
  applying it. The edited plan is validated again against the same contract and
  scoped Activity types when it is saved.
- Only the administrator who generated a draft can apply it.
- Human approval is mandatory and is part of the contract, not merely a UI hint.

For lower-level administration operations and the machine-readable contract,
see [Content API](content-api.md).
