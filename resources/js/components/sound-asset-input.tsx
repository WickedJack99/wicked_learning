import { Download, Music, Search, Upload } from 'lucide-react';
import { useState } from 'react';
import { ReusableSoundPicker } from '@/components/reusable-sound-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LearningSound } from '@/types';

export function SoundAssetInput({
    description,
    id,
    label,
    onChange,
    onSelectSound,
    onUpload,
    uploading,
    value,
}: {
    description: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    onSelectSound?: (sound: LearningSound) => void;
    onUpload: (file: File) => void;
    uploading: boolean;
    value: string;
}) {
    const uploadId = `${id}-upload`;
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    return (
        <div className="grid min-w-0 gap-2 overflow-hidden rounded-lg border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                    <Music className="size-4" />
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
                placeholder="/storage/learning/sounds/example.wav"
                value={value}
            />

            <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" type="button" variant="secondary">
                    <label htmlFor={uploadId}>
                        <Upload className="size-4" />
                        {uploading ? 'Uploading...' : 'Upload'}
                    </label>
                </Button>
                <input
                    accept=".aac,.flac,.m4a,.mp3,.ogg,.wav,.webm,audio/aac,audio/flac,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm"
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
                    <Search className="size-4" />
                    Select existing
                </Button>
                <Button asChild disabled={!value} size="sm" variant="ghost">
                    <a download href={value || '#'} rel="noreferrer">
                        <Download className="size-4" />
                        Download
                    </a>
                </Button>
            </div>

            {isPickerOpen ? (
                <ReusableSoundPicker
                    currentValue={value}
                    onClear={() => {
                        onChange('');
                        setIsPickerOpen(false);
                    }}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(sound) => {
                        onChange(sound.url);
                        onSelectSound?.(sound);
                        setIsPickerOpen(false);
                    }}
                />
            ) : null}
        </div>
    );
}
