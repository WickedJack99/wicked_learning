CREATE TABLE learning_topic_areas (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT learning_topic_areas_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX learning_topic_areas_order_index
    ON learning_topic_areas (sort_order, title);

CREATE TABLE learning_topics (
    id UUID PRIMARY KEY,
    area_id UUID NOT NULL REFERENCES learning_topic_areas(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES learning_topics(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    published_at TIMESTAMPTZ,
    CONSTRAINT learning_topics_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX learning_topics_directory_index
    ON learning_topics (area_id, parent_id, title)
    WHERE published_at IS NOT NULL;

ALTER TABLE learning_maps
    ADD COLUMN topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL;

CREATE INDEX learning_maps_topic_index ON learning_maps (topic_id);

INSERT INTO learning_topic_areas (id, slug, title, description, sort_order)
VALUES (
    '00000000-0000-4000-8000-000000000021',
    'orientation',
    'Orientation',
    'Ideas for noticing a learning map and choosing a next direction.',
    0
);

INSERT INTO learning_topics (id, area_id, slug, title, description, content, published_at)
VALUES (
    '00000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000021',
    'map-orientation',
    'Map orientation',
    'Ways to notice what is available and choose a useful next direction.',
    NULL,
    NOW()
);

UPDATE learning_maps
SET topic_id = '00000000-0000-4000-8000-000000000022'
WHERE id = '00000000-0000-4000-8000-000000000002';
