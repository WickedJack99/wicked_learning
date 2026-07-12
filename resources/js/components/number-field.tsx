import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NumberField({
    label,
    max,
    min,
    onChange,
    step,
    suffix,
    value,
}: {
    label: string;
    max?: string;
    min?: string;
    onChange: (value: string) => void;
    step?: string;
    suffix?: string;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                <Input
                    id={id}
                    max={max}
                    min={min}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    step={step}
                    type="number"
                    value={value}
                />
                {suffix ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {suffix}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
