import type { CSSProperties } from 'react';
import { normalizeMediaUrl } from '@/lib/media-url';
import type { ResolvedAppearance } from '@/theme/appearance';

export type JournalThemeMode = 'dark' | 'light';

export type JournalBackgroundAsset = {
    id: string;
    image: string;
    positionX: number | string;
    positionY: number | string;
    zoom: number | string;
};

export type JournalThemeModeSettings = {
    accent: string;
    accentOpacity: number | string;
    accentText: string;
    accentTextOpacity: number | string;
    backgroundImage: string;
    backgroundPositionX: number | string;
    backgroundPositionY: number | string;
    backgroundOverlay: string;
    backgroundOverlayOpacity: number | string;
    backgroundAssets: JournalBackgroundAsset[];
    backgroundZoom: number | string;
    bodyText: string;
    bodyTextOpacity: number | string;
    buttonBackground: string;
    buttonBackgroundOpacity: number | string;
    buttonBorder: string;
    buttonBorderOpacity: number | string;
    buttonText: string;
    buttonTextOpacity: number | string;
    contentBackground: string;
    contentBackgroundOpacity: number | string;
    headerBackground: string;
    headerBackgroundOpacity: number | string;
    headingText: string;
    headingTextOpacity: number | string;
    inputBackground: string;
    inputBackgroundOpacity: number | string;
    mutedText: string;
    mutedTextOpacity: number | string;
    panelBackground: string;
    panelBackgroundOpacity: number | string;
    panelBorder: string;
    panelBorderOpacity: number | string;
    selectedBackground: string;
    selectedBackgroundOpacity: number | string;
    selectedBorder: string;
    selectedBorderOpacity: number | string;
    selectedText: string;
    selectedTextOpacity: number | string;
    sidebarBackground: string;
    sidebarBackgroundOpacity: number | string;
};

export type JournalThemeSettings = {
    dark: JournalThemeModeSettings;
    light: JournalThemeModeSettings;
};

export const DEFAULT_JOURNAL_THEME: JournalThemeSettings = {
    dark: {
        accent: '#2dd4bf',
        accentOpacity: 100,
        accentText: '#020617',
        accentTextOpacity: 100,
        backgroundImage: '/images/themes/journal-paper-leather-background.png',
        backgroundPositionX: 50,
        backgroundPositionY: 50,
        backgroundOverlay: '#020617',
        backgroundOverlayOpacity: 72,
        backgroundAssets: [],
        backgroundZoom: 100,
        bodyText: '#e2e8f0',
        bodyTextOpacity: 92,
        buttonBackground: '#0f172a',
        buttonBackgroundOpacity: 86,
        buttonBorder: '#ffffff',
        buttonBorderOpacity: 14,
        buttonText: '#f8fafc',
        buttonTextOpacity: 100,
        contentBackground: '#0f172a',
        contentBackgroundOpacity: 40,
        headerBackground: '#0f172a',
        headerBackgroundOpacity: 24,
        headingText: '#f8fafc',
        headingTextOpacity: 100,
        inputBackground: '#020617',
        inputBackgroundOpacity: 72,
        mutedText: '#94a3b8',
        mutedTextOpacity: 100,
        panelBackground: '#0b1117',
        panelBackgroundOpacity: 96,
        panelBorder: '#ffffff',
        panelBorderOpacity: 12,
        selectedBackground: '#134e4a',
        selectedBackgroundOpacity: 36,
        selectedBorder: '#5eead4',
        selectedBorderOpacity: 100,
        selectedText: '#f8fafc',
        selectedTextOpacity: 100,
        sidebarBackground: '#111827',
        sidebarBackgroundOpacity: 64,
    },
    light: {
        accent: '#0891b2',
        accentOpacity: 100,
        accentText: '#ffffff',
        accentTextOpacity: 100,
        backgroundImage: '/images/themes/journal-paper-leather-background.png',
        backgroundPositionX: 50,
        backgroundPositionY: 50,
        backgroundOverlay: '#f8fafc',
        backgroundOverlayOpacity: 68,
        backgroundAssets: [],
        backgroundZoom: 100,
        bodyText: '#334155',
        bodyTextOpacity: 100,
        buttonBackground: '#ffffff',
        buttonBackgroundOpacity: 92,
        buttonBorder: '#0f172a',
        buttonBorderOpacity: 14,
        buttonText: '#0f172a',
        buttonTextOpacity: 100,
        contentBackground: '#ffffff',
        contentBackgroundOpacity: 86,
        headerBackground: '#f8fafc',
        headerBackgroundOpacity: 72,
        headingText: '#0f172a',
        headingTextOpacity: 100,
        inputBackground: '#ffffff',
        inputBackgroundOpacity: 94,
        mutedText: '#64748b',
        mutedTextOpacity: 100,
        panelBackground: '#ffffff',
        panelBackgroundOpacity: 96,
        panelBorder: '#0f172a',
        panelBorderOpacity: 14,
        selectedBackground: '#cffafe',
        selectedBackgroundOpacity: 90,
        selectedBorder: '#0891b2',
        selectedBorderOpacity: 100,
        selectedText: '#0f172a',
        selectedTextOpacity: 100,
        sidebarBackground: '#f1f5f9',
        sidebarBackgroundOpacity: 88,
    },
};

export function journalThemeForMode(
    theme: JournalThemeSettings,
    mode: ResolvedAppearance | JournalThemeMode,
): JournalThemeModeSettings {
    return mode === 'light' ? theme.light : theme.dark;
}

export function journalThemeCssVariables(
    theme: JournalThemeSettings,
    mode: ResolvedAppearance | JournalThemeMode,
): CSSProperties {
    const themeMode = journalThemeForMode(theme, mode);
    const colors = journalThemeColors(themeMode);

    return {
        '--journal-accent': colors.accent,
        '--journal-accent-text': colors.accentText,
        '--journal-background-image': themeUrl(colors.backgroundImage),
        '--journal-background-position': `${normalizedPercentage(themeMode.backgroundPositionX)}% ${normalizedPercentage(themeMode.backgroundPositionY)}%`,
        '--journal-background-zoom': String(
            normalizedZoom(themeMode.backgroundZoom) / 100,
        ),
        '--journal-background-overlay': colors.backgroundOverlay,
        '--journal-body-text': colors.bodyText,
        '--journal-button-background': colors.buttonBackground,
        '--journal-button-border': colors.buttonBorder,
        '--journal-button-text': colors.buttonText,
        '--journal-content-background': colors.contentBackground,
        '--journal-header-background': colors.headerBackground,
        '--journal-heading-text': colors.headingText,
        '--journal-input-background': colors.inputBackground,
        '--journal-muted-text': colors.mutedText,
        '--journal-panel-background': colors.panelBackground,
        '--journal-panel-border': colors.panelBorder,
        '--journal-selected-background': colors.selectedBackground,
        '--journal-selected-border': colors.selectedBorder,
        '--journal-selected-text': colors.selectedText,
        '--journal-sidebar-background': colors.sidebarBackground,
    } as CSSProperties;
}

export function journalThemeColors(mode: JournalThemeModeSettings) {
    return {
        accent: withOpacity(mode.accent, mode.accentOpacity),
        accentText: withOpacity(mode.accentText, mode.accentTextOpacity),
        backgroundImage: mode.backgroundImage,
        backgroundOverlay: withOpacity(
            mode.backgroundOverlay,
            mode.backgroundOverlayOpacity,
        ),
        bodyText: withOpacity(mode.bodyText, mode.bodyTextOpacity),
        buttonBackground: withOpacity(
            mode.buttonBackground,
            mode.buttonBackgroundOpacity,
        ),
        buttonBorder: withOpacity(mode.buttonBorder, mode.buttonBorderOpacity),
        buttonText: withOpacity(mode.buttonText, mode.buttonTextOpacity),
        contentBackground: withOpacity(
            mode.contentBackground,
            mode.contentBackgroundOpacity,
        ),
        headerBackground: withOpacity(
            mode.headerBackground,
            mode.headerBackgroundOpacity,
        ),
        headingText: withOpacity(mode.headingText, mode.headingTextOpacity),
        inputBackground: withOpacity(
            mode.inputBackground,
            mode.inputBackgroundOpacity,
        ),
        mutedText: withOpacity(mode.mutedText, mode.mutedTextOpacity),
        panelBackground: withOpacity(
            mode.panelBackground,
            mode.panelBackgroundOpacity,
        ),
        panelBorder: withOpacity(mode.panelBorder, mode.panelBorderOpacity),
        selectedBackground: withOpacity(
            mode.selectedBackground,
            mode.selectedBackgroundOpacity,
        ),
        selectedBorder: withOpacity(
            mode.selectedBorder,
            mode.selectedBorderOpacity,
        ),
        selectedText: withOpacity(mode.selectedText, mode.selectedTextOpacity),
        sidebarBackground: withOpacity(
            mode.sidebarBackground,
            mode.sidebarBackgroundOpacity,
        ),
    };
}

export function journalThemeBackgroundAssets(
    mode: JournalThemeModeSettings,
): JournalBackgroundAsset[] {
    return mode.backgroundAssets.map((asset, index) => ({
        id: asset.id || `asset-${index}`,
        image: asset.image,
        positionX: normalizedPercentage(asset.positionX),
        positionY: normalizedPercentage(asset.positionY),
        zoom: normalizedZoom(asset.zoom),
    }));
}

function themeUrl(value: string): string | undefined {
    const imageUrl = journalThemeBackgroundUrl(value);

    if (!imageUrl) {
        return undefined;
    }

    return `url("${imageUrl}")`;
}

export function journalThemeBackgroundUrl(value: string): string | undefined {
    const normalized = normalizeMediaUrl(value);

    if (!normalized) {
        return undefined;
    }

    return typeof window === 'undefined'
        ? normalized
        : new URL(normalized, window.location.origin).toString();
}

function normalizedPercentage(value: number | string): number {
    return normalizedNumber(value, 50, 0, 100);
}

function normalizedZoom(value: number | string): number {
    return normalizedNumber(value, 100, 25, 300);
}

function normalizedNumber(
    value: number | string,
    fallback: number,
    minimum: number,
    maximum: number,
): number {
    const parsed = Number.parseFloat(String(value));

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(maximum, Math.max(minimum, parsed));
}

function withOpacity(color: string, opacity: number | string): string {
    const alpha = Number.parseFloat(String(opacity || 100));
    const match = /^#([0-9a-fA-F]{6})$/.exec(color);

    if (!match || !Number.isFinite(alpha)) {
        return color;
    }

    const value = match[1];
    const r = Number.parseInt(value.slice(0, 2), 16);
    const g = Number.parseInt(value.slice(2, 4), 16);
    const b = Number.parseInt(value.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${Math.min(100, Math.max(0, alpha)) / 100})`;
}
