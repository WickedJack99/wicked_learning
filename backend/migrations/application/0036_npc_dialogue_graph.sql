-- NPC dialogue is authored as a graph, not an unstructured activity-config
-- blob. The node graph remains reusable by later authoring/import work while
-- its learner progression is kept separately per opaque route play run.
CREATE TABLE learning_npc_dialogue_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    node_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_npc_dialogue_nodes_type_check
        CHECK (node_type IN ('npc_monologue', 'npc_question', 'answer', 'reflection', 'end')),
    CONSTRAINT learning_npc_dialogue_nodes_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT learning_npc_dialogue_nodes_config_object_check CHECK (jsonb_typeof(node_config) = 'object'),
    CONSTRAINT learning_npc_dialogue_nodes_activity_id_id_unique UNIQUE (activity_id, id)
);

CREATE INDEX learning_npc_dialogue_nodes_activity_order_index
    ON learning_npc_dialogue_nodes (activity_id, sort_order, id);

CREATE TABLE learning_npc_dialogue_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    from_node_id UUID,
    to_node_id UUID NOT NULL,
    from_connector TEXT NOT NULL DEFAULT 'out',
    to_connector TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_npc_dialogue_transitions_connector_not_blank
        CHECK (btrim(from_connector) <> ''),
    CONSTRAINT learning_npc_dialogue_transitions_from_same_activity
        FOREIGN KEY (activity_id, from_node_id)
        REFERENCES learning_npc_dialogue_nodes (activity_id, id)
        ON DELETE CASCADE,
    CONSTRAINT learning_npc_dialogue_transitions_to_same_activity
        FOREIGN KEY (activity_id, to_node_id)
        REFERENCES learning_npc_dialogue_nodes (activity_id, id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX learning_npc_dialogue_transitions_source_connector_unique
    ON learning_npc_dialogue_transitions (activity_id, COALESCE(from_node_id, '00000000-0000-0000-0000-000000000000'::uuid), from_connector);

CREATE INDEX learning_npc_dialogue_transitions_activity_target_index
    ON learning_npc_dialogue_transitions (activity_id, to_node_id);

-- A state row is owned by the active route run and has no browser-selected
-- destination. History is bounded and independently validated on every write.
CREATE TABLE learner_npc_dialogue_states (
    principal_id UUID NOT NULL REFERENCES application_principals(id) ON DELETE CASCADE,
    play_run_id UUID NOT NULL,
    activity_id UUID NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
    current_node_id UUID NOT NULL,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (principal_id, play_run_id, activity_id),
    CONSTRAINT learner_npc_dialogue_states_history_array_check CHECK (jsonb_typeof(history) = 'array'),
    CONSTRAINT learner_npc_dialogue_states_node_same_activity
        FOREIGN KEY (activity_id, current_node_id)
        REFERENCES learning_npc_dialogue_nodes (activity_id, id)
        ON DELETE CASCADE
);

COMMENT ON TABLE learning_npc_dialogue_nodes IS
    'Author-owned source-compatible dialogue graph nodes. Graph layout and editor-only details stay outside learner playback.';
COMMENT ON TABLE learning_npc_dialogue_transitions IS
    'Author-owned source-compatible dialogue graph edges; nullable source is the sole dialogue start edge.';
COMMENT ON TABLE learner_npc_dialogue_states IS
    'Private authenticated learner state for an active opaque route run; it is never supplied as browser authority.';
