# Admin User Management

The current admin slice focuses on safe public operation rather than content authoring.

Implemented now:

- Admin users can open a Users panel from Settings.
- Admin users can see registered users.
- Admin users can inspect read-only registration details for a user.
- Admin users can create one-use registration tokens.
- Registration tokens store creator, creation date, optional expiration date, usage date and used-by user.
- Registration tokens can grant one or more roles.
- Users can have multiple roles.
- Roles are configurable and seeded with system roles for `admin` and `user`.
- Role permissions use resource-level access levels: no access, read-only, read/update, and read/update/delete.
- Current permission resources cover users, roles, worlds, assets, sounds and presentation.
- Users can create tokens only for roles at their own capability level or below.
- Admin users can disable login for another user.
- Admin users can ban another user until a selected date.
- Admin users can delete another user.
- Admin users cannot lock themselves out from the Users panel.
- Admin users can edit public presentation settings from a separate Settings subpanel.
- Admin users can configure login, registration and welcome background image paths.
- Admin users can upload and download public presentation background images.
- Admin users can edit welcome-page text blocks.
- Admin users can edit About, Imprint and Data Protection Markdown from the public presentation subpanel.
- Admin users with the right permissions can manage reusable visual assets, reusable sounds and reusable tools.

Design notes:

- Role chips display assigned roles and allow removing roles where permitted.
- Role management lives inside Access management, not inside User management, so assigning people and defining permissions stay separate.
- Token creation opens as an overlay dialog so the Users panel stays readable.
- The login access control runs both during login and on later authenticated web requests.
- The role system should remain generic. New administrative areas should add a permission resource instead of hard-coding role names in routes or components.
- Public presentation editing is kept separate from user administration so the Settings main view does not become a dumping ground.
- World editing also uses a separate page rather than a shared Settings subpanel because the editor has its own graph/map state.
- Tools, visuals and sounds are split into separate administration areas because they have different responsibilities even when they all handle files.

Future direction:

- Add clearer audit history for access changes.
- Add optional token labels or notes so admins remember why a token was created.
- Add safer deletion flows if real learner data becomes important.
