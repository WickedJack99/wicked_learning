ALTER TABLE identity_subjects
    DROP CONSTRAINT identity_subjects_status_check;

ALTER TABLE identity_subjects
    ADD CONSTRAINT identity_subjects_status_check
    CHECK (status IN ('active', 'provisioning', 'suspended', 'disabled', 'deleting'));

COMMENT ON CONSTRAINT identity_subjects_status_check ON identity_subjects IS
    'Only active subjects authenticate. Deleting is the server-owned cross-database deprovisioning state.';
