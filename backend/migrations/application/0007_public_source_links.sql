CREATE TABLE public_source_links (
    position SMALLINT PRIMARY KEY,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    is_origin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT public_source_links_label_check CHECK (char_length(label) BETWEEN 1 AND 80),
    CONSTRAINT public_source_links_url_check CHECK (url ~ '^https?://')
);

CREATE UNIQUE INDEX public_source_links_one_origin
    ON public_source_links (is_origin)
    WHERE is_origin;

INSERT INTO public_source_links (position, label, url, is_origin)
VALUES (
    0,
    'Original project',
    'https://github.com/WickedJack99/wicked_learning',
    TRUE
);
