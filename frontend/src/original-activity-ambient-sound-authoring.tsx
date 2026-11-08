import { Music2, Pause, Play, Save, Search, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Activity = components['schemas']['AdminEditableActivity'];
type EditableSound = components['schemas']['AdminEditableSound'];

/**
 * Source-adapted from Laravel's `ActivityAmbientSoundFields` and
 * `ReusableSoundPicker`. The selected reusable sound remains server-owned;
 * this authoring form submits its UUID rather than a browser-controlled URL.
 */
export function OriginalActivityAmbientSoundDialog({
    activity,
    onClose,
    onSaved,
    sounds,
}: {
    activity: Activity;
    onClose: () => void;
    onSaved: () => void;
    sounds: EditableSound[];
}) {
    const configured = configuredAmbientSound(activity);
    const [enabled, setEnabled] = useState(configured.enabled);
    const [soundId, setSoundId] = useState<string | null>(configured.soundId);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selectedSound = useMemo(
        () => sounds.find((sound) => sound.id === soundId) ?? null,
        [soundId, sounds],
    );

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/activities/{activity_id}/ambient-sound',
                {
                    body: {
                        enabled,
                        sound_id: soundId,
                        updated_at: activity.updated_at,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: activity.id },
                    },
                },
            );
            if (response.status === 409) {
                setError(
                    'This activity changed while you were editing scene ambience. Reload it and try again.',
                );
                return;
            }
            if (!response.ok) {
                throw new Error('scene ambience unavailable');
            }
            onSaved();
        } catch {
            setError(
                'Scene ambience could not be saved. Check your connection and try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            aria-labelledby="activity-ambient-sound-title"
            className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm"
            role="dialog"
        >
            <form
                className="mx-auto my-6 max-w-2xl rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900"
                data-wl-id="authoring.activity-ambient-sound"
                onSubmit={(event) => void save(event)}
            >
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300">
                            <Music2 className="size-4" /> Reusable sound
                        </p>
                        <h2
                            className="mt-1 text-xl font-semibold"
                            id="activity-ambient-sound-title"
                        >
                            Scene ambience
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Play one reusable sound while this activity is open.
                            It stops automatically when the learner continues.
                        </p>
                    </div>
                    <button
                        aria-label="Close scene ambience"
                        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        <X className="size-5" />
                    </button>
                </header>

                <label className="mt-6 flex w-fit items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input
                        checked={enabled}
                        className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                        onChange={(event) => setEnabled(event.currentTarget.checked)}
                        type="checkbox"
                    />
                    Enable scene ambience
                </label>

                <section className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                        {selectedSound
                            ? selectedSound.name
                            : 'No reusable sound selected'}
                    </span>
                    <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
                        disabled={saving}
                        onClick={() => setIsPickerOpen(true)}
                        type="button"
                    >
                        <Search className="size-4" /> Select sound
                    </button>
                    <button
                        aria-label="Clear selected scene ambience"
                        className="rounded-md p-2 text-slate-600 hover:bg-white disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                        disabled={!selectedSound || saving}
                        onClick={() => {
                            setEnabled(false);
                            setSoundId(null);
                        }}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </section>

                {sounds.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        No reusable sounds are available yet.
                    </p>
                ) : null}
                {error ? (
                    <p
                        className="mt-4 text-sm text-red-700 dark:text-red-300"
                        role="alert"
                    >
                        {error}
                    </p>
                ) : null}
                <footer className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                    <button
                        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100"
                        disabled={saving}
                        onClick={onClose}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                        disabled={saving}
                        type="submit"
                    >
                        <Save className="size-4" />
                        {saving ? 'Saving…' : 'Save scene ambience'}
                    </button>
                </footer>
            </form>
            {isPickerOpen ? (
                <ReusableSoundPicker
                    currentSoundId={soundId}
                    onClear={() => {
                        setEnabled(false);
                        setSoundId(null);
                    }}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={(sound) => {
                        setEnabled(true);
                        setSoundId(sound.id);
                        setIsPickerOpen(false);
                    }}
                    sounds={sounds}
                />
            ) : null}
        </div>
    );
}

function ReusableSoundPicker({
    currentSoundId,
    onClear,
    onClose,
    onSelect,
    sounds,
}: {
    currentSoundId: string | null;
    onClear: () => void;
    onClose: () => void;
    onSelect: (sound: EditableSound) => void;
    sounds: EditableSound[];
}) {
    const [search, setSearch] = useState('');
    const audio = useRef<HTMLAudioElement | null>(null);
    const filteredSounds = useMemo(() => {
        const query = search.trim().toLocaleLowerCase();
        if (!query) {
            return sounds;
        }

        return sounds.filter((sound) =>
            `${sound.name} ${sound.slug}`.toLocaleLowerCase().includes(query),
        );
    }, [search, sounds]);
    const stop = () => {
        audio.current?.pause();
        if (audio.current) {
            audio.current.currentTime = 0;
        }
    };

    useEffect(() => stop, []);

    const play = (sound: EditableSound) => {
        stop();
        const next = new Audio(sound.url);
        next.loop = sound.loop_enabled;
        next.preload = 'auto';
        next.volume = normalizedVolume(sound.volume);
        audio.current = next;
        void next.play().catch(stop);
    };

    return (
        <div
            aria-label="Select existing sound"
            className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
            role="dialog"
        >
            <section className="flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-white/10">
                    <div>
                        <h3 className="text-lg font-semibold">Select existing sound</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Reuse uploaded or bundled audio with its metadata.
                        </p>
                    </div>
                    <button
                        aria-label="Close sound picker"
                        className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10"
                        onClick={() => {
                            stop();
                            onClose();
                        }}
                        type="button"
                    >
                        <X className="size-4" />
                    </button>
                </header>
                <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto] dark:border-white/10">
                    <label className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <input
                            autoFocus
                            className="w-full rounded-md border border-slate-300 bg-transparent py-2 pr-3 pl-9 text-sm dark:border-white/20"
                            onChange={(event) => setSearch(event.currentTarget.value)}
                            placeholder="Search sounds"
                            value={search}
                        />
                    </label>
                    <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
                        disabled={!currentSoundId}
                        onClick={() => {
                            stop();
                            onClear();
                            onClose();
                        }}
                        type="button"
                    >
                        Clear
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {filteredSounds.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                            No sounds match this search.
                        </p>
                    ) : (
                        <div className="grid gap-2">
                            {filteredSounds.map((sound) => (
                                <article
                                    className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto] md:items-center dark:border-white/10 dark:bg-white/5"
                                    key={sound.id}
                                >
                                    <button
                                        className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:outline-none"
                                        onClick={() => onSelect(sound)}
                                        type="button"
                                    >
                                        <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                                            {sound.name}
                                        </span>
                                        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                                            {sound.icon ? `${sound.icon} · ` : ''}
                                            {sound.url}
                                        </span>
                                        {currentSoundId === sound.id ? (
                                            <span className="mt-1 block text-xs font-medium text-teal-700 dark:text-teal-300">
                                                Selected
                                            </span>
                                        ) : null}
                                    </button>
                                    <div className="flex gap-1">
                                        <button
                                            aria-label={`Play ${sound.name}`}
                                            className="rounded-md border border-slate-300 p-2 hover:bg-white dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={() => play(sound)}
                                            type="button"
                                        >
                                            <Play className="size-4" />
                                        </button>
                                        <button
                                            aria-label={`Pause ${sound.name}`}
                                            className="rounded-md border border-slate-300 p-2 hover:bg-white dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={() => audio.current?.pause()}
                                            type="button"
                                        >
                                            <Pause className="size-4" />
                                        </button>
                                        <button
                                            aria-label={`Stop ${sound.name}`}
                                            className="rounded-md border border-slate-300 p-2 hover:bg-white dark:border-white/20 dark:hover:bg-white/10"
                                            onClick={stop}
                                            type="button"
                                        >
                                            <Square className="size-4" />
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function configuredAmbientSound(activity: Activity): {
    enabled: boolean;
    soundId: string | null;
} {
    const config = activity.config as { ambientSound?: unknown };
    if (!isRecord(config.ambientSound)) {
        return { enabled: false, soundId: null };
    }

    return {
        enabled: config.ambientSound.enabled === true,
        soundId:
            typeof config.ambientSound.soundId === 'string'
                ? config.ambientSound.soundId
                : null,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedVolume(volume: number): number {
    return Math.min(Math.max(volume, 0), 100) / 100;
}
