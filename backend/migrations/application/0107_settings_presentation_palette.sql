-- The source stores the Settings palette in the same presentation singleton
-- as its public palette. Earlier Rust rows only projected the public colors,
-- forcing every migrated Settings workspace to use an invented hard-coded
-- theme. Persist the source-shaped final palette in one atomic JSON update.
UPDATE public_presentation_settings
SET
    value = value || jsonb_build_object(
        'settings_palette', jsonb_build_object(
            'dark', jsonb_build_object(
                'accent', '#2dd4bf', 'accent_opacity', 100,
                'accent_foreground', '#042f2e', 'accent_foreground_opacity', 100,
                'active_background', '#2dd4bf', 'active_background_opacity', 10,
                'appearance_switch_background', '#020617', 'appearance_switch_background_opacity', 55,
                'appearance_switch_active_background', '#111820', 'appearance_switch_active_background_opacity', 100,
                'appearance_switch_active_text', '#f8fafc', 'appearance_switch_active_text_opacity', 100,
                'appearance_switch_inactive_text', '#94a3b8', 'appearance_switch_inactive_text_opacity', 100,
                'sidebar_background', '#111820', 'sidebar_background_opacity', 95,
                'content_background', '#0b1117', 'content_background_opacity', 100,
                'input_background', '#020617', 'input_background_opacity', 38,
                'input_border_color', '#ffffff', 'input_border_color_opacity', 42,
                'panel_background', '#111820', 'panel_background_opacity', 100,
                'border_color', '#ffffff', 'border_color_opacity', 10,
                'muted_text', '#94a3b8', 'muted_text_opacity', 100,
                'nested_sidebar_background', '#050816', 'nested_sidebar_background_opacity', 96,
                'scrollbar_thumb', '#94a3b8', 'scrollbar_thumb_opacity', 54
            ),
            'light', jsonb_build_object(
                'accent', '#0f766e', 'accent_opacity', 100,
                'accent_foreground', '#f8fafc', 'accent_foreground_opacity', 100,
                'active_background', '#0f766e', 'active_background_opacity', 10,
                'appearance_switch_background', '#e2e8f0', 'appearance_switch_background_opacity', 80,
                'appearance_switch_active_background', '#ffffff', 'appearance_switch_active_background_opacity', 100,
                'appearance_switch_active_text', '#0f172a', 'appearance_switch_active_text_opacity', 100,
                'appearance_switch_inactive_text', '#64748b', 'appearance_switch_inactive_text_opacity', 100,
                'sidebar_background', '#ffffff', 'sidebar_background_opacity', 90,
                'content_background', '#f1f5f9', 'content_background_opacity', 100,
                'input_background', '#ffffff', 'input_background_opacity', 100,
                'input_border_color', '#cbd5e1', 'input_border_color_opacity', 100,
                'panel_background', '#ffffff', 'panel_background_opacity', 100,
                'border_color', '#e2e8f0', 'border_color_opacity', 100,
                'muted_text', '#64748b', 'muted_text_opacity', 100,
                'nested_sidebar_background', '#f8fafc', 'nested_sidebar_background_opacity', 96,
                'scrollbar_thumb', '#64748b', 'scrollbar_thumb_opacity', 54
            )
        )
    ),
    updated_at = NOW()
WHERE key = 'public_presentation'
  AND NOT (value ? 'settings_palette');
