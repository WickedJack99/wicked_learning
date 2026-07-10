import { Download, Image, Upload } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ConfigColorField({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');
    const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

    return (
        <div className="grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
                <Input
                    aria-label={`${label} picker`}
                    className="h-9 w-12 cursor-pointer p-1"
                    onChange={(event) => onChange(event.currentTarget.value)}
                    type="color"
                    value={pickerValue}
                />
                <Input
                    id={id}
                    onChange={(event) => onChange(event.currentTarget.value)}
                    value={value}
                />
            </div>
        </div>
    );
}

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

export function ConfigImageInput({
    description,
    error,
    id,
    label,
    onChange,
    onUpload,
    uploading,
    value,
}: {
    description: string;
    error?: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const uploadId = `${id}-upload`;

    return (
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 dark:bg-white/5">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                    <Image className="size-4" />
                </span>
                <div>
                    <Label htmlFor={id}>{label}</Label>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>
            </div>

            <Input
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder="/storage/learning/nodes/example.svg"
                value={value}
            />
            <InputError message={error} />

            {value ? (
                <div className="flex items-center gap-3 rounded-md bg-white p-2 dark:bg-slate-950/70">
                    <img
                        alt=""
                        className="size-12 rounded object-contain"
                        src={value}
                    />
                    <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {value}
                    </span>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="secondary">
                    <label htmlFor={uploadId}>
                        <Upload className="size-4" />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </label>
                </Button>
                <input
                    accept=".gif,.jpg,.jpeg,.png,.svg,.webp,image/gif,image/jpeg,image/png,image/svg+xml,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    id={uploadId}
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];

                        if (file) {
                            onUpload(file);
                        }

                        event.currentTarget.value = '';
                    }}
                    type="file"
                />
                <Button asChild disabled={!value} size="sm" variant="ghost">
                    <a download href={value || '#'} rel="noreferrer">
                        <Download className="size-4" />
                        Download
                    </a>
                </Button>
            </div>
        </div>
    );
}
