import type { CSSProperties } from 'react';
import { resolveThemeVariant } from '@/features/world/theme';
import type { ResolvedAppearance } from '@/features/world/types';
import type { LearningMap } from '@/types';

export type MapMenuTheme = {
    backgroundConfig: LearningMap['backgroundConfig'];
    mapId?: number;
    mapSlug?: string;
};

export type MapControlCssVars = CSSProperties &
    Record<`--map-${string}`, string | undefined> & {
        '--settings-accent'?: string;
        '--settings-accent-foreground'?: string;
    };

export function mapControlCssVariables(
    backgroundConfig: LearningMap['backgroundConfig'] | null | undefined,
    appearance: ResolvedAppearance,
): MapControlCssVars {
    const mapTheme = backgroundConfig
        ? resolveThemeVariant(backgroundConfig, appearance)
        : null;
    const sharedBackground = configuredCssValue(mapTheme?.panelBackground);
    const sharedBorder =
        configuredCssValue(mapTheme?.panelBorderColor) ??
        configuredCssValue(mapTheme?.cardBorderColor) ??
        configuredCssValue(mapTheme?.sidePanelBorderColor);
    const sharedText = configuredCssValue(mapTheme?.panelTextColor);
    const sharedMutedText =
        configuredCssValue(mapTheme?.panelMutedTextColor) ?? sharedText;
    const sharedAccent =
        configuredCssValue(mapTheme?.accentColor) ?? '#2dd4bf';
    const sharedAccentForeground = '#020617';

    return {
        '--map-floating-accent-color': sharedAccent,
        '--map-floating-background': sharedBackground,
        '--map-floating-border-color': sharedBorder,
        '--map-floating-muted-text-color': sharedMutedText,
        '--map-floating-text-color': sharedText,
        '--map-side-control-active-background':
            configuredCssValue(mapTheme?.sideControlActiveBackground) ??
            sharedAccent,
        '--map-side-control-active-icon-color':
            configuredCssValue(mapTheme?.sideControlActiveIconColor) ??
            configuredCssValue(mapTheme?.sideControlActiveTextColor) ??
            sharedAccentForeground,
        '--map-side-control-active-text-color':
            configuredCssValue(mapTheme?.sideControlActiveTextColor) ??
            sharedAccentForeground,
        '--map-side-control-background':
            configuredCssValue(mapTheme?.sideControlBackground) ??
            sharedBackground ??
            'rgba(2, 6, 23, 0.82)',
        '--map-side-control-border-color':
            configuredCssValue(mapTheme?.sideControlBorderColor) ??
            sharedBorder ??
            'rgba(255, 255, 255, 0.12)',
        '--map-side-control-icon-color':
            configuredCssValue(mapTheme?.sideControlIconColor) ??
            configuredCssValue(mapTheme?.sideControlTextColor) ??
            sharedText ??
            'rgb(226 232 240)',
        '--map-side-control-muted-text-color':
            sharedMutedText ?? 'rgb(148 163 184)',
        '--map-side-control-hover-background':
            'color-mix(in srgb, var(--map-side-control-active-background) 16%, transparent)',
        '--map-side-control-panel-background':
            configuredCssValue(mapTheme?.sideControlBackground) ??
            sharedBackground ??
            'rgba(2, 6, 23, 0.9)',
        '--map-side-control-panel-border-color':
            configuredCssValue(mapTheme?.sideControlBorderColor) ??
            sharedBorder ??
            'rgba(255, 255, 255, 0.12)',
        '--map-side-control-text-color':
            configuredCssValue(mapTheme?.sideControlTextColor) ??
            sharedText ??
            'rgb(226 232 240)',
        '--settings-accent': sharedAccent,
        '--settings-accent-foreground': sharedAccentForeground,
    };
}

function configuredCssValue(value: string | undefined): string | undefined {
    const trimmedValue = value?.trim();

    return trimmedValue ? trimmedValue : undefined;
}
