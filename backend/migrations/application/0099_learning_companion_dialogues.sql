CREATE TABLE learning_companion_dialogues (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    dialogue_graph JSONB NOT NULL,
    created_by_principal_id UUID NULL REFERENCES application_principals(id) ON DELETE SET NULL,
    updated_by_principal_id UUID NULL REFERENCES application_principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX learning_companion_dialogues_name_index
    ON learning_companion_dialogues (name, id);

CREATE TABLE learning_companion_dialogue_assignments (
    id UUID PRIMARY KEY,
    dialogue_id UUID NOT NULL REFERENCES learning_companion_dialogues(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('world', 'map', 'node', 'activity')),
    scope_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_companion_dialogue_assignment_unique UNIQUE (dialogue_id, scope_type, scope_id)
);

CREATE INDEX learning_companion_dialogue_assignments_target_index
    ON learning_companion_dialogue_assignments (scope_type, scope_id);

COMMENT ON TABLE learning_companion_dialogues IS
    'Reusable, bounded authored dialogue graphs for the Learning Companion.';
