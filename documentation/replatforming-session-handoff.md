# Replatforming session handoff

## Required migration procedure

For every slice: inspect the Laravel route, controller/action, authorization,
validation, connected behavior/query/serializer, models and migrations, source
React/Inertia page, and focused tests. Design fresh Rust SQL/schema from that
evidence rather than replaying Laravel migrations. Implement the Rust behavior
and OpenAPI contract, then lift the original React UI and URL semantics around
the typed client. Verify focused backend/contract coverage, generated client,
production build, and desktop plus 390px browser behavior. Update the plan,
commit and push each coherent slice. Laravel remains production owner.

## Current state

- Active branch: `replatform-discovery`; push completed slices to
  `origin/replatform-discovery`.
- Rust is local/development/test only. Do not direct Rust writers or traffic at
  Laravel production without an explicit phase-boundary approval.
- Current untracked generated artifacts must be preserved and not committed:
  `frontend/tsconfig.tsbuildinfo` and `test-results/`.
- Frontend verification commands:
  `cd frontend && npm run build && npm run check:api`; rebuild local browser
  frontend with `docker compose -f compose.rust.yaml build --quiet frontend`
  and `docker compose -f compose.rust.yaml up --detach --force-recreate --no-deps frontend`;
  run focused Chromium tests with `cd frontend && npx playwright test e2e/public-pages.spec.ts --grep "..."`.

## Recent verified source-fidelity work

- `4737302b`: restored Laravel Paths-specific cards instead of reusing the
  compact topic card; preserves orientation links, image, progress/current
  step and typed opaque start behavior, with desktop and 390px checks.
- `679e2e35`, `a630b4ef`, `ad7d6d85`, `d3c9e2b4`: Star Map catalog, review and
  evidence context now consume the existing learner-authorized Rust contract.
- `0ce19409`: Settings notification count uses Laravel's localized `:count`
  template; Settings account/menu checks pass.
- `1fdbd010`: Bookmarks preserves Laravel's document title and shared fixed
  learner header/error behavior; focused browser flow passes.

## Next-slice selection

Choose the next roadmap-priority workflow only after source and contract
inventory. Prefer a currently partial learner route whose complete Rust
contract exists; do not revisit Settings, Bookmarks, Paths or Star Map without
a demonstrated source mismatch. The URL migration register in
`rust-axum-replatforming-plan.md` is the authoritative status record.
