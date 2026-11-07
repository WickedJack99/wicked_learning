import type { CSSProperties } from 'react';

import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type JournalTheme = components['schemas']['LearnerJournalTheme'];
type JournalThemeMode = components['schemas']['LearnerJournalThemeMode'];

/** Source-adapted from features/journal/theme.ts for the Rust contract's
 * snake_case fields. Learners only render this server-owned presentation. */
export function journalThemeStyle(
    theme: JournalTheme,
    appearance: OriginalAppearance,
): CSSProperties {
    const mode = theme[appearance];

    return {
        '--journal-accent': withOpacity(mode.accent, mode.accent_opacity),
        '--journal-accent-text': withOpacity(
            mode.accent_text,
            mode.accent_text_opacity,
        ),
        '--journal-background-position': `${mode.background_position_x}% ${mode.background_position_y}%`,
        '--journal-background-zoom': String(mode.background_zoom / 100),
        '--journal-background-overlay': withOpacity(
            mode.background_overlay,
            mode.background_overlay_opacity,
        ),
        '--journal-body-text': withOpacity(mode.body_text, mode.body_text_opacity),
        '--journal-button-background': withOpacity(
            mode.button_background,
            mode.button_background_opacity,
        ),
        '--journal-button-border': withOpacity(
            mode.button_border,
            mode.button_border_opacity,
        ),
        '--journal-button-text': withOpacity(
            mode.button_text,
            mode.button_text_opacity,
        ),
        '--journal-content-background': withOpacity(
            mode.content_background,
            mode.content_background_opacity,
        ),
        '--journal-header-background': withOpacity(
            mode.header_background,
            mode.header_background_opacity,
        ),
        '--journal-heading-text': withOpacity(
            mode.heading_text,
            mode.heading_text_opacity,
        ),
        '--journal-input-background': withOpacity(
            mode.input_background,
            mode.input_background_opacity,
        ),
        '--journal-muted-text': withOpacity(
            mode.muted_text,
            mode.muted_text_opacity,
        ),
        '--journal-panel-background': withOpacity(
            mode.panel_background,
            mode.panel_background_opacity,
        ),
        '--journal-panel-border': withOpacity(
            mode.panel_border,
            mode.panel_border_opacity,
        ),
        '--journal-selected-background': withOpacity(
            mode.selected_background,
            mode.selected_background_opacity,
        ),
        '--journal-selected-border': withOpacity(
            mode.selected_border,
            mode.selected_border_opacity,
        ),
        '--journal-selected-text': withOpacity(
            mode.selected_text,
            mode.selected_text_opacity,
        ),
        '--journal-sidebar-background': withOpacity(
            mode.sidebar_background,
            mode.sidebar_background_opacity,
        ),
    } as CSSProperties;
}

export function journalThemeMode(
    theme: JournalTheme,
    appearance: OriginalAppearance,
): JournalThemeMode {
    return theme[appearance];
}

export function journalThemeImageUrl(value: string): string | undefined {
    if (!value || !/^\/(?!\/)/.test(value)) {
        return undefined;
    }

    return new URL(value, window.location.origin).toString();
}

function withOpacity(color: string, opacity: number): string {
    const match = /^#([0-9a-fA-F]{6})$/.exec(color);
    if (!match) return color;

    const value = match[1];
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${Math.min(100, Math.max(0, opacity)) / 100})`;
}
