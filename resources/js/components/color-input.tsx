import { Check, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
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
    showClear?: boolean;
    value: string;
}) {
    const inputId = id ?? fieldId(label);
    const t = usePlatformTranslation();
    const pickerValue = isHexColor(value) ? value : fallback;
    const [copied, setCopied] = useState(false);
    const [showAvailableColors, setShowAvailableColors] = useState(false);

    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={inputId}>{label}</Label>
            <div
                className={cn(
                    showClear
                        ? 'flex gap-2'
                        : 'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2',
                )}
            >
                <Input
                    aria-label={t('common.color.picker_label', ':label picker', {
                        label,
                    })}
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
    opacityError,
    opacityValue,
}: {
    availableColors?: AvailableColorOption[];
    colorError?: string;
    colorValue: string;
    label: string;
    onColorChange: (value: string) => void;
    onOpacityChange: (value: string) => void;
    opacityError?: string;
    opacityValue: string;
}) {
    const id = fieldId(label);
    const t = usePlatformTranslation();
    const resolvedOpacity = opacityValue || '100';
    const [copied, setCopied] = useState(false);
    const [showAvailableColors, setShowAvailableColors] = useState(false);
    const availableColorOptions = useMemo(
        () => dedupeColorOptions(availableColors),
        [availableColors],
    );

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
                <Input
                    aria-label={t('common.color.picker_label', ':label picker', {
                        label,
                    })}
                    className="h-9 w-12 shrink-0 cursor-pointer p-1"
                    onChange={(event) =>
                        onColorChange(event.currentTarget.value)
                    }
                    type="color"
                    value={isHexColor(colorValue) ? colorValue : '#000000'}
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
