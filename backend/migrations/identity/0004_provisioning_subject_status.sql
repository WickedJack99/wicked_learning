-- Registration must be unable to authenticate until its separate application
-- principal has been provisioned. Keep that temporary state explicit rather
-- than activating identity before the cross-database workflow completes.
ALTER TABLE identity_subjects
    DROP CONSTRAINT identity_subjects_status_check;

ALTER TABLE identity_subjects
    ADD CONSTRAINT identity_subjects_status_check
    CHECK (status IN ('active', 'provisioning', 'suspended', 'disabled'));
