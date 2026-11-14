import type { CSSProperties } from 'react';

import type { components } from './api/schema';

export type PublicPresentation = components['schemas']['PublicPresentation'];
export type PublicAppearance = 'dark' | 'light';
type PublicPage = 'login' | 'register' | 'welcome';
type PublicPalette = components['schemas']['PublicPalette'];
type PublicCursor = components['schemas']['PublicCursor'];
type SettingsPalette = components['schemas']['SettingsPalette'];

const defaultCursors = {
    action: { fallback: 'pointer', hotspot_x: 12, hotspot_y: 4, image: '/images/cursors/fantasy-pointer.png', size: 32 },
    default: { fallback: 'default', hotspot_x: 4, hotspot_y: 4, image: '/images/cursors/fantasy-cursor.png', size: 32 },
    denied: { fallback: 'not-allowed', hotspot_x: 12, hotspot_y: 10, image: '/images/cursors/fantasy-denied-cursor.png', size: 40 },
    grab: { fallback: 'grab', hotspot_x: 12, hotspot_y: 10, image: '/images/cursors/fantasy-grab-backhand.png', size: 40 },
    text: { fallback: 'text', hotspot_x: 13, hotspot_y: 30, image: '/images/cursors/fantasy-text-cursor.png', size: 40 },
} satisfies Record<keyof components['schemas']['PublicCursors'], PublicCursor>;

const cursorVariables = [
    '--platform-action-cursor',
    '--platform-cursor',
    '--platform-denied-cursor',
    '--platform-grab-cursor',
    '--platform-text-cursor',
] as const;

export type PublicCursorVariables = Record<(typeof cursorVariables)[number], string>;

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
        ...publicCursorStyle(presentation),
    } as CSSProperties;
}

/** Resolves the source Settings palette separately from public-page colors. */
export function settingsPresentationStyle(
    presentation: PublicPresentation,
    appearance: PublicAppearance,
): CSSProperties {
    const palette = presentation.settings_palette[appearance];

    return {
        '--settings-accent': settingsPaletteColor(palette, 'accent'),
        '--settings-accent-foreground': settingsPaletteColor(
            palette,
            'accent_foreground',
        ),
        '--settings-active-background': settingsPaletteColor(
            palette,
            'active_background',
        ),
        '--settings-appearance-switch-active-background': settingsPaletteColor(
            palette,
            'appearance_switch_active_background',
        ),
        '--settings-appearance-switch-active-text': settingsPaletteColor(
            palette,
            'appearance_switch_active_text',
        ),
        '--settings-appearance-switch-background': settingsPaletteColor(
            palette,
            'appearance_switch_background',
        ),
        '--settings-appearance-switch-inactive-text': settingsPaletteColor(
            palette,
            'appearance_switch_inactive_text',
        ),
        '--settings-border-color': settingsPaletteColor(
            palette,
            'border_color',
        ),
        '--settings-content-background': settingsPaletteColor(
            palette,
            'content_background',
        ),
        '--settings-input-background': settingsPaletteColor(
            palette,
            'input_background',
        ),
        '--settings-input-border-color': settingsPaletteColor(
            palette,
            'input_border_color',
        ),
        '--settings-muted-text': settingsPaletteColor(palette, 'muted_text'),
        '--settings-nested-sidebar-background': settingsPaletteColor(
            palette,
            'nested_sidebar_background',
        ),
        '--settings-panel-background': settingsPaletteColor(
            palette,
            'panel_background',
        ),
        '--settings-scrollbar-thumb': settingsPaletteColor(
            palette,
            'scrollbar_thumb',
        ),
        '--settings-sidebar-background': settingsPaletteColor(
            palette,
            'sidebar_background',
        ),
    } as CSSProperties;
}

/** Matches the source cursor resolver, including default-role fallback and
 * SVG sizing around a stored reusable-media URL. */
export function publicCursorStyle(
    presentation: PublicPresentation,
): PublicCursorVariables {
    return {
        '--platform-action-cursor': cursorCss(presentation.cursors.action, defaultCursors.action),
        '--platform-cursor': cursorCss(presentation.cursors.default, defaultCursors.default),
        '--platform-denied-cursor': cursorCss(presentation.cursors.denied, defaultCursors.denied),
        '--platform-grab-cursor': cursorCss(presentation.cursors.grab, defaultCursors.grab),
        '--platform-text-cursor': cursorCss(presentation.cursors.text, defaultCursors.text),
    };
}

export function clearPublicCursorStyle(): void {
    if (typeof document === 'undefined') {
        return;
    }

    for (const variable of cursorVariables) {
        document.documentElement.style.removeProperty(variable);
    }
}

export function applyPublicCursorStyle(presentation: PublicPresentation): void {
    if (typeof document === 'undefined') {
        return;
    }

    for (const [variable, value] of Object.entries(publicCursorStyle(presentation))) {
        document.documentElement.style.setProperty(variable, value);
    }
}

function cursorCss(cursor: PublicCursor | undefined, fallback: PublicCursor): string {
    const image = cursor?.image || fallback.image;
    const fallbackName = cursor?.fallback || fallback.fallback;
    const hotspotX = numericCursorValue(cursor?.hotspot_x, fallback.hotspot_x ?? 0);
    const hotspotY = numericCursorValue(cursor?.hotspot_y, fallback.hotspot_y ?? 0);
    const size = Math.min(128, Math.max(16, Math.round(numericCursorValue(cursor?.size, fallback.size ?? 32))));

    return `url("${sizedCursorAssetUrl(assetUrl(image ?? ''), size)}") ${hotspotX} ${hotspotY}, ${fallbackName}`;
}

function numericCursorValue(value: number | null | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function assetUrl(path: string): string {
    if (typeof window === 'undefined' || !path.startsWith('/')) {
        return path;
    }

    return new URL(path, window.location.origin).toString();
}

function sizedCursorAssetUrl(image: string, size: number): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="${escapeXmlAttribute(image)}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeXmlAttribute(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
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

function settingsPaletteColor(
    palette: SettingsPalette,
    field: Exclude<keyof SettingsPalette, `${string}_opacity`>,
): string {
    return colorWithOpacity(
        palette[field] as string,
        palette[`${field}_opacity` as keyof SettingsPalette] as number,
    );
}

function colorWithOpacity(color: string, opacity: number): string {
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
