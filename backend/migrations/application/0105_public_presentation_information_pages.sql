-- Lift the source presentation workspace's ordered information pages into
-- the Rust-owned public presentation row. Existing fixed-page edits become
-- the initial bodies, so this compatibility addition does not discard local
-- deployment content.
UPDATE public_presentation_settings
SET value = jsonb_set(
        value,
        '{information_pages}',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'backgrounds', jsonb_build_object('dark', NULL, 'light', NULL),
                        'body', page.body,
                        'slug', page.slug,
                        'title', page.title
                    )
                    ORDER BY CASE page.slug
                        WHEN 'about' THEN 1
                        WHEN 'imprint' THEN 2
                        WHEN 'data-protection' THEN 3
                        ELSE 4
                    END
                )
                FROM public_pages AS page
                WHERE page.slug IN ('about', 'imprint', 'data-protection')
                  AND page.published_at IS NOT NULL
            ),
            '[]'::jsonb
        ),
        true
    ),
    updated_at = NOW()
WHERE key = 'public_presentation'
  AND NOT (value ? 'information_pages');
