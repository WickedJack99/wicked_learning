ALTER TABLE access_links
    DROP CONSTRAINT access_links_purpose_check;

ALTER TABLE access_links
    ADD CONSTRAINT access_links_purpose_check
    CHECK (purpose IN ('grant_tool', 'grant_items', 'registration'));

COMMENT ON TABLE access_links IS
    'Hashed opaque links for configured learner grants and invitation registration. Plaintext tokens are returned once only.';
