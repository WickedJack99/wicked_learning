# Frontend and Backend Separation Target

## Status

Proposed target for a dedicated rework task. This document describes the
intended end state; it does not describe the current implementation or approve
a migration plan.

## Target architecture

Wicked Learning will be reworked into independently deployable frontend and
backend applications:

- The frontend will remain a React and TypeScript application.
- The backend will be rewritten in Rust using Axum.
- The frontend will communicate with the backend through an explicit HTTP API
  contract rather than Laravel/Inertia server-rendered page responses.
- Authentication, authorization, validation, persistence, media handling and
  learning-domain behavior will be owned by the Rust/Axum backend.
- Learner and author workflows must preserve the product's existing privacy,
  accessibility, orientation and learner-agency boundaries during the rework.

## Migration expectations

The rework should be planned as an incremental, verifiable migration. Before
removing a Laravel/Inertia capability, its Rust API contract and React client
replacement must cover the applicable current behavior and its important
failure cases. Existing data and media require an explicit migration and
rollback strategy.

## Out of scope for this target statement

This target does not itself select database, authentication, deployment,
repository layout, API versioning or migration sequencing. Those decisions
belong to the implementation plan for the rework task.
