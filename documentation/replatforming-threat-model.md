# Rust replatforming threat model

## Scope and current status

This is the security review artifact for the greenfield React/Rust proof of
concept. It covers only the local, isolated Compose stack. It neither changes
the Laravel application's routes nor authorizes a production deployment,
credential migration or user-facing write.

The currently exposed Rust API is deliberately read-only: health, anonymous
session status, and published public pages. There is no Rust login, logout,
registration, password-reset, upload, AI, authoring or learner-state mutation
route. A missing control is therefore a release blocker for those future routes
rather than a reason to treat the present read-only slice as secure enough for
authentication or writes.

## Assets and boundaries

| Asset | Owner and boundary | Current safeguard |
| --- | --- | --- |
| Password verifiers, identity status and server-side sessions | Identity PostgreSQL database only | Separate database, distinct Compose credentials, RustCrypto Argon2id verifier and `tower-sessions` SQLx store |
| Application principals, roles, content and learner records | Application PostgreSQL database only | Separate database and no credential-hash columns or cross-database foreign keys |
| Browser session identifier | HTTP-only cookie and identity database | `tower-sessions` defaults to `HttpOnly` and `SameSite=Strict`; `Secure` is on by default and disabled only for local HTTP Compose |
| Uploaded media | Backend-mounted media volume | No public upload/download route; media keys are server-owned opaque values and storage is outside the frontend web root |
| AI provider credentials and model output | Rust backend only | No provider credential, network call or browser-facing AI route exists |
| Public web traffic | React Nginx reverse proxy to private Axum service | Same-origin `/api` proxy; neither database nor backend has a public host port in Compose; the shared browser client uses same-origin credentials and a ten-second request bound; a restrictive CSP, frame denial, same-origin COOP/CORP, no-sniff and referrer policy are set at the public proxy |

The browser is not trusted with authorization decisions, credential material,
media filesystem paths, database credentials or AI provider credentials.

## Threats, present controls and release gates

| Threat | Current position | Required before the relevant route is exposed |
| --- | --- | --- |
| Password guessing, credential stuffing and account enumeration | No credential endpoint exists. Passwords are Argon2id verifiers in the identity database. | A maintained per-account and per-client rate limiter, generic invalid-credential response, bounded request body, structured security event, and tests for repeated failures without password logging. |
| Session fixation, theft and stale sessions | `axum-login` cycles a new session ID on login; password-verifier changes invalidate the authenticated session at its next request. Cookies are HTTP-only and Strict by default. | Test login ID rotation, logout/revocation, expiry, disabled-account rejection and HTTPS cookie attributes. Configure explicit idle and absolute expiries rather than relying on a library default. |
| Cross-site request forgery | No unsafe method exists. The safe CSRF endpoint issues a non-cacheable token plus an encrypted HTTP-only, SameSite=Strict cookie using the maintained `axum_csrf` crate. SameSite is only a defense in depth. | Exact trusted-origin check plus validation of the issued token on every unsafe browser method, with invalid/missing/cross-origin tests. |
| Cross-origin data access | No CORS policy is needed for the same-origin local topology. | Keep the same-origin proxy, or add an explicit allowlist, credential rules and browser tests before a second public origin is introduced. Never use a wildcard credentialed CORS policy. |
| Cross-user or privilege escalation | Only public data and anonymous status are exposed. Application roles exist but no protected route consumes them. | Require an active identity and mapped application principal; enforce each capability's role/resource scope in the Rust use case; add anonymous, wrong-user, disabled, unverified and missing-role tests. |
| Identity/application split inconsistency | Bootstrap commits identity and application work separately, then safely repairs the principal/role mapping when rerun. | Registration/deletion must use idempotent compensating actions or an outbox and reconciliation check; test failure between the two databases. |
| Malicious upload, path traversal or orphaned media | No HTTP media route exists; the volume adapter accepts only server-generated object keys. | Validate size, declared and detected type, authorization and references; serve through a controlled handler; test upload, replacement, deletion, orphan detection and unauthorized access. |
| AI secret disclosure or autonomous model action | No model request exists. The API contract reserves a server-owned adapter boundary. | Keep secrets in backend-only configuration; validate versioned structured output; restrict supplied context; audit requests without learner content; require a separate authorized application action for every write. |
| Sensitive data in logs/errors | Public errors are fixed problem responses. Bootstrap intentionally avoids reporting password-file paths or contents. | Maintain redaction tests for passwords, cookies, authorization headers, database URLs, provider keys and learner-private writing; emit only structured security metadata. |
| Database/media loss or unintended infrastructure change | Local named volumes only; Compose has no production target. | Document encrypted backups, least-privilege database roles, restore drill, recovery target and named rollback operator before any non-local deployment. |

## Security acceptance checklist for the next protected slice

The following evidence is required before a Rust credential or state-changing
endpoint is enabled, even in a non-production user pilot:

1. OpenAPI request, success and problem schemas are reviewed before the route.
2. A maintained library provides rate limiting; the selected limits and trusted
   origin are configuration, not browser-controlled values.
3. Session rotation, logout/revocation and explicit expiry are verified against
   the identity PostgreSQL database.
4. CSRF, origin, anonymous, invalid-credential, disabled, unverified and
   missing-permission cases have API and browser tests.
5. Authentication and security events are auditable without recording
   credentials, cookies, secrets or learner-private content.
6. A fresh test identity can complete the whole flow. A real administrator is
   created only with the operator-provided email and local password file; none
   is guessed or created by automated setup.
7. An independent security review approves the password, recovery, TOTP and
   passkey proof of concept before cutover.

## Current verification

The local browser suite calls the running Compose stack and verifies the public
page contract, standard missing-resource problem, client-side unavailable state,
deep-link behavior and the anonymous session response. The Rust unit suite
verifies password hashing, password-verifier session binding, bounded public
slugs, bootstrap secret-error handling and mounted-media key behavior.

This document is reviewed whenever a protected route, media lifecycle route,
import/export route or AI capability is proposed.
