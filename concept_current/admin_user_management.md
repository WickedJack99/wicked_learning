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
- Roles are currently `admin` and `user`.
- Users can create tokens only for roles at their own capability level or below.
- Admin users can disable login for another user.
- Admin users can ban another user until a selected date.
- Admin users can delete another user.
- Admin users cannot lock themselves out from the Users panel.

Design notes:

- Role chips display assigned roles and allow removing roles where permitted.
- Token creation opens as an overlay dialog so the Users panel stays readable.
- The login access control runs both during login and on later authenticated web requests.
- The role system is intentionally simple until there is a real need for more detailed permissions.

Future direction:

- Add clearer audit history for access changes.
- Add optional token labels or notes so admins remember why a token was created.
- Add role-management UI only when more roles exist.
- Add safer deletion flows if real learner data becomes important.
