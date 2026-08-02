import type { ChangeEvent, ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type OneTimeCodeInputProps = Omit<
    ComponentProps<typeof Input>,
    'autoComplete' | 'inputMode' | 'maxLength' | 'onChange' | 'pattern' | 'type'
> & {
    maxLength?: number;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onValueChange?: (value: string) => void;
};

export function OneTimeCodeInput({
    className,
    maxLength = 6,
    onChange,
    onValueChange,
    value,
    ...props
}: OneTimeCodeInputProps) {
    const displayValue = typeof value === 'string' ? value : '';
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.currentTarget.value
            .replace(/\D/g, '')
            .slice(0, maxLength);

        if (event.currentTarget.value !== nextValue) {
            event.currentTarget.value = nextValue;
        }

        onValueChange?.(nextValue);
        onChange?.(event);
    };

    return (
        <div
            className={cn(
                'relative grid h-14 w-full max-w-[23rem] grid-cols-[repeat(3,minmax(0,1fr))_0.6rem_repeat(3,minmax(0,1fr))] gap-2',
                className,
            )}
        >
            {Array.from({ length: maxLength }, (_, index) => (
                <div
                    aria-hidden="true"
                    className={cn(
                        'flex items-center justify-center rounded-lg border border-input bg-background/40 font-mono text-xl text-foreground shadow-xs transition-colors',
                        index === 3 ? 'col-start-5' : '',
                    )}
                    key={index}
                >
                    {displayValue[index] ?? ''}
                </div>
            ))}
            <Input
                autoComplete="one-time-code"
                className="absolute inset-0 h-full border-0 bg-transparent text-transparent caret-transparent shadow-none transition-none outline-none selection:bg-transparent placeholder:text-transparent focus-visible:border-0 focus-visible:ring-0"
                inputMode="numeric"
                maxLength={maxLength}
                onChange={handleChange}
                pattern="[0-9]*"
                type="text"
                value={value}
                {...props}
            />
        </div>
    );
}
