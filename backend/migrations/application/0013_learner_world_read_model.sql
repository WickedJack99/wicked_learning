-- The first learner-state schema is deliberately read-model oriented. Writers
-- (bookmarking, activity play, route start and discovery) remain later slices.
-- Every learner-owned row belongs to the application principal, never directly
-- to the identity subject in the separate identity database.
ALTER TABLE learning_maps
    ADD COLUMN access_roles JSONB NOT NULL DEFAULT '["public"]'::jsonb,
    ADD CONSTRAINT learning_maps_access_roles_array_check
        CHECK (jsonb_typeof(access_roles) = 'array');

CREATE TABLE learner_node_bookmarks (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, node_id)
);

CREATE TABLE learner_activity_progress (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, activity_id),
    CONSTRAINT learner_activity_progress_status_check
        CHECK (status IN ('reached', 'completed'))
);

CREATE TABLE learner_route_progress (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES learning_nodes(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES learning_routes(id) ON DELETE CASCADE,
    current_activity_id UUID REFERENCES learning_activities(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    completion_count INTEGER NOT NULL DEFAULT 0,
    last_completed_at TIMESTAMPTZ,
    last_entered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, route_id),
    CONSTRAINT learner_route_progress_status_check
        CHECK (status IN ('in_progress', 'completed')),
    CONSTRAINT learner_route_progress_completion_count_check
        CHECK (completion_count >= 0)
);

CREATE INDEX learner_node_bookmarks_principal_id_idx
    ON learner_node_bookmarks (principal_id, created_at);
CREATE INDEX learner_activity_progress_principal_id_idx
    ON learner_activity_progress (principal_id, updated_at);
CREATE INDEX learner_route_progress_principal_id_idx
    ON learner_route_progress (principal_id, updated_at);
