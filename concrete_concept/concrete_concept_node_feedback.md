# Purpose

Define private, anonymized learner feedback for improving activities and nodes.

This system is for quality control, not public social review. It should help admins find confusing, broken, too-easy or too-hard content without creating popularity drama.

# Core Concepts

- Feedback entry: Learner-submitted improvement signal.
- Star rating: Optional numeric quality or usefulness rating.
- Feedback category: Structured issue type.
- Admin-only tag: Internal classification for content management.
- Resolution state: Whether feedback has been handled.

# User Experience

## Learner Experience

Learners can open a small feedback button inside an activity and submit rating, optional note and issue categories. Feedback is private and anonymized.

## Admin Experience

Admins see feedback dashboards sortable by rating, count, date, tags, activity type, map, node and unresolved reports.

# Data Model Draft

`activity_feedback`
- purpose: Store anonymized learner feedback.
- important_fields: `id`, `activity_id`, `anonymous_user_hash`, `rating`, `difficulty`, `note`, `category`, `status`, `created_at`.
- relationships: Belongs to activity.

`admin_tags`
- purpose: Store internal content tags.
- important_fields: `id`, `name`, `description`, `color_token`.
- relationships: Assigned to activities, nodes or maps.

`tag_assignments`
- purpose: Attach admin-only tags to content.
- important_fields: `id`, `tag_id`, `target_type`, `target_id`, `assigned_by_user_id`.
- relationships: Connects tags to content.

`feedback_actions`
- purpose: Track admin handling.
- important_fields: `id`, `feedback_id`, `action_type`, `note`, `created_by_user_id`, `created_at`.
- relationships: Belongs to feedback.

# Relationships

An activity has many feedback entries. Admin tags can attach to activities, nodes or maps. Feedback actions document triage and resolution.

# State and Lifecycle

Feedback states: `new`, `triaged`, `in_progress`, `resolved`, `dismissed`.

Content quality state may derive from feedback volume, average rating and unresolved critical reports.

# Configuration Options

Admins can configure feedback categories, rating scale, difficulty options, required/optional fields, anonymization behavior and dashboard thresholds.

# Visual Configuration

Learner feedback UI should be small and theme-compatible. Admin dashboards should remain utilitarian. Icons, rating controls, category chips and status colors should use configurable tokens.

# API / Backend Responsibilities

The backend should accept feedback, anonymize or pseudonymize submitter identity, aggregate ratings, expose admin filters and protect against duplicate spam without public identity exposure.

# Frontend Responsibilities

The frontend should render feedback button, compact form, confirmation state and admin feedback dashboards with sorting and filtering.

# Admin Interface

Required screens include feedback overview, activity feedback detail, tag filter, status workflow, unresolved reports and content quality summary.

# Permissions and Privacy

Learners cannot see other learners' feedback. Admins see anonymized feedback only. Admin-only tags are hidden from learners.

# Edge Cases

- Learner submits feedback multiple times.
- Activity is deleted with unresolved feedback.
- Very low rating with no note.
- Feedback note includes personal data or abuse.
- Anonymization conflicts with duplicate prevention.

# Open Questions

- Should learners be able to edit or withdraw feedback?
- Should duplicate feedback from the same learner replace or add?
- Should severe reports notify admins immediately?

# MVP Scope

- Feedback button per activity.
- Rating, difficulty and optional note.
- Admin feedback table with filters.
- Admin-only tags.
- Feedback status workflow.

# Later Extensions

- AI clustering of feedback themes.
- Quality trend charts.
- Automatic rework suggestions.
- Moderation tools for sensitive notes.
