import type { ResolvedAppearance, ThemeVariant } from './types';

export const HEX_TILE_CLIP_PATH =
    'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';

export function normalizeCursorValue(cursor: string): string {
    return cursor.replace(/url\((['"]?)(.*?)\1\)/g, (_match, _quote, url) => {
        if (typeof url !== 'string' || !url.startsWith('/')) {
            return `url(${url})`;
        }

        if (typeof window === 'undefined') {
            return `url(${url})`;
        }

        return `url(${new URL(url, window.location.origin).toString()})`;
    });
}

export function resolveThemeVariant<T extends Record<string, unknown>>(
    config: ThemeVariant<T>,
    appearance: ResolvedAppearance,
): T {
    const { dark, light, ...baseConfig } = config;

    return {
        ...baseConfig,
        ...(appearance === 'light' ? light : dark),
    } as T;
}

export function withOpacity(
    color: string | undefined,
    opacity: unknown,
): string | undefined {
    if (!color) {
        return color;
    }

    const alpha = opacityToAlpha(opacity);

    if (alpha === null) {
        return color;
    }

    const rgb = hexToRgb(color);

    if (!rgb) {
        return color;
    }

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function opacityToAlpha(opacity: unknown): number | null {
    if (opacity === null || opacity === undefined || opacity === '') {
        return null;
    }

    const numericOpacity =
        typeof opacity === 'number' ? opacity : Number.parseFloat(`${opacity}`);

    if (!Number.isFinite(numericOpacity)) {
        return null;
    }

    return Math.min(Math.max(numericOpacity, 0), 100) / 100;
}

function hexToRgb(color: string): { b: number; g: number; r: number } | null {
    const normalized = color.trim();
    const match = /^#([0-9a-fA-F]{6})$/.exec(normalized);

    if (!match) {
        return null;
    }

    const value = match[1];

    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}
