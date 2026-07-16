import { isHexColor } from '@/components/color-input';

export type ParsedCssColor = {
    hex: string;
    opacity: string;
};

export function parseCssColor(value: string): ParsedCssColor {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return { hex: '#000000', opacity: '100' };
    }

    if (isHexColor(trimmedValue)) {
        return { hex: trimmedValue, opacity: '100' };
    }

    const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(trimmedValue);

    if (!rgbaMatch) {
        return { hex: '#000000', opacity: '100' };
    }

    const parts = rgbaMatch[1].split(',').map((part) => part.trim());
    const red = Number.parseInt(parts[0] ?? '', 10);
    const green = Number.parseInt(parts[1] ?? '', 10);
    const blue = Number.parseInt(parts[2] ?? '', 10);
    const alpha = parts[3] === undefined ? 1 : Number.parseFloat(parts[3]);

    if (
        [red, green, blue, alpha].some(
            (valuePart) => !Number.isFinite(valuePart),
        )
    ) {
        return { hex: '#000000', opacity: '100' };
    }

    return {
        hex: rgbToHex(red, green, blue),
        opacity: Math.round(Math.min(1, Math.max(0, alpha)) * 100).toString(),
    };
}

export function cssColorFromPicker(hexColor: string, opacity: string): string {
    const normalizedHex = isHexColor(hexColor) ? hexColor : '#000000';
    const numericOpacity = Math.min(
        100,
        Math.max(0, Number.parseFloat(opacity || '100')),
    );

    if (!Number.isFinite(numericOpacity) || numericOpacity >= 100) {
        return normalizedHex;
    }

    const red = Number.parseInt(normalizedHex.slice(1, 3), 16);
    const green = Number.parseInt(normalizedHex.slice(3, 5), 16);
    const blue = Number.parseInt(normalizedHex.slice(5, 7), 16);

    return `rgba(${red}, ${green}, ${blue}, ${(numericOpacity / 100).toFixed(2)})`;
}

function rgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
        .map((part) =>
            Math.min(255, Math.max(0, part)).toString(16).padStart(2, '0'),
        )
        .join('')}`;
}
