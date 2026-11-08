-- Existing activity-portal writers omit the new opaque row ID. Keep them
-- compatible while global links use the same primary key.
ALTER TABLE learning_portal_links
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
