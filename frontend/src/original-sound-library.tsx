import {
    Bell,
    ChevronLeft,
    LoaderCircle,
    MessageCircle,
    Music,
    Pause,
    Play,
    Plus,
    Radio,
    Save,
    Search,
    Square,
    Trash2,
    Upload,
    Wand,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Sound = components['schemas']['AdminSound'];
type SoundRequest = components['schemas']['AdminSoundRequest'];
type SoundIcon = Sound['icon'];

type SoundForm = {
    audioAssetId: string | null;
    icon: SoundIcon;
    loopEnabled: boolean;
    name: string;
    playSeconds: string;
    previewUrl: string;
    slug: string;
    volume: string;
};

const iconOptions: { icon: typeof Radio; label: string; value: SoundIcon }[] = [
    { icon: Radio, label: 'Ambience', value: 'ambience' },
    { icon: Music, label: 'Music', value: 'music' },
    { icon: Wand, label: 'Sound effect', value: 'sfx' },
    { icon: Bell, label: 'UI', value: 'ui' },
    { icon: MessageCircle, label: 'Voice', value: 'voice' },
];

const blankForm = (): SoundForm => ({
    audioAssetId: null,
    icon: 'music',
    loopEnabled: false,
    name: '',
    playSeconds: '',
    previewUrl: '',
    slug: '',
    volume: '70',
});

function formFromSound(sound: Sound): SoundForm {
    return {
        audioAssetId: null,
        icon: sound.icon,
        loopEnabled: sound.loop_enabled,
        name: sound.name,
        playSeconds: sound.play_seconds?.toString() ?? '',
        previewUrl: sound.url,
        slug: sound.slug,
        volume: sound.volume.toString(),
    };
}

/** Source-adapted from `settings/assets/sounds.tsx`: its two-pane sound list,
 * metadata form, upload control, preview controls and explicit destructive action
 * are retained while Inertia forms are replaced by the typed Rust contract. */
export function OriginalSoundLibraryPage() {
    const [sounds, setSounds] = useState<Sound[]>([]);
    const [selectedId, setSelectedId] = useState<string | 'new'>('new');
    const [form, setForm] = useState<SoundForm>(blankForm);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const audio = useRef<HTMLAudioElement | null>(null);
    const uploadInput = useRef<HTMLInputElement>(null);

    const selectedSound =
        selectedId === 'new'
            ? null
            : (sounds.find((sound) => sound.id === selectedId) ?? null);
    const filteredSounds = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) {
            return sounds;
        }
        return sounds.filter((sound) =>
            [sound.name, sound.slug, sound.icon].some((value) =>
                value.toLowerCase().includes(needle),
            ),
        );
    }, [search, sounds]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data, response } = await apiClient.GET('/admin/sounds');
            if (!response.ok || !data) {
                throw new Error('sounds unavailable');
            }
            setSounds(data.sounds);
            setSelectedId((current) => {
                if (
                    current !== 'new' &&
                    data.sounds.some((sound) => sound.id === current)
                ) {
                    return current;
                }
                return data.sounds[0]?.id ?? 'new';
            });
        } catch {
            setError(
                'The reusable sound library could not be loaded. Check your sound-library access and try again.',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        setForm(selectedSound ? formFromSound(selectedSound) : blankForm());
        setNotice(null);
        setError(null);
        stopPreview();
        // Only selection changes should reset the source-shaped editor form.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    function stopPreview(): void {
        audio.current?.pause();
        if (audio.current) {
            audio.current.currentTime = 0;
        }
    }

    async function playPreview(): Promise<void> {
        if (!form.previewUrl) {
            return;
        }
        if (
            !audio.current ||
            audio.current.src !==
                new URL(form.previewUrl, window.location.origin).href
        ) {
            stopPreview();
            audio.current = new Audio(form.previewUrl);
            audio.current.loop = form.loopEnabled;
            if (form.playSeconds) {
                const maxSeconds = Number(form.playSeconds);
                audio.current.addEventListener('timeupdate', () => {
                    if (
                        audio.current &&
                        audio.current.currentTime >= maxSeconds
                    ) {
                        stopPreview();
                    }
                });
            }
        }
        audio.current.volume = Number(form.volume) / 100;
        try {
            await audio.current.play();
        } catch {
            setError(
                'The selected sound could not be previewed in this browser.',
            );
        }
    }

    function payload(): SoundRequest | null {
        const volume = Number(form.volume);
        const playSeconds = form.playSeconds ? Number(form.playSeconds) : null;
        if (
            !form.name.trim() ||
            !Number.isInteger(volume) ||
            volume < 0 ||
            volume > 100 ||
            (playSeconds !== null &&
                (!Number.isFinite(playSeconds) ||
                    playSeconds < 0.1 ||
                    playSeconds > 86_400))
        ) {
            setError(
                'Enter a name, a whole-number volume from 0 to 100, and an optional duration from 0.1 to 86,400 seconds.',
            );
            return null;
        }
        return {
            audio_asset_id: form.audioAssetId,
            icon: form.icon,
            loop_enabled: form.loopEnabled,
            name: form.name.trim(),
            play_seconds: playSeconds,
            slug: form.slug.trim() || null,
            volume,
        };
    }

    async function save(): Promise<void> {
        const body = payload();
        if (!body) {
            return;
        }
        if (!selectedSound && !body.audio_asset_id) {
            setError('Upload a sound file before creating a reusable sound.');
            return;
        }
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const token = await getCsrfToken();
            if (selectedSound) {
                const { data, response } = await apiClient.PATCH(
                    '/admin/sounds/{sound_id}',
                    {
                        body,
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: { sound_id: selectedSound.id },
                        },
                    },
                );
                if (!response.ok || !data) {
                    throw new Error('save');
                }
                setSounds((current) =>
                    current.map((sound) =>
                        sound.id === data.sound.id ? data.sound : sound,
                    ),
                );
                setForm(formFromSound(data.sound));
                setNotice('Sound saved.');
            } else {
                const { data, response } = await apiClient.POST(
                    '/admin/sounds',
                    {
                        body,
                        params: { header: { 'X-CSRF-Token': token } },
                    },
                );
                if (!response.ok || !data) {
                    throw new Error('create');
                }
                setSounds((current) =>
                    [...current, data.sound].sort((left, right) =>
                        left.name.localeCompare(right.name),
                    ),
                );
                setSelectedId(data.sound.id);
                setNotice('Sound created.');
            }
        } catch {
            setError(
                'The sound could not be saved. Its slug may already be in use, or the selected upload may no longer be available.',
            );
        } finally {
            setBusy(false);
        }
    }

    async function remove(): Promise<void> {
        if (
            !selectedSound ||
            !window.confirm(`Delete ${selectedSound.name}?`)
        ) {
            return;
        }
        stopPreview();
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/sounds/{sound_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { sound_id: selectedSound.id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('delete');
            }
            const next = sounds.filter(
                (sound) => sound.id !== selectedSound.id,
            );
            setSounds(next);
            setSelectedId(next[0]?.id ?? 'new');
        } catch {
            setError('The sound could not be deleted.');
        } finally {
            setBusy(false);
        }
    }

    async function upload(file: File | null): Promise<void> {
        if (!file) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const data = new FormData();
            data.append('file', file);
            const response = await fetch('/api/v1/admin/sounds/media', {
                body: data,
                credentials: 'same-origin',
                headers: { 'X-CSRF-Token': token },
                method: 'POST',
            });
            if (!response.ok) {
                throw new Error('upload');
            }
            const uploaded =
                (await response.json()) as components['schemas']['AdminSoundMediaUploadResponse'];
            setForm((current) => ({
                ...current,
                audioAssetId: uploaded.asset_id,
                previewUrl: uploaded.url,
            }));
            setNotice(
                'Sound file stored. Save this form to attach it to the reusable library.',
            );
        } catch {
            setError(
                'This file could not be stored. Use AAC, FLAC, M4A, MP3, OGG, WAV, or WebM under 20 MiB.',
            );
        } finally {
            setBusy(false);
            if (uploadInput.current) {
                uploadInput.current.value = '';
            }
        }
    }

    async function discardUpload(): Promise<void> {
        if (!form.audioAssetId) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/sounds/media/{asset_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { asset_id: form.audioAssetId },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('discard');
            }
            setForm((current) => ({
                ...current,
                audioAssetId: null,
                previewUrl: selectedSound?.url ?? '',
            }));
            setNotice('Unattached sound upload removed.');
        } catch {
            setError(
                'The uploaded sound could not be discarded. It may already be attached to saved content.',
            );
        } finally {
            setBusy(false);
        }
    }

    function copyMetadata(soundId: string): void {
        const source = sounds.find((sound) => sound.id === soundId);
        if (!source) {
            return;
        }
        setForm((current) => ({
            ...current,
            icon: source.icon,
            loopEnabled: source.loop_enabled,
            playSeconds: source.play_seconds?.toString() ?? '',
            volume: source.volume.toString(),
        }));
        setNotice(
            `Copied playback settings from ${source.name}. Upload a file to create the new sound.`,
        );
    }

    const selectedIcon =
        iconOptions.find((option) => option.value === form.icon)?.icon ?? Music;
    const SelectedIcon = selectedIcon;

    return (
        <main
            className="min-h-svh bg-slate-100 px-4 py-5 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100"
            data-wl-id="settings.assets.sounds"
        >
            <div className="mx-auto flex max-w-[92rem] flex-col gap-4">
                <Link
                    className="inline-flex w-fit items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10"
                    to="/settings?panel=admin-assets-world-objects&asset=visuals"
                >
                    <ChevronLeft className="size-4" />
                    Settings
                </Link>
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium tracking-[.18em] text-teal-700 uppercase dark:text-teal-300">
                            Assets
                        </p>
                        <h1 className="mt-1 text-3xl font-semibold">
                            Reusable sound library
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Configure reusable ambience, music, effects, UI and
                            voice sounds. Uploads remain managed media and
                            become publicly playable only through a published
                            saved sound.
                        </p>
                    </div>
                    <button
                        className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => {
                            setSelectedId('new');
                        }}
                        type="button"
                    >
                        <Plus className="size-4" />
                        Create sound
                    </button>
                </header>
                {error ? (
                    <p
                        className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                {notice ? (
                    <p
                        className="rounded-md border border-teal-300 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-100"
                        role="status"
                    >
                        {notice}
                    </p>
                ) : null}
                <section
                    className="grid min-h-[42rem] gap-5 lg:grid-cols-[minmax(0,.72fr)_minmax(25rem,1fr)]"
                    data-wl-id="settings.assets.sounds.workspace"
                >
                    <aside
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950"
                        data-wl-id="settings.assets.sounds.list"
                    >
                        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-2 dark:border-white/20">
                            <Search className="size-4 text-slate-500" />
                            <input
                                aria-label="Search sounds"
                                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                                onChange={(event) =>
                                    setSearch(event.currentTarget.value)
                                }
                                placeholder="Search sounds"
                                value={search}
                            />
                        </label>
                        <div className="mt-4 grid max-h-[36rem] gap-2 overflow-y-auto pr-1">
                            {loading ? (
                                <p className="p-4 text-sm text-slate-500">
                                    Loading sounds…
                                </p>
                            ) : (
                                filteredSounds.map((sound) => {
                                    const Icon =
                                        iconOptions.find(
                                            (option) =>
                                                option.value === sound.icon,
                                        )?.icon ?? Music;
                                    return (
                                        <button
                                            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none ${selectedSound?.id === sound.id ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 dark:bg-teal-500/10' : 'border-slate-200 hover:border-teal-400 dark:border-white/10'}`}
                                            key={sound.id}
                                            onClick={() =>
                                                setSelectedId(sound.id)
                                            }
                                            type="button"
                                        >
                                            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-200">
                                                <Icon className="size-4" />
                                            </span>
                                            <span className="min-w-0">
                                                <strong className="block truncate text-sm">
                                                    {sound.name}
                                                </strong>
                                                <span className="mt-1 block truncate text-xs text-slate-500">
                                                    {sound.loop_enabled
                                                        ? 'Loop'
                                                        : 'One-shot'}{' '}
                                                    · {sound.volume}% ·{' '}
                                                    {sound.icon}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                            {!loading && filteredSounds.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20">
                                    No saved sound matches this search.
                                </p>
                            ) : null}
                        </div>
                    </aside>
                    <section
                        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950"
                        data-wl-id="settings.assets.sounds.editor"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex gap-3">
                                <span className="grid size-11 place-items-center rounded-md bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-200">
                                    <SelectedIcon className="size-5" />
                                </span>
                                <div>
                                    <h2 className="text-xl font-semibold">
                                        {selectedSound
                                            ? selectedSound.name
                                            : 'Create sound'}
                                    </h2>
                                    <p className="mt-1 text-sm leading-6 text-slate-500">
                                        Configure default playback behavior;
                                        activities may select this reusable
                                        sound.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    aria-label="Play sound preview"
                                    className="rounded border border-slate-300 p-2 hover:bg-slate-100 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
                                    disabled={!form.previewUrl}
                                    onClick={() => void playPreview()}
                                    type="button"
                                >
                                    <Play className="size-4" />
                                </button>
                                <button
                                    aria-label="Pause sound preview"
                                    className="rounded border border-slate-300 p-2 hover:bg-slate-100 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
                                    disabled={!form.previewUrl}
                                    onClick={() => audio.current?.pause()}
                                    type="button"
                                >
                                    <Pause className="size-4" />
                                </button>
                                <button
                                    aria-label="Stop sound preview"
                                    className="rounded border border-slate-300 p-2 hover:bg-slate-100 disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/10"
                                    disabled={!form.previewUrl}
                                    onClick={stopPreview}
                                    type="button"
                                >
                                    <Square className="size-4" />
                                </button>
                            </div>
                        </div>
                        {!selectedSound && sounds.length ? (
                            <label className="mt-5 grid gap-1 text-sm font-medium">
                                Copy playback settings from an existing sound
                                <select
                                    aria-label="Copy sound playback settings"
                                    className={inputClass}
                                    defaultValue=""
                                    onChange={(event) => {
                                        if (event.currentTarget.value)
                                            copyMetadata(
                                                event.currentTarget.value,
                                            );
                                        event.currentTarget.value = '';
                                    }}
                                >
                                    <option value="">Choose a sound…</option>
                                    {sounds.map((sound) => (
                                        <option key={sound.id} value={sound.id}>
                                            {sound.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                        <div className="mt-6 grid gap-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Name">
                                    <input
                                        aria-label="Sound name"
                                        className={inputClass}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                name: event.target.value,
                                            }))
                                        }
                                        value={form.name}
                                    />
                                </Field>
                                <Field label="Slug">
                                    <input
                                        aria-label="Sound slug"
                                        className={inputClass}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                slug: event.target.value,
                                            }))
                                        }
                                        placeholder="Generated from name if empty"
                                        value={form.slug}
                                    />
                                </Field>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Icon">
                                    <select
                                        aria-label="Sound icon"
                                        className={inputClass}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                icon: event.target
                                                    .value as SoundIcon,
                                            }))
                                        }
                                        value={form.icon}
                                    >
                                        {iconOptions.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Volume">
                                    <div className="grid grid-cols-[1fr_4.5rem] items-center gap-3">
                                        <input
                                            aria-label="Sound volume slider"
                                            max="100"
                                            min="0"
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    volume: event.target
                                                        .value,
                                                }))
                                            }
                                            type="range"
                                            value={form.volume}
                                        />
                                        <input
                                            aria-label="Sound volume"
                                            className={inputClass}
                                            max="100"
                                            min="0"
                                            onChange={(event) =>
                                                setForm((current) => ({
                                                    ...current,
                                                    volume: event.target
                                                        .value,
                                                }))
                                            }
                                            type="number"
                                            value={form.volume}
                                        />
                                    </div>
                                </Field>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Play first seconds">
                                    <input
                                        aria-label="Sound play first seconds"
                                        className={inputClass}
                                        min="0.1"
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                playSeconds:
                                                    event.target.value,
                                            }))
                                        }
                                        placeholder="Leave empty to play full file"
                                        step="0.1"
                                        type="number"
                                        value={form.playSeconds}
                                    />
                                </Field>
                                <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
                                    <input
                                        checked={form.loopEnabled}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                loopEnabled:
                                                    event.target.checked,
                                            }))
                                        }
                                        type="checkbox"
                                    />
                                    <span>
                                        <strong className="block">
                                            Loop playback
                                        </strong>
                                        <span className="text-xs text-slate-500">
                                            Useful for background music or
                                            ambience layers.
                                        </span>
                                    </span>
                                </label>
                            </div>
                            <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-white/20">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <strong className="text-sm">
                                            Sound file
                                        </strong>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                            Upload a sound file or choose an
                                            existing sound to copy metadata. New
                                            sounds require their own managed
                                            upload.
                                        </p>
                                    </div>
                                    <button
                                        className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
                                        disabled={busy}
                                        onClick={() =>
                                            uploadInput.current?.click()
                                        }
                                        type="button"
                                    >
                                        <Upload className="size-4" />
                                        {form.audioAssetId
                                            ? 'Replace uploaded file'
                                            : 'Upload sound'}
                                    </button>
                                    <input
                                        accept="audio/aac,audio/flac,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,.aac,.flac,.m4a,.mp3,.ogg,.wav,.webm"
                                        className="hidden"
                                        onChange={(event) =>
                                            void upload(
                                                event.currentTarget
                                                    .files?.[0] ?? null,
                                            )
                                        }
                                        ref={uploadInput}
                                        type="file"
                                    />
                                </div>
                                {form.previewUrl ? (
                                    <p className="mt-3 truncate text-xs text-slate-500">
                                        Preview ready: {form.previewUrl}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                            <div className="flex flex-wrap gap-2">
                                {selectedSound ? (
                                    <button
                                        className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-300/10"
                                        disabled={busy}
                                        onClick={() => void remove()}
                                        type="button"
                                    >
                                        <Trash2 className="size-4" />
                                        Delete sound
                                    </button>
                                ) : null}
                                {form.audioAssetId ? (
                                    <button
                                        className="rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
                                        disabled={busy}
                                        onClick={() => void discardUpload()}
                                        type="button"
                                    >
                                        Discard upload
                                    </button>
                                ) : null}
                            </div>
                            <button
                                className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                                disabled={busy || loading}
                                onClick={() => void save()}
                                type="button"
                            >
                                {busy ? (
                                    <LoaderCircle className="size-4 animate-spin" />
                                ) : selectedSound ? (
                                    <Save className="size-4" />
                                ) : (
                                    <Plus className="size-4" />
                                )}
                                {selectedSound ? 'Save sound' : 'Create sound'}
                            </button>
                        </footer>
                    </section>
                </section>
            </div>
        </main>
    );
}

function Field({
    children,
    label,
}: {
    children: React.ReactNode;
    label: string;
}) {
    return (
        <label className="grid gap-1 text-sm font-medium">
            {label}
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-md border border-slate-300 bg-transparent px-2 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-white/20';
