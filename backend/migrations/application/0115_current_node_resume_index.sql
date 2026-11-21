-- Clean player URLs resolve only the principal's history at one place.
-- Keep that lookup scoped even when their history spans many maps.
CREATE INDEX learner_route_progress_principal_node_idx
    ON learner_route_progress (principal_id, node_id);
