import type { CSSProperties } from 'react';

import type { components } from './api/schema';

export type PublicPresentation = components['schemas']['PublicPresentation'];
export type PublicAppearance = 'dark' | 'light';
type PublicPage = 'login' | 'register' | 'welcome';
type PublicPalette = components['schemas']['PublicPalette'];

/**
 * These are the source presentation helpers, adapted to the compact public
 * read contract. Keep presentation resolution here rather than duplicating
 * deployment values in individual React pages.
 */
export function publicPresentationStyle(
    presentation: PublicPresentation,
    appearance: PublicAppearance,
    page: PublicPage,
): CSSProperties {
    const authTheme = presentation.auth[page][appearance];
    const palette = presentation.public_palette[appearance];

    return {
        '--auth-background-color': authTheme.background_color,
        '--auth-background-image': authTheme.background_image
            ? `url(${authTheme.background_image})`
            : 'none',
        '--auth-background-overlay': authTheme.background_overlay,
        '--auth-border-line-color': paletteColor(palette, 'control_border'),
        '--auth-button-background': paletteColor(palette, 'accent_text'),
        '--auth-button-text-color': paletteColor(palette, 'control_text'),
        '--auth-description-text-color': paletteColor(palette, 'body_text'),
        '--auth-input-background': authTheme.input_background,
        '--auth-input-border-color': paletteColor(palette, 'control_border'),
        '--auth-label-text-color': paletteColor(palette, 'body_text'),
        '--auth-logo-background': paletteColor(palette, 'accent_text'),
        '--auth-logo-color': paletteColor(palette, 'control_text'),
        '--auth-panel-background': authTheme.panel_background,
        '--auth-title-text-color': paletteColor(palette, 'heading_text'),
        '--public-accent': paletteColor(palette, 'accent_text'),
        '--public-body-text': paletteColor(palette, 'body_text'),
        '--public-control-border': paletteColor(palette, 'control_border'),
        '--public-control-text': paletteColor(palette, 'control_text'),
        '--public-heading-text': paletteColor(palette, 'heading_text'),
        '--public-muted-text': paletteColor(palette, 'muted_text'),
        '--public-welcome-overlay': paletteColor(palette, 'welcome_overlay'),
    } as CSSProperties;
}

export function welcomeBackgroundImage(
    presentation: PublicPresentation,
    appearance: PublicAppearance,
    page: components['schemas']['PublicWelcomePage'],
): string | null {
    return (
        page.backgrounds[appearance] ??
        page.backgrounds.dark ??
        presentation.auth.welcome[appearance].background_image
    );
}

function paletteColor(
    palette: PublicPalette,
    field:
        | 'accent_text'
        | 'body_text'
        | 'control_border'
        | 'control_text'
        | 'heading_text'
        | 'muted_text'
        | 'welcome_overlay',
): string {
    const color = palette[field];
    const opacity = palette[`${field}_opacity`];

    if (opacity >= 100) {
        return color;
    }
    if (opacity <= 0) {
        return 'rgba(0, 0, 0, 0)';
    }

    const hex = color.match(/^#([0-9a-fA-F]{6})$/);
    if (!hex) {
        return color;
    }

    const value = hex[1];
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}
