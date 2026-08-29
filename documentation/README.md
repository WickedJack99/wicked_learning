# Documentation

This folder is the active documentation set for Wicked Learning. The root
README stays public-facing; these files describe product direction, implemented
behavior, architecture and operation without duplicating the development
history.

Wicked Learning is designed as a generic, domain-agnostic platform. A deployment can adapt maps, MapAssets, activities, visuals, media, public pages and terminology to a learning domain while keeping the same underlying architecture.

## Start here

- [Product direction](product.md) - durable product identity, design lenses,
  boundaries and open questions.
- [Local setup](setup.md) - install dependencies, configure the database and start the development server.
- [Feature overview](features.md) - what the current prototype can do from a learner and admin perspective.
- [Architecture notes](architecture.md) - how the main Laravel, Inertia and React pieces fit together.
- [Roadmap](roadmap.md) - active research priorities and strategic product work.
- [AI-assisted authoring](ai-authoring.md) - configure an AI provider and create a reviewable content draft.
- [Content API](content-api.md) - use the administration console and versioned machine-readable contract.
- [Deployment](deployment.md) - run the production container locally or deploy it with Coolify.
- `conversations/` contains archived development conversations and is not an
  active product or implementation specification.

The active documentation has one home per idea:

- `product.md` describes what the platform is trying to be.
- `features.md` describes what the application currently does.
- `architecture.md` describes how the implementation is structured.
- `roadmap.md` describes what is actively being considered next.
- `setup.md`, `deployment.md` and the other focused documents describe
  operational workflows.
