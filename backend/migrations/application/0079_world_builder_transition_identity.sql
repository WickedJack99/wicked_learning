-- Laravel identifies an authored edge by both endpoint activities and both
-- connector handles. The initial greenfield constraint was too narrow: it
-- allowed only one derived trigger per source connector, which rejects valid
-- source graphs that use the same output connector for distinct destinations.
ALTER TABLE learning_activity_transitions
    DROP CONSTRAINT learning_activity_transitions_completed_unique;

ALTER TABLE learning_activity_transitions
    ADD CONSTRAINT learning_activity_transitions_endpoint_connector_unique
    UNIQUE NULLS NOT DISTINCT (
        from_activity_id,
        to_activity_id,
        from_connector,
        to_connector
    );
