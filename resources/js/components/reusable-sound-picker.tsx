import { Pause, Play, Search, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLayeredSoundPlayer } from '@/features/sounds/sound-player';
import type { LearningSound } from '@/types';

export function ReusableSoundPicker({
    currentValue,
    onClear,
    onClose,
    onSelect,
}: {
    currentValue: string;
    onClear?: () => void;
    onClose: () => void;
    onSelect: (sound: LearningSound) => void;
}) {
    const [sounds, setSounds] = useState<LearningSound[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const player = useLayeredSoundPlayer();

    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => {
            const params = new URLSearchParams();

            if (search.trim()) {
                params.set('q', search.trim());
            }

            setIsLoading(true);
            setError('');

            fetch(`/settings/assets/reusable-sounds?${params.toString()}`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            })
                .then(async (response) => {
                    const payload = (await response.json()) as {
                        message?: string;
                        sounds?: LearningSound[];
                    };

                    if (!response.ok) {
                        throw new Error(
                            payload.message ?? 'Sounds could not be loaded.',
                        );
                    }

                    setSounds(payload.sounds ?? []);
                })
                .catch((nextError: unknown) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    setError(
                        nextError instanceof Error
                            ? nextError.message
                            : 'Sounds could not be loaded.',
                    );
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setIsLoading(false);
                    }
                });
        }, 180);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [search]);

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111820]">
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-white/10">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            Select existing sound
                        </h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Reuse uploaded or bundled audio with its metadata.
                        </p>
                    </div>
                    <Button
                        aria-label="Close sound picker"
                        onClick={() => {
                            player.stopAll();
                            onClose();
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                    >
                        <X className="size-4" />
                    </Button>
                </header>

                <div className="grid shrink-0 gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_auto] dark:border-white/10">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            autoFocus
                            className="pl-9"
                            onChange={(event) =>
                                setSearch(event.currentTarget.value)
                            }
                            placeholder="Search sounds"
                            value={search}
                        />
                    </div>
                    <Button
                        disabled={!currentValue}
                        onClick={() => {
                            onClear?.();
                            onClose();
                        }}
                        type="button"
                        variant="secondary"
                    >
                        Clear
                    </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {error ? (
                        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                            {error}
                        </p>
                    ) : null}

                    {!error && isLoading ? (
                        <div className="grid gap-3">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <div
                                    className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-white/8"
                                    key={index}
                                />
                            ))}
                        </div>
                    ) : null}

                    {!error && !isLoading && sounds.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                            No sounds match this search.
                        </p>
                    ) : null}

                    {!error && !isLoading && sounds.length > 0 ? (
                        <div className="grid gap-2">
                            {sounds.map((sound) => (
                                <SoundPickerRow
                                    currentValue={currentValue}
                                    key={sound.id}
                                    onSelect={onSelect}
                                    player={player}
                                    sound={sound}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function SoundPickerRow({
    currentValue,
    onSelect,
    player,
    sound,
}: {
    currentValue: string;
    onSelect: (sound: LearningSound) => void;
    player: ReturnType<typeof useLayeredSoundPlayer>;
    sound: LearningSound;
}) {
    const layer = `picker-${sound.id}`;

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto] md:items-center dark:border-white/10 dark:bg-white/5">
            <button
                className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:focus-visible:ring-teal-200"
                onClick={() => onSelect(sound)}
                type="button"
            >
                <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {sound.name}
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                    {sound.icon} · {sound.url}
                </span>
                {currentValue === sound.url ? (
                    <span className="mt-1 block text-xs font-medium text-cyan-700 dark:text-teal-200">
                        Selected
                    </span>
                ) : null}
            </button>
            <div className="flex gap-1">
                <Button
                    aria-label={`Play ${sound.name}`}
                    onClick={() => player.play(sound, layer)}
                    size="icon"
                    type="button"
                    variant="secondary"
                >
                    <Play className="size-4" />
                </Button>
                <Button
                    aria-label={`Pause ${sound.name}`}
                    onClick={() => player.pause(layer)}
                    size="icon"
                    type="button"
                    variant="secondary"
                >
                    <Pause className="size-4" />
                </Button>
                <Button
                    aria-label={`Stop ${sound.name}`}
                    onClick={() => player.stop(layer)}
                    size="icon"
                    type="button"
                    variant="secondary"
                >
                    <Square className="size-4" />
                </Button>
            </div>
        </div>
    );
}
