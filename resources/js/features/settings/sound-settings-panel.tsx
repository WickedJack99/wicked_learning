import { router } from '@inertiajs/react';
import { Play, Save, Volume2, VolumeX } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useState } from 'react';

import {
    SettingsFormColumn,
    SettingsPanelHeader,
    type SettingsNavigationItem,
    type SettingsSaveAction,
} from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { type SoundPreferences } from '@/features/sounds/sound-player';
import { useDirtyState } from '@/hooks/use-dirty-state';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import soundPreferences from '@/routes/settings/sound-preferences';

type SoundSettingsPanelProps = {
    headingItem?: SettingsNavigationItem<string>;
    hideSaveButton?: boolean;
    onSaveActionChange?: (action: SettingsSaveAction | null) => void;
    preferences: SoundPreferences;
};

type VolumeKey = 'ambienceVolume' | 'effectsVolume';

export function SoundSettingsPanel({
    headingItem,
    hideSaveButton = false,
    onSaveActionChange,
    preferences,
}: SoundSettingsPanelProps) {
    const t = usePlatformTranslation();
    const [form, setForm] = useState<SoundPreferences>(preferences);
    const [saving, setSaving] = useState(false);
    const hasChanges = useDirtyState(form, preferences);

    useEffect(() => setForm(preferences), [preferences]);

    const updateVolume =
        (key: VolumeKey) => (event: ChangeEvent<HTMLInputElement>) => {
            setForm((current) => ({
                ...current,
                [key]: clampVolume(Number(event.target.value)),
            }));
        };

    const save = useCallback(() => {
        if (!hasChanges) {
            return;
        }

        router.patch(soundPreferences.update.url(), form, {
            onFinish: () => setSaving(false),
            onStart: () => setSaving(true),
            preserveScroll: true,
        });
    }, [form, hasChanges]);

    useEffect(() => {
        if (!onSaveActionChange) {
            return;
        }

        onSaveActionChange({
            disabled: saving || !hasChanges,
            label: t('common.save', 'Save'),
            onClick: save,
            saving,
            savingLabel: t('settings.personal.sound.saving', 'Saving...'),
        });

        return () => onSaveActionChange(null);
    }, [hasChanges, onSaveActionChange, save, saving, t]);

    return (
        <section className="grid gap-5">
            <SettingsPanelHeader
                action={
                    <button
                        aria-pressed={form.muted}
                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition"
                        onClick={() =>
                            setForm((current) => ({
                                ...current,
                                muted: !current.muted,
                            }))
                        }
                        style={{
                            backgroundColor: form.muted
                                ? 'var(--settings-accent)'
                                : 'transparent',
                            borderColor: form.muted
                                ? 'var(--settings-accent)'
                                : 'var(--settings-border-color)',
                            color: form.muted
                                ? 'var(--settings-accent-foreground)'
                                : 'inherit',
                        }}
                        type="button"
                    >
                        {form.muted ? (
                            <VolumeX className="size-4" />
                        ) : (
                            <Volume2 className="size-4" />
                        )}
                        {t('settings.personal.sound.mute', 'Mute all sound')}
                    </button>
                }
                description={t(
                    'settings.personal.sound.description',
                    'Control optional effects and ambient sound for your own session without changing the learning world for others.',
                )}
                constrainActionToContent
                eyebrow={
                    headingItem
                        ? undefined
                        : t('settings.personal.sections.sound', 'Sound')
                }
                item={headingItem}
                title={t('settings.personal.sound.title', 'Audio preferences')}
            />

            <SettingsFormColumn>
                <VolumeControl
                    description={t(
                        'settings.personal.sound.effects.description',
                        'Clicks, interaction feedback and short one-shot sounds.',
                    )}
                    label={t(
                        'settings.personal.sound.effects',
                        'Effects volume',
                    )}
                    onChange={updateVolume('effectsVolume')}
                    value={form.effectsVolume}
                />
                <VolumeControl
                    description={t(
                        'settings.personal.sound.ambience.description',
                        'Looped background audio and environmental layers.',
                    )}
                    label={t(
                        'settings.personal.sound.ambience',
                        'Ambience volume',
                    )}
                    onChange={updateVolume('ambienceVolume')}
                    value={form.ambienceVolume}
                />

                <div className="border-b border-[var(--settings-border-color)] pb-4">
                    <p
                        className="text-xs font-medium tracking-[0.18em] uppercase"
                        style={{ color: 'var(--settings-accent)' }}
                    >
                        {t('settings.personal.sound.preview', 'Preview')}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.personal.sound.preview.description',
                            'Play short test sounds with the currently selected values before saving them.',
                        )}
                    </p>
                    <SoundPreviewControls preferences={form} />
                </div>
            </SettingsFormColumn>

            {!hideSaveButton ? (
                <div className="flex justify-end">
                    <Button
                        disabled={saving || !hasChanges}
                        onClick={save}
                        type="button"
                    >
                        <Save className="size-4" />
                        {saving
                            ? t('settings.personal.sound.saving', 'Saving...')
                            : t(
                                  'settings.personal.sound.save',
                                  'Save sound preferences',
                              )}
                    </Button>
                </div>
            ) : null}
        </section>
    );
}

function VolumeControl({
    description,
    label,
    onChange,
    value,
}: {
    description: string;
    label: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    value: number;
}) {
    return (
        <label className="grid gap-3 border-b border-[var(--settings-border-color)] pb-4">
            <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {description}
                </span>
            </span>
            <div className="grid gap-3 sm:grid-cols-[1fr_5rem] sm:items-center">
                <input
                    className="accent-[var(--settings-accent)]"
                    max="100"
                    min="0"
                    onChange={onChange}
                    type="range"
                    value={value}
                />
                <input
                    className="rounded-md border border-[var(--settings-input-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm"
                    max="100"
                    min="0"
                    onChange={onChange}
                    type="number"
                    value={value}
                />
            </div>
        </label>
    );
}

function SoundPreviewControls({
    preferences,
}: {
    preferences: SoundPreferences;
}) {
    const t = usePlatformTranslation();
    const effectsDisabled = preferences.muted || preferences.effectsVolume <= 0;
    const ambienceDisabled =
        preferences.muted || preferences.ambienceVolume <= 0;

    return (
        <div className="mt-5 flex flex-wrap gap-2">
            <button
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--settings-border-color)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--settings-accent)] hover:text-[var(--settings-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={effectsDisabled}
                onClick={() =>
                    playSyntheticSound('effect', preferences.effectsVolume)
                }
                type="button"
            >
                <Play className="size-4" />
                {t('settings.personal.sound.preview_effects', 'Test effects')}
            </button>
            <button
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--settings-border-color)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--settings-accent)] hover:text-[var(--settings-accent)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={ambienceDisabled}
                onClick={() =>
                    playSyntheticSound('ambience', preferences.ambienceVolume)
                }
                type="button"
            >
                <Play className="size-4" />
                {t('settings.personal.sound.preview_ambience', 'Test ambience')}
            </button>
        </div>
    );
}

function clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
        return 100;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
}

function playSyntheticSound(
    type: 'ambience' | 'effect',
    volume: number,
): void {
    const audioWindow = window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass =
        audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

    if (!AudioContextClass) {
        return;
    }

    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    const normalizedVolume = Math.min(Math.max(volume, 0), 100) / 100;
    const now = audioContext.currentTime;

    gain.connect(audioContext.destination);

    if (type === 'effect') {
        playEffectPreview(audioContext, gain, now, normalizedVolume);
        return;
    }

    playAmbiencePreview(audioContext, gain, now, normalizedVolume);
}

function playEffectPreview(
    audioContext: AudioContext,
    gain: GainNode,
    now: number,
    volume: number,
): void {
    const oscillator = audioContext.createOscillator();
    const duration = 0.32;

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + duration);
    oscillator.connect(gain);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24 * volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.addEventListener('ended', () => void audioContext.close());
}

function playAmbiencePreview(
    audioContext: AudioContext,
    gain: GainNode,
    now: number,
    volume: number,
): void {
    const low = audioContext.createOscillator();
    const high = audioContext.createOscillator();
    const duration = 1.4;

    low.type = 'sine';
    low.frequency.setValueAtTime(174, now);
    low.frequency.linearRampToValueAtTime(185, now + duration);
    high.type = 'sine';
    high.frequency.setValueAtTime(261, now);
    high.frequency.linearRampToValueAtTime(247, now + duration);

    low.connect(gain);
    high.connect(gain);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14 * volume, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    low.start(now);
    high.start(now);
    low.stop(now + duration);
    high.stop(now + duration);
    high.addEventListener('ended', () => void audioContext.close());
}
