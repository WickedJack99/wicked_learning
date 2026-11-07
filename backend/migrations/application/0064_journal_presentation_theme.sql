-- The source keeps Journal presentation platform-owned. The initial Rust
-- reader uses its source-derived default until the separately authorized
-- administrator configuration and media-upload slice is migrated.
ALTER TABLE application_journal_feedback_policy
    ADD COLUMN theme JSONB;

COMMENT ON COLUMN application_journal_feedback_policy.theme IS
    'Future platform-owned Journal light/dark presentation configuration; null uses the source-derived Rust default.';
