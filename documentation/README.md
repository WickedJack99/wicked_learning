# Documentation

This folder contains practical documentation for Wicked Learning. The root README stays public-facing; these files describe implemented behavior in more detail.

Wicked Learning is designed as a generic, domain-agnostic platform. A deployment can adapt maps, MapAssets, activities, visuals, media, public pages and terminology to a learning domain while keeping the same underlying architecture.

## Start here

- [Local setup](setup.md) - install dependencies, configure the database and start the development server.
- [Feature overview](features.md) - what the current prototype can do from a learner and admin perspective.
- [Architecture notes](architecture.md) - how the main Laravel, Inertia and React pieces fit together.
- [AI-assisted authoring](ai-authoring.md) - configure an AI provider and create a reviewable content draft.
- [Content API](content-api.md) - use the administration console and versioned machine-readable contract.
- [Deployment](deployment.md) - run the production container locally or deploy it with Coolify.
- [Codex working environment](codex/README.md) - repository guidance for coding-agent sessions.

## Related project notes

- `concept` contains earlier and exploratory concept material.
- `concept_current` contains the current concept direction.
- `conversations` contains archived development conversations.

The concept files are allowed to be messy and alive. This documentation folder should be the clearer reference for things that already exist in the application.
