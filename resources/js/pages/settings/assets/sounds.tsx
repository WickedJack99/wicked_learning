import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Bell,
    LoaderCircle,
    MessageCircle,
    Music,
    Pause,
    Play,
    Plus,
    Radio,
    Search,
    Square,
    Trash2,
    Wand,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { SoundAssetInput } from '@/components/sound-asset-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLayeredSoundPlayer } from '@/features/sounds/sound-player';
import { uploadMediaFile } from '@/lib/media-upload';
import { cn } from '@/lib/utils';
import type { LearningSound } from '@/types';

type SoundForm = {
    icon: string;
    loop: boolean;
    name: string;
    playSeconds: string;
    slug: string;
    url: string;
    volume: string;
};

const soundIcons = {
    ambience: Radio,
    music: Music,
    sfx: Wand,
    ui: Bell,
    voice: MessageCircle,
};

const iconOptions = [
    { label: 'Ambience', value: 'ambience' },
    { label: 'Music', value: 'music' },
    { label: 'Sound effect', value: 'sfx' },
    { label: 'UI', value: 'ui' },
    { label: 'Voice', value: 'voice' },
];

export default function AdminSoundsPage({
    sounds,
}: {
    sounds: LearningSound[];
}) {
    const querySelectedSoundId = readSelectedSoundId();
    const [selectedSoundId, setSelectedSoundId] = useState<number | 'new'>(
        () => querySelectedSoundId ?? sounds[0]?.id ?? 'new',
    );
    const selectedSound =
        selectedSoundId === 'new'
            ? null
            : (sounds.find((sound) => sound.id === selectedSoundId) ?? null);
    const [form, setForm] = useState<SoundForm>(() =>
        formFromSound(selectedSound),
    );
    const [search, setSearch] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const player = useLayeredSoundPlayer();
    const filteredSounds = useMemo(() => {
        const needle = search.trim().toLowerCase();

        if (!needle) {
            return sounds;
        }

        return sounds.filter((sound) =>
            [sound.name, sound.slug, sound.icon, sound.url]
                .join(' ')
                .toLowerCase()
                .includes(needle),
        );
    }, [search, sounds]);

    const selectSound = (sound: LearningSound) => {
        setSelectedSoundId(sound.id);
        setForm(formFromSound(sound));
    };
    const startCreate = () => {
        setSelectedSoundId('new');
        setForm(formFromSound(null));
    };
    const saveSound = () => {
        const payload = soundPayload(form);

        if (selectedSound) {
            router.patch(
                `/settings/assets/sounds/${selectedSound.id}`,
                payload,
                {
                    preserveScroll: true,
                },
            );

            return;
        }

        router.post('/settings/assets/sounds', payload, {
            preserveScroll: true,
        });
    };
    const deleteSound = () => {
        if (!selectedSound) {
            return;
        }

        if (!window.confirm(`Delete ${selectedSound.name}?`)) {
            return;
        }

        player.stopAll();
        router.delete(`/settings/assets/sounds/${selectedSound.id}`, {
            preserveScroll: true,
        });
    };
    const uploadSound = async (file: File) => {
        setIsUploading(true);

        try {
            const payload = await uploadMediaFile({
                endpoint: '/settings/assets/sound-media',
                file,
            });

            setForm((current) => ({ ...current, url: payload.url ?? '' }));
        } finally {
            setIsUploading(false);
        }
    };
    const soundPreview = playableSoundFromForm(
        form,
        selectedSound?.id ?? 'draft',
    );

    return (
        <>
            <Head title="Edit sounds" />
            <main className="h-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100">
                <div className="mx-auto flex h-full max-w-[92rem] flex-col px-4 pt-6 pb-24">
                    <header className="shrink-0 pb-5">
                        <Button asChild className="mb-4" variant="ghost">
                            <Link href="/settings">
                                <ArrowLeft className="size-4" />
                                Settings
                            </Link>
                        </Button>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            Sounds
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Reusable sound library
                        </h1>
                    </header>

                    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                                        {selectedSound
                                            ? selectedSound.name
                                            : 'Create sound'}
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        Configure the default playback behavior.
                                        Individual activities can later override
                                        these defaults per use.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        disabled={!form.url}
                                        onClick={() =>
                                            player.play(
                                                soundPreview,
                                                'sound-editor-preview',
                                            )
                                        }
                                        type="button"
                                        variant="secondary"
                                    >
                                        <Play className="size-4" />
                                        Play
                                    </Button>
                                    <Button
                                        disabled={!form.url}
                                        onClick={() =>
                                            player.pause('sound-editor-preview')
                                        }
                                        type="button"
                                        variant="secondary"
                                    >
                                        <Pause className="size-4" />
                                        Pause
                                    </Button>
                                    <Button
                                        disabled={!form.url}
                                        onClick={() =>
                                            player.stop('sound-editor-preview')
                                        }
                                        type="button"
                                        variant="secondary"
                                    >
                                        <Square className="size-4" />
                                        Stop
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <TextField
                                        label="Name"
                                        onChange={(name) =>
                                            setForm((current) => ({
                                                ...current,
                                                name,
                                            }))
                                        }
                                        value={form.name}
                                    />
                                    <TextField
                                        label="Slug"
                                        onChange={(slug) =>
                                            setForm((current) => ({
                                                ...current,
                                                slug,
                                            }))
                                        }
                                        placeholder="Generated from name if empty"
                                        value={form.slug}
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-1">
                                        <Label htmlFor="sound-icon">Icon</Label>
                                        <select
                                            className="h-10 rounded-md border border-input bg-white px-3 text-sm text-slate-950 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-slate-950 dark:text-slate-100"
                                            id="sound-icon"
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    icon: event.currentTarget
                                                        .value,
                                                }))
                                            }
                                            value={form.icon}
                                        >
                                            {iconOptions.map((option) => (
                                                <option
                                                    className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100"
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid gap-1">
                                        <Label htmlFor="sound-volume">
                                            Volume
                                        </Label>
                                        <div className="grid grid-cols-[1fr_4rem] gap-2">
                                            <Input
                                                id="sound-volume"
                                                max="100"
                                                min="0"
                                                onChange={(event) =>
                                                    setForm((current) => ({
                                                        ...current,
                                                        volume: event
                                                            .currentTarget
                                                            .value,
                                                    }))
                                                }
                                                type="range"
                                                value={form.volume}
                                            />
                                            <Input
                                                aria-label="Volume percent"
                                                max="100"
                                                min="0"
                                                onChange={(event) =>
                                                    setForm((current) => ({
                                                        ...current,
                                                        volume: event
                                                            .currentTarget
                                                            .value,
                                                    }))
                                                }
                                                type="number"
                                                value={form.volume}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <TextField
                                        label="Play first seconds"
                                        onChange={(playSeconds) =>
                                            setForm((current) => ({
                                                ...current,
                                                playSeconds,
                                            }))
                                        }
                                        placeholder="Leave empty to play full file"
                                        type="number"
                                        value={form.playSeconds}
                                    />
                                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
                                        <input
                                            checked={form.loop}
                                            className="size-4"
                                            id="sound-loop"
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    loop: event.currentTarget
                                                        .checked,
                                                }))
                                            }
                                            type="checkbox"
                                        />
                                        <div>
                                            <Label htmlFor="sound-loop">
                                                Loop playback
                                            </Label>
                                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                Useful for background music or
                                                ambience layers.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <SoundAssetInput
                                    description="Upload a sound file or choose an existing sound from the reusable library."
                                    id="sound-url"
                                    label="Sound file"
                                    onChange={(url) =>
                                        setForm((current) => ({
                                            ...current,
                                            url,
                                        }))
                                    }
                                    onSelectSound={(sound) =>
                                        setForm((current) => ({
                                            ...current,
                                            icon: sound.icon,
                                            loop: sound.loop,
                                            playSeconds:
                                                sound.playSeconds?.toString() ??
                                                current.playSeconds,
                                            volume: sound.volume.toString(),
                                        }))
                                    }
                                    onUpload={uploadSound}
                                    uploading={isUploading}
                                    value={form.url}
                                />

                                <div className="flex flex-wrap justify-end gap-2">
                                    {selectedSound ? (
                                        <Button
                                            onClick={deleteSound}
                                            type="button"
                                            variant="destructive"
                                        >
                                            <Trash2 className="size-4" />
                                            Delete
                                        </Button>
                                    ) : null}
                                    <Button onClick={saveSound} type="button">
                                        {isUploading ? (
                                            <LoaderCircle className="size-4 animate-spin" />
                                        ) : (
                                            <Plus className="size-4" />
                                        )}
                                        {selectedSound ? 'Save' : 'Create'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                            <div className="shrink-0 border-b border-slate-200 p-3 dark:border-white/10">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                                    <Input
                                        className="pl-9"
                                        onChange={(event) =>
                                            setSearch(event.currentTarget.value)
                                        }
                                        placeholder="Search sounds"
                                        value={search}
                                    />
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                <div className="grid gap-2">
                                    {filteredSounds.map((sound) => (
                                        <SoundListItem
                                            isSelected={
                                                selectedSound?.id === sound.id
                                            }
                                            key={sound.id}
                                            onSelect={() => selectSound(sound)}
                                            sound={sound}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10">
                                <Button
                                    className="w-full"
                                    onClick={startCreate}
                                    type="button"
                                >
                                    <Plus className="size-4" />
                                    Create sound
                                </Button>
                            </div>
                        </aside>
                    </section>
                </div>
            </main>
        </>
    );
}

function SoundListItem({
    isSelected,
    onSelect,
    sound,
}: {
    isSelected: boolean;
    onSelect: () => void;
    sound: LearningSound;
}) {
    const Icon = soundIcons[sound.icon as keyof typeof soundIcons] ?? Music;

    return (
        <button
            className={cn(
                'grid gap-2 rounded-lg border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none',
                isSelected
                    ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]'
                    : 'border-slate-200 bg-slate-50 hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] hover:bg-[color-mix(in_srgb,var(--settings-accent)_8%,transparent)] dark:border-white/10 dark:bg-white/5',
            )}
            onClick={onSelect}
            type="button"
        >
            <span className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--settings-accent)_14%,transparent)] text-[var(--settings-accent)]">
                    <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {sound.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                        {sound.loop ? 'Loop' : 'One-shot'} · {sound.volume}%
                    </span>
                </span>
            </span>
        </button>
    );
}

function TextField({
    label,
    onChange,
    placeholder,
    type = 'text',
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: 'number' | 'text';
    value: string;
}) {
    const id = label.toLowerCase().replaceAll(' ', '-');

    return (
        <div className="grid gap-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder={placeholder}
                type={type}
                value={value}
            />
        </div>
    );
}

function formFromSound(sound: LearningSound | null): SoundForm {
    if (!sound) {
        return {
            icon: 'music',
            loop: false,
            name: '',
            playSeconds: '',
            slug: '',
            url: '',
            volume: '70',
        };
    }

    return {
        icon: sound.icon,
        loop: sound.loop,
        name: sound.name,
        playSeconds: sound.playSeconds?.toString() ?? '',
        slug: sound.slug,
        url: sound.url,
        volume: sound.volume.toString(),
    };
}

function soundPayload(form: SoundForm) {
    return {
        icon: form.icon,
        loop: form.loop,
        name: form.name,
        play_seconds: form.playSeconds || null,
        slug: form.slug || null,
        url: form.url,
        volume: form.volume,
    };
}

function playableSoundFromForm(form: SoundForm, id: number | string) {
    return {
        id,
        loop: form.loop,
        playSeconds: form.playSeconds ? Number(form.playSeconds) : null,
        url: form.url,
        volume: Number(form.volume),
    };
}

function readSelectedSoundId(): number | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const value = new URL(window.location.href).searchParams.get('sound');
    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue > 0
        ? numericValue
        : null;
}
