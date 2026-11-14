import { Play, Save, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import {
    defaultLearnerSoundPreferences,
    publishLearnerSoundPreferences,
    type LearnerSoundPreferences,
} from './learner-sound-preferences';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { usePlatformTranslation } from './original-platform-translation';

/** Source-adapted from the Personal Settings SoundSettingsPanel. */
export function OriginalPersonalSoundPage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const t = usePlatformTranslation();
    const [value, setValue] = useState<LearnerSoundPreferences>(defaultLearnerSoundPreferences);
    const [saved, setSaved] = useState<LearnerSoundPreferences>(defaultLearnerSoundPreferences);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void apiClient
            .GET('/learner/sound-preferences')
            .then(({ data, response }) => {
                if (response.ok && data) {
                    setValue(data);
                    setSaved(data);
                }
            })
            .catch(() => setError('Audio preferences could not be loaded.'));
    }, []);

    const update = (
        key: 'effects_volume' | 'ambience_volume',
        raw: string,
    ) => setValue((current) => ({ ...current, [key]: clamp(raw) }));

    async function save(): Promise<void> {
        setSaving(true);
        setError(null);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/learner/sound-preferences',
                {
                    body: value,
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );

            if (!response.ok || !data) {
                throw new Error('save unavailable');
            }

            setValue(data);
            setSaved(data);
            publishLearnerSoundPreferences(data);
        } catch {
            setError('Audio preferences could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    const changed = JSON.stringify(value) !== JSON.stringify(saved);
    return (
        <OriginalPersonalSettingsShell
            activeSection="sound"
            appearance={appearance}
            footerAction={
                <div className="w-full lg:max-w-[45%]">
                    <button
                        className="inline-flex w-full items-center justify-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                        disabled={saving || !changed}
                        onClick={() => void save()}
                        type="button"
                    >
                        <Save className="mr-2 size-4" />
                        {saving
                            ? t('settings.personal.sound.saving', 'Saving...')
                            : t('common.save', 'Save')}
                    </button>
                </div>
            }
        >
            <section className="grid gap-5">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--settings-border-color)] pb-5">
                    <div>
                        <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                            <Volume2 className="size-5" />
                            <p className="text-xs font-medium tracking-[0.18em] uppercase">
                                {t('settings.personal.sections.sound', 'Sound')}
                            </p>
                        </div>
                        <h1 className="text-2xl font-semibold text-[var(--settings-primary-text)]">
                            {t('settings.personal.sound.title', 'Audio preferences')}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.personal.sound.description',
                                'Control optional effects and ambient sound for your own session without changing the learning world for others.',
                            )}
                        </p>
                    </div>
                    <button
                        aria-pressed={value.muted}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                            value.muted
                                ? 'border-[var(--settings-accent)] bg-[var(--settings-accent)] text-slate-950'
                                : 'border-[var(--settings-border-color)]'
                        }`}
                        onClick={() =>
                            setValue((current) => ({
                                ...current,
                                muted: !current.muted,
                            }))
                        }
                        type="button"
                    >
                        {value.muted ? (
                            <VolumeX className="size-4" />
                        ) : (
                            <Volume2 className="size-4" />
                        )}
                        {t('settings.personal.sound.mute', 'Mute all sound')}
                    </button>
                </header>
                <div className="grid w-full min-w-0 gap-4 lg:max-w-[45%]">
                    <Volume
                        description={t(
                            'settings.personal.sound.effects.description',
                            'Clicks, interaction feedback and short one-shot sounds.',
                        )}
                        label={t(
                            'settings.personal.sound.effects',
                            'Effects volume',
                        )}
                        onChange={(raw) => update('effects_volume', raw)}
                        value={value.effects_volume}
                    />
                    <Volume
                        description={t(
                            'settings.personal.sound.ambience.description',
                            'Looped background audio and environmental layers.',
                        )}
                        label={t(
                            'settings.personal.sound.ambience',
                            'Ambience volume',
                        )}
                        onChange={(raw) => update('ambience_volume', raw)}
                        value={value.ambience_volume}
                    />
                    <div className="border-b border-[var(--settings-border-color)] pb-4">
                        <p className="text-xs font-medium tracking-[.18em] text-[var(--settings-accent)] uppercase">
                            {t('settings.personal.sound.preview', 'Preview')}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.personal.sound.preview.description',
                                'Play short test sounds with the currently selected values before saving them.',
                            )}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--settings-border-color)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--settings-accent)] hover:text-[var(--settings-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                                disabled={
                                    value.muted || value.effects_volume <= 0
                                }
                                onClick={() =>
                                    playSyntheticSound(
                                        'effect',
                                        value.effects_volume,
                                    )
                                }
                                type="button"
                            >
                                <Play className="size-4" />
                                {t(
                                    'settings.personal.sound.preview_effects',
                                    'Test effects',
                                )}
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--settings-border-color)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--settings-accent)] hover:text-[var(--settings-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                                disabled={
                                    value.muted || value.ambience_volume <= 0
                                }
                                onClick={() =>
                                    playSyntheticSound(
                                        'ambience',
                                        value.ambience_volume,
                                    )
                                }
                                type="button"
                            >
                                <Play className="size-4" />
                                {t(
                                    'settings.personal.sound.preview_ambience',
                                    'Test ambience',
                                )}
                            </button>
                        </div>
                    </div>
                    {error ? (
                        <p className="text-sm text-red-500" role="alert">
                            {error}
                        </p>
                    ) : null}
                </div>
            </section>
        </OriginalPersonalSettingsShell>
    );
}

function Volume({
    description,
    label,
    onChange,
    value,
}: {
    description: string;
    label: string;
    onChange: (value: string) => void;
    value: number;
}) {
    return (
        <label className="grid gap-3 border-b border-[var(--settings-border-color)] pb-4">
            <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-sm leading-6 text-[var(--settings-muted-text)]">
                    {description}
                </span>
            </span>
            <div className="grid gap-3 sm:grid-cols-[1fr_5rem] sm:items-center">
                <input
                    className="accent-[var(--settings-accent)]"
                    max="100"
                    min="0"
                    onChange={(event) => onChange(event.target.value)}
                    type="range"
                    value={value}
                />
                <input
                    className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm"
                    max="100"
                    min="0"
                    onChange={(event) => onChange(event.target.value)}
                    type="number"
                    value={value}
                />
            </div>
        </label>
    );
}

function clamp(value: string): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return 100;
    }

    return Math.min(100, Math.max(0, Math.round(parsed)));
}
function playSyntheticSound(type: 'ambience' | 'effect', volume: number): void { const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }; const AudioContextClass = audioWindow.AudioContext ?? audioWindow.webkitAudioContext; if (!AudioContextClass) return; const audioContext = new AudioContextClass(); const gain = audioContext.createGain(); const normalizedVolume = Math.min(Math.max(volume, 0), 100) / 100; const now = audioContext.currentTime; gain.connect(audioContext.destination); if (type === 'effect') { playEffectPreview(audioContext, gain, now, normalizedVolume); return; } playAmbiencePreview(audioContext, gain, now, normalizedVolume); }
function playEffectPreview(audioContext: AudioContext, gain: GainNode, now: number, volume: number): void { const oscillator = audioContext.createOscillator(); const duration = .32; oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(520, now); oscillator.frequency.exponentialRampToValueAtTime(880, now + .12); oscillator.frequency.exponentialRampToValueAtTime(440, now + duration); oscillator.connect(gain); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.24 * volume, now + .035); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); oscillator.start(now); oscillator.stop(now + duration); oscillator.addEventListener('ended', () => void audioContext.close()); }
function playAmbiencePreview(audioContext: AudioContext, gain: GainNode, now: number, volume: number): void { const low = audioContext.createOscillator(); const high = audioContext.createOscillator(); const duration = 1.4; low.type = 'sine'; low.frequency.setValueAtTime(174, now); low.frequency.linearRampToValueAtTime(185, now + duration); high.type = 'sine'; high.frequency.setValueAtTime(261, now); high.frequency.linearRampToValueAtTime(247, now + duration); low.connect(gain); high.connect(gain); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.14 * volume, now + .18); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); low.start(now); high.start(now); low.stop(now + duration); high.stop(now + duration); high.addEventListener('ended', () => void audioContext.close()); }
