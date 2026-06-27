# Purpose

Define the login-to-platform start sequence.

The start screen should create a game-like sense of identity and acknowledgement without delaying access. It should be skippable immediately by keyboard, click or tap.

# Core Concepts

- Start sequence: Short intro shown after login.
- Contributor credit: Configurable acknowledgement entry.
- Skip action: User action that ends the intro.
- Seen state: Whether a learner has already seen the current intro version.

# User Experience

## Learner Experience

After login, learners briefly see the configured intro and contributor credits. Pressing space, clicking or tapping skips it.

The intro should be lightweight and respectful of repeat visits.

## Admin Experience

Admins configure credit entries, intro text, optional media, duration and whether the intro appears once per version or every login.

# Data Model Draft

`start_screen_versions`
- purpose: Store versioned intro configuration.
- important_fields: `id`, `name`, `enabled`, `display_mode`, `duration_ms`, `skip_enabled`, `visual_config_json`.
- relationships: Has credit entries.

`start_screen_credits`
- purpose: Store contributor acknowledgements.
- important_fields: `id`, `version_id`, `label`, `description`, `url`, `sort_order`, `visual_config_json`.
- relationships: Belongs to start screen version.

`user_start_screen_views`
- purpose: Track whether a user has seen a version.
- important_fields: `id`, `user_id`, `version_id`, `viewed_at`, `skipped_at`.
- relationships: Belongs to user and version.

# Relationships

A start screen version has many credits. A user may have viewed many versions.

# State and Lifecycle

Start screen versions move through `draft`, `active`, `retired`.

View state per user can be `not_seen`, `shown`, `skipped` or `completed`.

# Configuration Options

Admins can configure credit labels, order, display duration, skip behavior, repeat behavior, background asset, motion settings and accessibility-reduced-motion fallback.

# Visual Configuration

The intro must be themeable. It may use terminal boot, parchment reveal, starfield jump, abstract fade or any other configured presentation. The data model should only store assets and animation tokens.

# API / Backend Responsibilities

The backend should return the active intro version, record viewed or skipped states and decide whether the current user should see it.

# Frontend Responsibilities

The frontend should render the intro, support immediate skip by space/click/tap, respect reduced motion and continue to the main app without reloading.

# Admin Interface

Required screens include start screen version list, credit editor, preview and activation controls.

# Permissions and Privacy

Learners only see active start screen content. Admins manage versions. View tracking should be minimal and not treated as learning analytics.

# Edge Cases

- Intro media fails to load.
- User has reduced motion enabled.
- Admin activates a version with no credits.
- User logs in on a slow connection.

# Open Questions

- Should the intro show once per version or every login by default?
- Should unauthenticated users ever see a public intro?
- Should credits support external links?

# MVP Scope

- One active start screen.
- Configurable credit text.
- Skip with space, click and tap.
- Store seen/skipped state.

# Later Extensions

- Multiple intro themes.
- Seasonal intros.
- Localized credits.
- Audio with explicit user control.
