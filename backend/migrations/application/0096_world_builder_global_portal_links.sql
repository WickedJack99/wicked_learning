-- Laravel's World Builder has a second portal contract alongside activity
-- travel: a global link connects two nodes and intentionally has no arrival
-- activities. Preserve that nullable pair rather than treating it as a
-- malformed activity portal or a browser-selected learner route.
ALTER TABLE learning_portal_links
    DROP CONSTRAINT learning_portal_links_pkey;

ALTER TABLE learning_portal_links
    ADD COLUMN id UUID;

UPDATE learning_portal_links
    SET id = gen_random_uuid()
    WHERE id IS NULL;

ALTER TABLE learning_portal_links
    ALTER COLUMN id SET NOT NULL,
    ADD CONSTRAINT learning_portal_links_pkey PRIMARY KEY (id),
    ALTER COLUMN source_activity_id DROP NOT NULL,
    ALTER COLUMN target_activity_id DROP NOT NULL,
    ADD CONSTRAINT learning_portal_links_source_activity_unique UNIQUE (source_activity_id),
    ADD CONSTRAINT learning_portal_links_activity_pair_check CHECK (
        (source_activity_id IS NULL) = (target_activity_id IS NULL)
    );

CREATE INDEX learning_portal_links_source_node_target_node_idx
    ON learning_portal_links (source_node_id, target_node_id);
