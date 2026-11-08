-- The reusable source catalog keeps immutable pre-change versions. It is
-- authoring-only metadata, separate from learner evidence snapshots.
CREATE TABLE learning_source_record_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_record_id UUID NOT NULL REFERENCES learning_source_records(id) ON DELETE CASCADE,
    changed_by_principal_id UUID REFERENCES application_principals(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    publisher TEXT,
    published_at DATE,
    rights TEXT,
    anchor TEXT,
    excerpt TEXT,
    concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT learning_source_record_versions_title_length CHECK (char_length(title) BETWEEN 1 AND 160),
    CONSTRAINT learning_source_record_versions_url_length CHECK (char_length(url) BETWEEN 1 AND 2048),
    CONSTRAINT learning_source_record_versions_publisher_length CHECK (publisher IS NULL OR char_length(publisher) <= 160),
    CONSTRAINT learning_source_record_versions_rights_length CHECK (rights IS NULL OR char_length(rights) <= 240),
    CONSTRAINT learning_source_record_versions_anchor_length CHECK (anchor IS NULL OR char_length(anchor) <= 240),
    CONSTRAINT learning_source_record_versions_excerpt_length CHECK (excerpt IS NULL OR char_length(excerpt) <= 800),
    CONSTRAINT learning_source_record_versions_concepts_array_check CHECK (jsonb_typeof(concepts) = 'array')
);

CREATE INDEX learning_source_record_versions_record_created_index
    ON learning_source_record_versions (source_record_id, created_at DESC, id DESC);

COMMENT ON TABLE learning_source_record_versions IS
    'Immutable pre-change snapshots for reusable authoring source records.';
