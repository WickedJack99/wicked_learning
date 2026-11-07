-- Laravel identifies an authored edge by both endpoint activities and both
-- connector handles. The initial greenfield constraint was too narrow: it
-- allowed only one derived trigger per source connector, which rejects valid
-- source graphs that use the same output connector for distinct destinations.
ALTER TABLE learning_activity_transitions
    DROP CONSTRAINT learning_activity_transitions_completed_unique;

-- Earlier greenfield seed revisions could contain duplicate endpoint/connector
-- edges because their narrower key used a derived trigger instead. Keep the
-- earliest authored row so this structural correction is safe on an existing
-- local development database as well as a fresh installation.
DELETE FROM learning_activity_transitions
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY from_activity_id, to_activity_id, from_connector, to_connector
            ORDER BY created_at ASC, id ASC
        ) AS duplicate_rank
        FROM learning_activity_transitions
    ) AS ranked
    WHERE duplicate_rank > 1
);

ALTER TABLE learning_activity_transitions
    ADD CONSTRAINT learning_activity_transitions_endpoint_connector_unique
    UNIQUE NULLS NOT DISTINCT (
        from_activity_id,
        to_activity_id,
        from_connector,
        to_connector
    );
