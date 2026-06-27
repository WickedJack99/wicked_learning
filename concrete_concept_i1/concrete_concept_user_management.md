# Purpose

Define concrete user administration, registration and role management for the platform.

This system exists to let admins invite, inspect and manage users while protecting learner privacy and preventing lockout from removing the last administrator.

# Core Concepts

- User: A registered person using the platform.
- Registration token: Invite code required for account creation.
- Role tag: Permission-bearing or organizational label assigned to a user.
- Forced profile reset: Admin action requiring a user to change username or icon.
- Inviter relationship: Link between an inviting user and invited users.

# User Experience

## Learner Experience

Learners register with email, registration token and a strong password. If an admin clears an inappropriate username or icon, the learner sees a required change step on next login.

## Admin Experience

Admins manage users in a fixed-height management board. The user list scrolls inside the page. Selecting edit opens a layered panel over a blurred background.

# Data Model Draft

`users`
- purpose: Store identity and login metadata.
- important_fields: `id`, `email`, `username`, `display_name_fallback`, `icon_asset_id`, `password_hash`, `registered_at`, `last_login_at`, `must_rename`, `must_change_icon`.
- relationships: Has many roles and invited users.

`registration_tokens`
- purpose: Store invite codes.
- important_fields: `id`, `token_hash`, `created_by_user_id`, `expires_at`, `max_uses`, `used_count`, `disabled_at`.
- relationships: Created by user; used by registered users.

`roles`
- purpose: Store available role catalogue entries.
- important_fields: `id`, `name`, `description`, `permissions_json`, `system_role`.
- relationships: Assigned to many users.

`user_roles`
- purpose: Join users to roles.
- important_fields: `id`, `user_id`, `role_id`, `assigned_by_user_id`, `assigned_at`.
- relationships: Belongs to user and role.

`user_invites`
- purpose: Connect users to the registration token they used.
- important_fields: `id`, `user_id`, `registration_token_id`, `invited_by_user_id`.
- relationships: Belongs to invited user and inviter.

# Relationships

A user may have many roles. A registration token is created by one user and may invite one or more users depending on configuration. A user may have many invited users through used registration tokens.

# State and Lifecycle

Registration token states: `active`, `used_up`, `expired`, `disabled`.

User states: `invited`, `registered`, `active`, `must_update_profile`, `disabled`.

Role assignment changes should be audited. The system must prevent removing the last active admin role.

# Configuration Options

Admins can configure token expiry, max token uses, allowed role tags, password rules, whether username changes require approval and default roles for new users.

# Visual Configuration

User icons should be configurable assets or generated initials. The user management UI should not rely on any world theme. It can use compact icon slots, role badges and status indicators with theme tokens.

# API / Backend Responsibilities

The backend should handle token validation, registration, password policy checks, user listing, role updates, forced username/icon resets and last-admin protection.

It should store audit events for role and identity moderation actions.

# Frontend Responsibilities

The frontend should render the scrollable user board, edit overlay, role tag input with autocomplete, read-only identity fields and clear-and-require-change actions.

It should provide accessible keyboard and mobile behavior for the overlay.

# Admin Interface

Required panels include user list, user detail editor, role catalogue, registration token management and invite history.

# Permissions and Privacy

Only authorized admins can view emails and invite metadata. Regular learners should see display names and approved icons only. Password hashes and token hashes are never exposed.

# Edge Cases

- Admin tries to remove the final admin role.
- User registers with expired token.
- Username is cleared while another learner is viewing it.
- Role tag is renamed after assignment.
- Inviter account is deleted or disabled.

# Open Questions

- Should usernames be globally unique?
- Should admins be able to disable users in MVP?
- Should registration tokens be single-use by default?
- Should email verification be required?

# MVP Scope

- Registration by email, token and strong password.
- User list and edit overlay.
- Role tag catalogue and assignment.
- Forced username/icon reset.
- Last-admin protection.

# Later Extensions

- SSO integration.
- Fine-grained permission editor.
- Bulk invite import.
- Account suspension workflows.
- Self-service profile moderation appeals.
