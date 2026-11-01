CREATE TABLE public_pages (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT public_pages_slug_check CHECK (slug ~ '^[a-z0-9-]+$')
);

INSERT INTO public_pages (slug, title, body, published_at)
VALUES (
    'about',
    'About Wicked Learning',
    'Wicked Learning is an experimental environment for exploring learning through curiosity, meaningful activity, understanding and learner choice. It does not use point totals, competitive rankings or streak pressure.\n\nMaps, activities and reflection are intended to help learners orient themselves, explore ideas and choose useful next steps. Learning evidence remains interpretable and private by default.',
    NOW()
);
