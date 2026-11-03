-- The initial explorer migration used placeholder dimensions before the
-- presentation contract existed. These are percentage widths consumed by the
-- original World map component, not viewport pixels.
UPDATE learning_map_assets
SET width = 22
WHERE id IN (
    '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004'
);
