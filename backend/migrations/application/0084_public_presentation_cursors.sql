-- Preserve the source's five cursor roles for existing greenfield settings
-- rows before the Rust presentation model starts serializing this field.
UPDATE public_presentation_settings
SET
    value = jsonb_set(
        value,
        '{cursors}',
        '{
          "default":{"image":"/images/cursors/fantasy-cursor.png","hotspot_x":4,"hotspot_y":4,"size":32,"fallback":"default"},
          "action":{"image":"/images/cursors/fantasy-pointer.png","hotspot_x":12,"hotspot_y":4,"size":32,"fallback":"pointer"},
          "grab":{"image":"/images/cursors/fantasy-grab-backhand.png","hotspot_x":12,"hotspot_y":10,"size":40,"fallback":"grab"},
          "text":{"image":"/images/cursors/fantasy-text-cursor.png","hotspot_x":13,"hotspot_y":30,"size":40,"fallback":"text"},
          "denied":{"image":"/images/cursors/fantasy-denied-cursor.png","hotspot_x":12,"hotspot_y":10,"size":40,"fallback":"not-allowed"}
        }'::jsonb,
        true
    ),
    updated_at = NOW()
WHERE key = 'public_presentation' AND NOT (value ? 'cursors');
