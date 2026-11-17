import type { LearningTool } from '@/types';

export type ToolAppearanceMode = 'dark' | 'light';

export function toolImageUrl(
    tool: LearningTool | null,
    mode: ToolAppearanceMode,
): string {
    if (!tool) {
        return '';
    }

    return themedToolAsset(tool.imageDark, tool.imageLight, mode);
}

export function toolAnimationUrl(
    tool: LearningTool | null,
    mode: ToolAppearanceMode,
): string {
    if (!tool) {
        return '';
    }

    return (
        themedToolAsset(tool.animationDark, tool.animationLight, mode) ||
        toolImageUrl(tool, mode)
    );
}

export function toolImageWidthPercent(tool: LearningTool | null): number {
    return clamp(numericToolConfig(tool?.config.imageWidthPercent, 16), 1, 100);
}

export function toolAnimationWidthPercent(tool: LearningTool | null): number {
    return clamp(
        numericToolConfig(
            tool?.config.animationWidthPercent,
            toolImageWidthPercent(tool),
        ),
        1,
        100,
    );
}

export function toolImageWidthStyle(widthPercent: number): string {
    return toolViewportWidthStyle(widthPercent);
}

export function toolAnimationWidthStyle(widthPercent: number): string {
    return toolViewportWidthStyle(widthPercent);
}

function themedToolAsset(
    darkAsset: string | null,
    lightAsset: string | null,
    mode: ToolAppearanceMode,
): string {
    const dark = stringValue(darkAsset);
    const light = stringValue(lightAsset);

    return mode === 'light' ? light || dark : dark || light;
}

function toolViewportWidthStyle(widthPercent: number): string {
    return `clamp(2rem, ${widthPercent}vw, 90vw)`;
}

function numericToolConfig(value: unknown, fallback: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(numeric) ? numeric : fallback;
}

function stringValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
