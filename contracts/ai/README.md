# AI interaction contracts

AI operations are part of the browser/API contract, not a direct browser-to-
provider integration. This folder reserves their contract home before a
user-facing AI capability is rebuilt.

Each future contract must define:

- a stable capability name and version;
- the authenticated actor and authorization policy;
- a bounded input DTO, including which application context is permitted;
- a strict, versioned output schema that the backend validates;
- the data-retention, audit and failure behavior; and
- whether the result is only a draft or may be submitted to a separately
  authorized application use case.

The backend owns all provider credentials and calls the provider through an
`AiProvider` adapter. The initial adapter will use `async-openai` and the
Responses API; provider-specific request/response types must not appear in a
React component or public endpoint. Model output is untrusted: it has no
authority to execute tools, select permissions, update content or change learner
progress.

No AI operation is exposed by the phase-2 foundation. The existing Laravel AI
authoring and companion behavior remains the behavior reference for later
vertical slices, not an active compatibility endpoint.
