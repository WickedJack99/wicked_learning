import { Check, Copy, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type AvailableColorOption = {
    label: string;
    opacity?: number | string;
    value: string;
};

export function ColorField({
    availableColors = [],
    className,
    error,
    fallback = '#000000',
    id,
    inputClassName,
    label,
    onChange,
    pickerClassName,
    placeholder,
    resetValue,
    showClear = false,
    value,
}: {
    availableColors?: AvailableColorOption[];
    className?: string;
    error?: string;
    fallback?: string;
    id?: string;
    inputClassName?: string;
    label: string;
    onChange: (value: string) => void;
    pickerClassName?: string;
    placeholder?: string;
    resetValue?: string;
    showClear?: boolean;
    value: string;
}) {
    const inputId = id ?? fieldId(label);
    const t = usePlatformTranslation();
    const { pickerValue, scopeRef } = useResolvedPickerColor(value, fallback);
    const [copied, setCopied] = useState(false);
    const [showAvailableColors, setShowAvailableColors] = useState(false);
    const canReset = resetValue !== undefined && value !== resetValue;

    return (
        <div className={cn('grid gap-2', className)} ref={scopeRef}>
            <Label htmlFor={inputId}>{label}</Label>
            <div
                className={cn(
                    showClear
                        ? 'flex gap-2'
                        : cn(
                              'grid gap-2',
                              canReset
                                  ? 'grid-cols-[auto_minmax(0,1fr)_auto_auto]'
                                  : 'grid-cols-[auto_minmax(0,1fr)_auto]',
                          ),
                )}
            >
                <Input
                    aria-label={t(
                        'common.color.picker_label',
                        ':label picker',
                        {
                            label,
                        },
                    )}
                    className={cn(
                        'h-9 w-12 shrink-0 cursor-pointer p-1',
                        pickerClassName,
                    )}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    type="color"
                    value={pickerValue}
                />
                <Input
                    className={inputClassName}
                    id={inputId}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    placeholder={placeholder ?? fallback}
                    value={value}
                />
                <button
                    aria-label={t(
                        'common.color.copy_label',
                        'Copy :label color',
                        { label },
                    )}
                    className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() =>
                        copyToClipboard(value, () => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1200);
                        })
                    }
                    type="button"
                >
                    {copied ? (
                        <Check className="size-4" />
                    ) : (
                        <Copy className="size-4" />
                    )}
                </button>
                {canReset ? (
                    <button
                        aria-label={t(
                            'common.color.reset_label',
                            'Reset :label to last saved value',
                            { label },
                        )}
                        className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={() => onChange(resetValue)}
                        title={t(
                            'common.color.reset_label',
                            'Reset :label to last saved value',
                            { label },
                        )}
                        type="button"
                    >
                        <RotateCcw className="size-4" />
                    </button>
                ) : null}
                {showClear ? (
                    <Button
                        onClick={() => onChange('')}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        {t('common.clear', 'Clear')}
                    </Button>
                ) : null}
            </div>
            {availableColors.length > 0 ? (
                <AvailableColorSelector
                    colors={availableColors}
                    isOpen={showAvailableColors}
                    onOpenChange={setShowAvailableColors}
                    onSelect={(color) => onChange(color.value)}
                />
            ) : null}
            <InputError message={error} />
        </div>
    );
}

export function ColorOpacityField({
    availableColors = [],
    colorError,
    colorValue,
    label,
    onColorChange,
    onOpacityChange,
    onReset,
    opacityError,
    opacityValue,
    resetColorValue,
    resetOpacityValue,
}: {
    availableColors?: AvailableColorOption[];
    colorError?: string;
    colorValue: string;
    label: string;
    onColorChange: (value: string) => void;
    onOpacityChange: (value: string) => void;
    onReset?: () => void;
    opacityError?: string;
    opacityValue: string;
    resetColorValue?: string;
    resetOpacityValue?: string;
}) {
    const id = fieldId(label);
    const t = usePlatformTranslation();
    const resolvedOpacity = opacityValue || '100';
    const resolvedResetOpacity = resetOpacityValue || '100';
    const { pickerValue, scopeRef } = useResolvedPickerColor(
        colorValue,
        '#000000',
    );
    const [copied, setCopied] = useState(false);
    const [showAvailableColors, setShowAvailableColors] = useState(false);
    const availableColorOptions = useMemo(
        () => dedupeColorOptions(availableColors),
        [availableColors],
    );
    const canReset =
        onReset !== undefined ||
        (resetColorValue !== undefined &&
            (colorValue !== resetColorValue ||
                resolvedOpacity !== resolvedResetOpacity));
    const reset = () => {
        if (onReset) {
            onReset();

            return;
        }

        if (resetColorValue !== undefined) {
            onColorChange(resetColorValue);
            onOpacityChange(resolvedResetOpacity);
        }
    };

    return (
        <div className="grid gap-2" ref={scopeRef}>
            <Label htmlFor={id}>{label}</Label>
            <div
                className={cn(
                    'grid min-w-0 gap-2',
                    canReset
                        ? 'grid-cols-[auto_minmax(0,1fr)_auto_auto]'
                        : 'grid-cols-[auto_minmax(0,1fr)_auto]',
                )}
            >
                <Input
                    aria-label={t(
                        'common.color.picker_label',
                        ':label picker',
                        {
                            label,
                        },
                    )}
                    className="h-9 w-12 shrink-0 cursor-pointer p-1"
                    onChange={(event) =>
                        onColorChange(event.currentTarget.value)
                    }
                    type="color"
                    value={pickerValue}
                />
                <Input
                    id={id}
                    onChange={(event) =>
                        onColorChange(event.currentTarget.value)
                    }
                    value={colorValue}
                />
                <button
                    aria-label={t(
                        'common.color.copy_label',
                        'Copy :label color',
                        { label },
                    )}
                    className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() =>
                        copyToClipboard(colorValue, () => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1200);
                        })
                    }
                    type="button"
                >
                    {copied ? (
                        <Check className="size-4" />
                    ) : (
                        <Copy className="size-4" />
                    )}
                </button>
                {canReset ? (
                    <button
                        aria-label={t(
                            'common.color.reset_label',
                            'Reset :label to last saved value',
                            { label },
                        )}
                        className="grid size-9 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={reset}
                        title={t(
                            'common.color.reset_label',
                            'Reset :label to last saved value',
                            { label },
                        )}
                        type="button"
                    >
                        <RotateCcw className="size-4" />
                    </button>
                ) : null}
            </div>
            {availableColorOptions.length > 0 ? (
                <AvailableColorSelector
                    colors={availableColorOptions}
                    isOpen={showAvailableColors}
                    onOpenChange={setShowAvailableColors}
                    onSelect={(color) => {
                        onColorChange(color.value);

                        if (color.opacity !== undefined) {
                            onOpacityChange(String(color.opacity));
                        }
                    }}
                />
            ) : null}
            <div className="grid gap-2">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
                    <Label
                        className="text-[0.68rem] font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        htmlFor={`${id}-opacity`}
                    >
                        {t('common.color.opacity_percent', 'Opacity %')}
                    </Label>
                    <Input
                        id={`${id}-opacity`}
                        max="100"
                        min="0"
                        onChange={(event) =>
                            onOpacityChange(event.currentTarget.value)
                        }
                        type="number"
                        value={resolvedOpacity}
                    />
                </div>
                <Input
                    aria-label={t(
                        'common.color.opacity_slider_label',
                        ':label opacity slider',
                        { label },
                    )}
                    max="100"
                    min="0"
                    onChange={(event) =>
                        onOpacityChange(event.currentTarget.value)
                    }
                    type="range"
                    value={resolvedOpacity}
                />
            </div>
            <InputError message={colorError || opacityError} />
        </div>
    );
}

function AvailableColorSelector({
    colors,
    isOpen,
    onOpenChange,
    onSelect,
}: {
    colors: AvailableColorOption[];
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSelect: (color: AvailableColorOption) => void;
}) {
    const t = usePlatformTranslation();

    return (
        <div className="grid gap-2">
            <Button
                className="w-fit"
                onClick={() => onOpenChange(!isOpen)}
                size="sm"
                type="button"
                variant="secondary"
            >
                {t(
                    'common.color.copy_from_available',
                    'Copy color from available',
                )}
            </Button>
            {isOpen ? (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-950">
                    {colors.map((color) => (
                        <button
                            className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none dark:hover:bg-white/10"
                            key={`${color.label}-${color.value}-${color.opacity ?? 'solid'}`}
                            onClick={() => {
                                onSelect(color);
                                onOpenChange(false);
                            }}
                            type="button"
                        >
                            <span
                                className="size-5 rounded border border-slate-200 shadow-inner dark:border-white/10"
                                style={{
                                    background: colorPreviewValue(color),
                                }}
                            />
                            <span className="truncate text-slate-700 dark:text-slate-200">
                                {color.label}
                            </span>
                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                {color.value}
                                {color.opacity !== undefined
                                    ? ` / ${color.opacity}%`
                                    : ''}
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function useResolvedPickerColor(value: string, fallback: string) {
    const scopeRef = useRef<HTMLDivElement>(null);
    const [pickerValue, setPickerValue] = useState(() =>
        resolveCssColorToPickerValue(value, fallback),
    );

    useEffect(() => {
        setPickerValue(
            resolveCssColorToPickerValue(value, fallback, scopeRef.current),
        );
    }, [fallback, value]);

    return { pickerValue, scopeRef };
}

function resolveCssColorToPickerValue(
    value: string,
    fallback: string,
    scope?: HTMLElement | null,
): string {
    const fallbackHex =
        normalizeHexColor(fallback) ?? parseRgbColor(fallback) ?? '#000000';
    const normalizedHex = normalizeHexColor(value);

    if (normalizedHex) {
        return normalizedHex;
    }

    const parsedRgb = parseRgbColor(value);

    if (parsedRgb) {
        return parsedRgb;
    }

    if (typeof document === 'undefined') {
        return fallbackHex;
    }

    const resolvedValue = resolveColorInBrowser(value, scope);

    return (
        normalizeHexColor(resolvedValue) ??
        parseRgbColor(resolvedValue) ??
        parseColorFunction(resolvedValue) ??
        fallbackHex
    );
}

function normalizeHexColor(value: string): string | null {
    const trimmedValue = value.trim();
    const shortHexMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmedValue);

    if (shortHexMatch) {
        return `#${shortHexMatch[1]
            .split('')
            .map((part) => `${part}${part}`)
            .join('')}`.toLowerCase();
    }

    const fullHexMatch = /^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(
        trimmedValue,
    );

    if (fullHexMatch) {
        return `#${fullHexMatch[1]}`.toLowerCase();
    }

    return null;
}

function resolveColorInBrowser(
    value: string,
    scope?: HTMLElement | null,
): string {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return '';
    }

    const host = scope ?? document.body ?? document.documentElement;
    const probe = document.createElement('span');

    probe.style.color = trimmedValue;

    if (!probe.style.color && !trimmedValue.includes('var(')) {
        return '';
    }

    probe.style.position = 'absolute';
    probe.style.pointerEvents = 'none';
    probe.style.visibility = 'hidden';
    probe.style.inset = '0';
    probe.textContent = 'color';
    host.appendChild(probe);

    const resolvedColor = window.getComputedStyle(probe).color;

    probe.remove();

    return resolvedColor;
}

function parseRgbColor(value: string): string | null {
    const match = /^rgba?\(([^)]+)\)$/i.exec(value.trim());

    if (!match) {
        return null;
    }

    const colorParts = match[1]
        .replace(/\s*\/\s*/, ' ')
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map(parseCssRgbChannel);

    if (colorParts.length < 3 || colorParts.some((part) => part === null)) {
        return null;
    }

    const [red, green, blue] = colorParts;

    if (red === null || green === null || blue === null) {
        return null;
    }

    return rgbToHex(red, green, blue);
}

function parseColorFunction(value: string): string | null {
    const match = /^color\(\s*srgb\s+([^)]+)\)$/i.exec(value.trim());

    if (!match) {
        return null;
    }

    const colorParts = match[1]
        .replace(/\s*\/\s*/, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((part) => Number.parseFloat(part));

    if (
        colorParts.length < 3 ||
        colorParts.some((part) => !Number.isFinite(part))
    ) {
        return null;
    }

    return rgbToHex(
        Math.round(colorParts[0] * 255),
        Math.round(colorParts[1] * 255),
        Math.round(colorParts[2] * 255),
    );
}

function parseCssRgbChannel(value: string): number | null {
    if (value.endsWith('%')) {
        const percent = Number.parseFloat(value);

        if (!Number.isFinite(percent)) {
            return null;
        }

        return Math.round((Math.min(100, Math.max(0, percent)) / 100) * 255);
    }

    const channel = Number.parseFloat(value);

    if (!Number.isFinite(channel)) {
        return null;
    }

    return Math.round(channel);
}

function colorPreviewValue(color: AvailableColorOption): string {
    if (color.opacity === undefined) {
        return color.value;
    }

    const opacity = Number(color.opacity);

    if (!Number.isFinite(opacity) || opacity >= 100) {
        return color.value;
    }

    const hex = isHexColor(color.value) ? color.value : null;

    if (!hex) {
        return color.value;
    }

    const alpha = Math.min(Math.max(opacity, 0), 100) / 100;
    const bigint = Number.parseInt(hex.slice(1), 16);
    const red = (bigint >> 16) & 255;
    const green = (bigint >> 8) & 255;
    const blue = bigint & 255;

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function rgbToHex(red: number, green: number, blue: number): string {
    return `#${[red, green, blue]
        .map((part) =>
            Math.min(255, Math.max(0, part)).toString(16).padStart(2, '0'),
        )
        .join('')}`;
}

function copyToClipboard(value: string, onCopied: () => void): void {
    if (!value) {
        return;
    }

    if (navigator.clipboard) {
        void navigator.clipboard.writeText(value).then(onCopied);

        return;
    }

    onCopied();
}

function dedupeColorOptions(
    colors: AvailableColorOption[],
): AvailableColorOption[] {
    const seen = new Set<string>();

    return colors.filter((color) => {
        const key = `${color.value}-${color.opacity ?? ''}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);

        return true;
    });
}

function fieldId(label: string): string {
    return label.toLowerCase().replaceAll(' ', '-');
}
