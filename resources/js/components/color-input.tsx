import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function ColorField({
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
    const pickerValue = isHexColor(value) ? value : fallback;

    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={inputId}>{label}</Label>
            <div
                className={cn(
                    showClear
                        ? 'flex gap-2'
                        : 'grid grid-cols-[auto_1fr] gap-2',
                )}
            >
                <Input
                    aria-label={`${label} picker`}
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
                {showClear ? (
                    <Button
                        onClick={() => onChange('')}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        Clear
                    </Button>
                ) : null}
            </div>
            <InputError message={error} />
        </div>
    );
}

export function ColorOpacityField({
    colorError,
    colorValue,
    label,
    onColorChange,
    onOpacityChange,
    opacityError,
    opacityValue,
}: {
    colorError?: string;
    colorValue: string;
    label: string;
    onColorChange: (value: string) => void;
    onOpacityChange: (value: string) => void;
    opacityError?: string;
    opacityValue: string;
}) {
    const id = fieldId(label);
    const resolvedOpacity = opacityValue || '100';

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2">
                <Input
                    aria-label={`${label} picker`}
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
            </div>
            <div className="grid gap-2">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
                    <Label
                        className="text-[0.68rem] font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400"
                        htmlFor={`${id}-opacity`}
                    >
                        Opacity %
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
                    aria-label={`${label} opacity slider`}
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

export function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function fieldId(label: string): string {
    return label.toLowerCase().replaceAll(' ', '-');
}
