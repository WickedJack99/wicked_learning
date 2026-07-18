# AI-Based Competence Question Generation

## Overview

The platform should support AI-assisted generation of competence-oriented learning questions.

The goal is not to generate simple factual recall questions.

Instead, the AI should generate questions that help learners apply knowledge in realistic scenarios.

Bad example:

```text
How does component X work?
```

Better example:

```text
The system is slower than usual. What would you do to investigate the problem?
```

The generated questions should help learners demonstrate understanding, reasoning and practical decision-making.

---

# Question Design Philosophy

AI-assisted questions should focus on competence rather than memorization.

Questions should encourage learners to:

* Analyze a situation
* Identify relevant information
* Choose an appropriate investigation path
* Explain reasoning
* Compare possible actions
* Apply concepts to practical scenarios
* Reflect on trade-offs

The platform should prefer scenario-based and problem-oriented questions.

Examples:

```text
A group activity suddenly stops accepting new participants. What would you check first?
```

```text
A practice exercise produces too many irrelevant prompts after a configuration change. How would you investigate and reduce noise?
```

```text
A project becomes harder to maintain over time. Which lifecycle or cleanup settings would you review?
```

---

# Question Types

The system should support multiple AI-assisted question types.

Possible question types:

* Scenario question
* Reflection question
* Multiple-choice question
* Open-ended explanation question
* Decision-making question
* Reflection question
* Practical lab task
* Boss challenge question

The preferred default should be scenario-based questions.

---

# Competence-Oriented Feedback

Generated questions should include feedback metadata.

The feedback should not only say whether an answer is correct or incorrect.

It should explain what the learner demonstrated and what might still be missing.

Example feedback:

```text
Your answer correctly identifies system health as a possible cause.
However, you did not mention checking configuration, access rules or recent changes.
```

Feedback should support competence development by being specific, informational and actionable.

---

# AI Connections Dashboard

The admin interface should include an "AI Connections" panel.

This panel allows administrators to manage connected AI providers and models.

The platform should not depend on a single AI provider.

Instead, it should support multiple configurable providers.

Possible providers:

* OpenAI
* Azure OpenAI
* Ollama
* Custom HTTP-compatible provider

Each AI connection represents one configured model endpoint.

---

# AI Provider Configuration

Each AI provider connection should include the following fields:

```text
AI Provider
- Name
- Type
- Base URL
- Model
- API Key
- Default context
- Enabled / disabled
```

## Name

A human-readable name for the connection.

Example:

```text
OpenAI GPT-4.1
```

## Type

The provider type.

Possible values:

```text
OpenAI
Azure
Ollama
Custom
```

## Base URL

The base endpoint used for API requests.

## Model

The model identifier used for generation.

## API Key

The credential used to authenticate against the provider.

API keys should be stored securely and never exposed to normal users.

## Default Context

A general instruction context used for requests made through this connection.

Example:

```text
Generate competence-oriented questions for learners in this world.
Prefer scenario-based questions.
Avoid pure memorization questions unless necessary.
```

---

# Global AI Context

The platform should support a global AI context.

The global AI context describes general rules that apply across the whole platform.

Example:

```text
All generated questions should follow Self-Determination Theory principles.
Feedback should be informational rather than controlling.
Questions should focus on practical competence and realistic decision-making.
Avoid questions that only test terminology.
```

The global context can be reused by worlds, maps, nodes and modules.

---

# AI Context Override

Each learning object should be able to define an optional AI context override.

This allows administrators to customize generation behavior for specific areas.

Possible scope levels:

* World
* Map
* Node
* Activity
* Module

Each override may contain:

```text
AI Context Override
- Inherit global context: yes/no
- Additional context
- Generation goal
- Difficulty level
- Question style
```

---

# Context Inheritance

Context inheritance determines how the final prompt is assembled.

## Inherit global context: yes

If enabled, the AI request should include:

```text
Global context
+ Provider default context
+ Local additional context
```

This is useful when local generation should follow the general platform philosophy.

## Inherit global context: no

If disabled, the AI request should use only:

```text
Provider default context
+ Local additional context
```

or, depending on configuration:

```text
Local additional context only
```

This is useful when a specific module needs a completely different generation style.

---

# Generation Goal

The generation goal describes what the AI should create.

Examples:

```text
Generate 5 troubleshooting questions for intermediate learners.
```

```text
Generate open-ended scenario questions that test practical investigation skills.
```

```text
Generate a boss challenge with three escalating problems.
```

---

# Difficulty Level

The system should support difficulty levels.

Possible values:

```text
Beginner
Intermediate
Advanced
Expert
```

Difficulty should influence:

* Complexity of the scenario
* Number of concepts involved
* Expected reasoning depth
* Amount of ambiguity
* Required prior knowledge

---

# Question Style

The question style defines the preferred format.

Possible values:

```text
Scenario-based
Reflection
Multiple-choice
Open-ended
Reflection
Lab-oriented
Boss challenge
```

The style should guide the AI output but not fully restrict it.

---

# Generated Output Structure

AI-assisted questions should be stored in a structured format.

Example:

```json
{
  "question": "A deployment becomes slower after increasing log ingestion. What would you investigate first?",
  "type": "scenario",
  "difficulty": "intermediate",
  "expected_answer_points": [
    "Check ingestion rate and indexing pressure",
    "Review resource usage of hot nodes",
    "Inspect shard count and index lifecycle settings",
    "Check logs or system notes for bottlenecks"
  ],
  "feedback_correct": "Your answer shows a good understanding of operational troubleshooting.",
  "feedback_partial": "Your answer identifies one valid direction, but it misses other important investigation areas.",
  "feedback_incorrect": "Try to focus on resource usage, ingestion pressure and data lifecycle configuration.",
  "competencies": [
    "World Operations",
    "Reflection",
    "Resource Analysis"
  ]
}
```

---

# Review Workflow

AI-assisted questions should not automatically become active learning content.

A review step should exist.

Suggested workflow:

```text
Generate questions
â†“
Admin reviews questions
â†“
Admin edits or rejects questions
â†“
Admin approves selected questions
â†“
Questions become available to learners
```

This keeps human responsibility in the loop and improves content quality.

---

# Core Principle

The AI should not replace domain expertise.

The AI should help transform domain expertise into learning experiences.

The platform should act as a bridge between expert knowledge and competence-oriented learning.

---

# Agent Instruction Sets

Reusable agent instructions should be importable and exportable as simple files.

This allows admins to:

* download a working instruction set
* edit it outside the browser
* upload it into an agent template
* share improved instruction sets through issues or pull requests

The repository should contain public starter sets for common responsibilities such as:

* Self-Determination Theory design support
* learner reflection feedback
* asset generation briefs
* competence-oriented question design

Instruction files should not contain learner data, API keys, hidden answers or deployment-specific secrets.
