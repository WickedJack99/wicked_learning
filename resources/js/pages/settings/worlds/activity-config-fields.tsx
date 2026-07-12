import { Download, Image, Images, Upload } from 'lucide-react';
import { useState } from 'react';
import { ColorField } from '@/components/color-input';
import InputError from '@/components/input-error';
import { NumberField } from '@/components/number-field';
import { ReusableImagePicker } from '@/components/reusable-image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeMediaUrl } from '@/lib/media-url';

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
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const previewUrl = normalizeMediaUrl(value);

    return (
        <div className="grid min-w-0 gap-2 overflow-hidden rounded-md bg-slate-50 p-3 dark:bg-white/5">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/10 dark:text-teal-200">
                    <Image className="size-4" />
                </span>
                <div className="min-w-0">
                    <Label htmlFor={id}>{label}</Label>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {description}
                    </p>
                </div>
            </div>

            <Input
                className="min-w-0"
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder="/storage/learning/nodes/example.svg"
                value={value}
            />
            <InputError message={error} />

            {previewUrl ? (
                <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-md bg-white p-2 dark:bg-slate-950/70">
                    <img
                        alt=""
                        className="size-12 rounded object-contain"
                        src={previewUrl}
                    />
                    <span className="min-w-0 truncate text-xs text-slate-500 dark:text-slate-400">
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
                <Button
                    onClick={() => setIsPickerOpen(true)}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    <Images className="size-4" />
                    Select existing
                </Button>
                <Button asChild disabled={!value} size="sm" variant="ghost">
                    <a download href={previewUrl || '#'} rel="noreferrer">
                        <Download className="size-4" />
                        Download
                    </a>
                </Button>
            </div>

            {isPickerOpen ? (
                <ReusableImagePicker
                    currentValue={value}
                    onClear={() => {
                        onChange('');
                        setIsPickerOpen(false);
                    }}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(url) => {
                        onChange(normalizeMediaUrl(url));
                        setIsPickerOpen(false);
                    }}
                />
            ) : null}
        </div>
    );
}
