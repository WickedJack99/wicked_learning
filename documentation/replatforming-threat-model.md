# Rust replatforming threat model

## Scope and current status

This is the security review artifact for the greenfield React/Rust local
Compose deployment. It covers the protected local migration slices listed in
the replatforming plan: identity and sessions, recovery, MFA/passkeys,
authoring, media, learner state, collaboration and bounded AI workflows. It
neither changes the Laravel application's routes nor authorizes a production
deployment, credential migration or production user-facing write.

The standalone React client and Rust API now expose the source-derived local
workflows through the documented typed contracts. Each added protected route
has its own CSRF, authorization and browser evidence; feature coverage belongs
in the replatforming plan and its focused tests rather than this threat model.
A missing control remains a release blocker for any broader user pilot or
production cutover.

## Assets and boundaries

| Asset | Owner and boundary | Current safeguard |
| --- | --- | --- |
| Password verifiers, identity status and server-side sessions | Identity PostgreSQL database only | Separate database, distinct Compose credentials, RustCrypto Argon2id verifier and `tower-sessions` SQLx store |
| Application principals, roles, content and learner records | Application PostgreSQL database only | Separate database and no credential-hash columns or cross-database foreign keys |
| Browser session identifier | HTTP-only cookie and identity database | `tower-sessions` defaults to `HttpOnly` and `SameSite=Strict`; `Secure` is on by default and disabled only for local HTTP Compose |
| Uploaded media | Backend-mounted media volume | Server-owned opaque keys, type/size validation, reference integrity, scoped author preview/download and active-reference public or learner delivery |
| AI provider credentials and model output | Rust backend only | Encrypted server-side provider metadata, bounded typed output, scoped review/Companion context and no autonomous browser-authorized content mutation |
| Public web traffic | React Nginx reverse proxy to private Axum service | Same-origin `/api` proxy; neither database nor backend has a public host port in Compose; the shared browser client uses same-origin credentials and a ten-second request bound; a restrictive CSP, frame denial, same-origin COOP/CORP, no-sniff and referrer policy are set at the public proxy |

The browser is not trusted with authorization decisions, credential material,
media filesystem paths, database credentials or AI provider credentials.

## Threats, present controls and release gates

| Threat | Current position | Required before the relevant route is exposed |
| --- | --- | --- |
| Password guessing, credential stuffing and account enumeration | Passwords are Argon2id verifiers in the identity database. The local login route returns one generic invalid-credential problem and uses `tower_governor` to limit its five-attempt burst to one replenished attempt per minute, keyed by the Nginx-overwritten client-IP header. | Add durable per-account limits and security audit events before a user pilot; replace the process-local limiter with a shared/gateway limiter before running more than one backend replica; retain repeated-failure tests without password logging. |
| Session fixation, theft and stale sessions | `axum-login` cycles a new session ID on login; password-verifier changes invalidate the authenticated session at its next request. Cookies are HTTP-only and Strict by default. | Test login ID rotation, logout/revocation, expiry, disabled-account rejection and HTTPS cookie attributes. Configure explicit idle and absolute expiries rather than relying on a library default. |
| Cross-site request forgery | The local login/logout routes require an exact configured Origin and a token issued by the non-cacheable CSRF endpoint, backed by an encrypted HTTP-only, SameSite=Strict cookie using the maintained `axum_csrf` crate. SameSite is only a defense in depth. | Apply the same origin/token guard to every future unsafe route, with invalid/missing/cross-origin tests. |
| Cross-origin data access | No CORS policy is needed for the same-origin local topology. | Keep the same-origin proxy, or add an explicit allowlist, credential rules and browser tests before a second public origin is introduced. Never use a wildcard credentialed CORS policy. |
| Cross-user or privilege escalation | Protected routes resolve an active identity to an application principal and enforce source permissions plus resource scope. | Maintain anonymous, wrong-user, disabled, unverified and missing-role tests for every new protected capability. |
| Identity/application split inconsistency | Bootstrap commits identity and application work separately, then safely repairs the principal/role mapping when rerun. | Registration/deletion must use idempotent compensating actions or an outbox and reconciliation check; test failure between the two databases. |
| Malicious upload, path traversal or orphaned media | Managed media accepts bounded validated uploads, keeps opaque server-generated keys, and serves only through scoped content routes. | Maintain upload/replacement/deletion/orphan and cross-user download tests for each new media reference type. |
| AI secret disclosure or autonomous model action | Provider metadata remains encrypted server-side; bounded provider turns and review/content-plan output require server validation and an explicit authorized write. | Keep secrets in backend-only configuration, restrict supplied context, audit without learner content and retain no autonomous content or navigation action. |
| Sensitive data in logs/errors | Public errors are fixed problem responses. Bootstrap intentionally avoids reporting password-file paths or contents. | Maintain redaction tests for passwords, cookies, authorization headers, database URLs, provider keys and learner-private writing; emit only structured security metadata. |
| Database/media loss or unintended infrastructure change | Local named volumes, private two-database/media backups and a verified isolated restore drill. | Before any non-local deployment, define encrypted backup storage, least-privilege roles, recovery objectives, retention, tested restore frequency and a named rollback operator. |

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

The local browser suite calls the running Compose stack and verifies the
source-derived public, identity, authoring, learner, collaboration, media and
AI capability boundaries, including security headers, CSRF/origin checks and
login-rate-limit protections. The Rust suite verifies the corresponding domain,
database and API behavior. The local backup script and isolated restore drill
were exercised against the disposable Compose data on 13 November 2026; both
database dumps, media restoration, forward migration, readiness and recorded
counts succeeded without touching the running stack.

This document is reviewed whenever a protected route, media lifecycle route,
import/export route or AI capability is proposed.
