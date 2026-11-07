CREATE TABLE application_identity_deletion_jobs (
    subject_id UUID PRIMARY KEY,
    requested_by_subject_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE application_identity_deletion_jobs IS
    'Resumable cross-database identity deprovisioning work. It has no foreign key because the application principal and identity subject are deliberately removed in separate databases.';
