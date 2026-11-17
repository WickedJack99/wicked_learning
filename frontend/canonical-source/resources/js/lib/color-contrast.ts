import { isHexColor } from '@/components/color-input';
import { parseCssColor } from './css-color';

type Rgb = {
    blue: number;
    green: number;
    red: number;
};

/** Returns the WCAG contrast ratio for two CSS colors, including simple alpha blending. */
export function contrastRatio(
    foreground: string,
    background: string,
    backdrop: string,
): number | null {
    const backdropRgb = parseRgb(backdrop);
    const backgroundRgb = parseRgb(background);
    const foregroundRgb = parseRgb(foreground);

    if (!backdropRgb || !backgroundRgb || !foregroundRgb) {
        return null;
    }

    const compositedBackground = blend(
        backgroundRgb.rgb,
        backdropRgb.rgb,
        backgroundRgb.alpha,
    );
    const compositedForeground = blend(
        foregroundRgb.rgb,
        compositedBackground,
        foregroundRgb.alpha,
    );
    const foregroundLuminance = relativeLuminance(compositedForeground);
    const backgroundLuminance = relativeLuminance(compositedBackground);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);

    return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(value: string): { alpha: number; rgb: Rgb } | null {
    const normalized = value.trim();

    if (!isHexColor(normalized) && !/^rgba?\(/i.test(normalized)) {
        return null;
    }

    const parsed = parseCssColor(normalized);
    const hex = parsed.hex.slice(1);

    if (hex.length !== 6) {
        return null;
    }

    return {
        alpha: Math.min(1, Math.max(0, Number(parsed.opacity) / 100)),
        rgb: {
            blue: Number.parseInt(hex.slice(4, 6), 16),
            green: Number.parseInt(hex.slice(2, 4), 16),
            red: Number.parseInt(hex.slice(0, 2), 16),
        },
    };
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
    return {
        blue: foreground.blue * alpha + background.blue * (1 - alpha),
        green: foreground.green * alpha + background.green * (1 - alpha),
        red: foreground.red * alpha + background.red * (1 - alpha),
    };
}

function relativeLuminance({ blue, green, red }: Rgb): number {
    const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255;

        return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
