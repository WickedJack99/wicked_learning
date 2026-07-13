import { ColorField } from '@/components/color-input';
import { ConfigImageInput } from '@/components/config-image-input';
import { NumberField } from '@/components/number-field';
import { Checkbox } from '@/components/ui/checkbox';

export { ConfigImageInput };
export { NumberField };

export function ConfigColorField({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return <ColorField label={label} onChange={onChange} value={value} />;
}

export function MirrorImageCheckbox({
    checked,
    description = 'Flip the image horizontally without changing the uploaded file.',
    label = 'Mirror horizontally',
    onChange,
}: {
    checked: boolean;
    description?: string;
    label?: string;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 dark:border-white/10">
            <Checkbox
                checked={checked}
                className="mt-0.5"
                onCheckedChange={(value) => onChange(value === true)}
            />
            <span>
                <span className="block text-sm font-medium text-slate-950 dark:text-white">
                    {label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {description}
                </span>
            </span>
        </label>
    );
}
