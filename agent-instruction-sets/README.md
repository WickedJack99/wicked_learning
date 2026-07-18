# Agent Instruction Sets

This folder contains reusable starter instructions for AI agent templates in the platform.

Administrators can open a file, copy or download it, and import it into an agent template from **Settings -> AI support -> Agent templates**. Each file keeps the same simple structure:

```markdown
## System prompt

Long-running behavior and boundaries for the agent.

## Task prompt

The specific task pattern the agent should follow.
```

These instruction sets are intentionally domain-generic. They should help deployments create their own learning worlds without adding points, streak pressure, global leaderboards or other reward loops that distract from knowledge, autonomy and competence.

## Improving the Sets

If an instruction set works especially well in practice, please propose improvements through an issue or pull request. Useful contributions explain:

- what the agent was used for
- which context was provided
- what improved after the change
- what safety or quality boundary the change preserves

Do not include private learner data, API keys, proprietary content or unreleased assessment answers in shared instruction sets.
