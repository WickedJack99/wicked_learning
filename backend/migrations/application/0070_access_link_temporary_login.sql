ALTER TABLE access_links
    DROP CONSTRAINT access_links_purpose_check;

ALTER TABLE access_links
    ADD CONSTRAINT access_links_purpose_check
    CHECK (purpose IN ('grant_tool', 'grant_items', 'registration', 'temporary_login'));

INSERT INTO application_roles (role_key)
VALUES ('temporary')
ON CONFLICT (role_key) DO NOTHING;

COMMENT ON TABLE application_principal_roles IS
    'Fresh application authorization assignments. The temporary role marks an access-link session that has no user-known password.';
