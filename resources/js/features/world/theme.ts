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
