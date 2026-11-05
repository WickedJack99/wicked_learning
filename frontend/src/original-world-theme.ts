import type { OriginalAppearance } from './original-appearance';

/**
 * Lifted from `resources/js/features/world/theme.ts`. Map and asset
 * configuration can provide a shared base plus an appearance-specific branch.
 */
export function resolveOriginalWorldTheme(
    config: Record<string, unknown>,
    appearance: OriginalAppearance,
): Record<string, unknown> {
    const { dark, light, ...baseConfig } = config;
    const variant = appearance === 'light' ? light : dark;

    return {
        ...baseConfig,
        ...(isConfigRecord(variant) ? variant : {}),
    };
}

function isConfigRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
