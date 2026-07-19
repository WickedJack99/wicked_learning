import { router } from '@inertiajs/react';
import { Save, Volume2, VolumeX } from 'lucide-react';
import { type ChangeEvent, useEffect, useState } from 'react';

import { type SoundPreferences } from '@/features/sounds/sound-player';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import soundPreferences from '@/routes/settings/sound-preferences';

type SoundSettingsPanelProps = {
    preferences: SoundPreferences;
};

type VolumeKey = 'ambienceVolume' | 'effectsVolume';

export function SoundSettingsPanel({ preferences }: SoundSettingsPanelProps) {
    const t = usePlatformTranslation();
    const [form, setForm] = useState<SoundPreferences>(preferences);
    const [saving, setSaving] = useState(false);

    useEffect(() => setForm(preferences), [preferences]);

    const updateVolume =
        (key: VolumeKey) => (event: ChangeEvent<HTMLInputElement>) => {
            setForm((current) => ({
                ...current,
                [key]: clampVolume(Number(event.target.value)),
            }));
        };

    const save = () => {
        router.patch(soundPreferences.update.url(), form, {
            onFinish: () => setSaving(false),
            onStart: () => setSaving(true),
            preserveScroll: true,
        });
    };

    return (
        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <p
                        className="text-xs font-medium tracking-[0.18em] uppercase"
                        style={{ color: 'var(--settings-accent)' }}
                    >
                        {t('settings.personal.sound.eyebrow', 'Sound comfort')}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold">
                        {t(
                            'settings.personal.sound.title',
                            'Audio preferences',
                        )}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.personal.sound.description',
                            'Control optional effects and ambient sound for your own session without changing the learning world for others.',
                        )}
                    </p>
                </div>

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
                            : 'rgb(148 163 184 / 0.35)',
                        color: form.muted ? '#050f16' : 'inherit',
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
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                <div className="grid gap-4">
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
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-[#050816]/80">
                    <p
                        className="text-xs font-medium tracking-[0.18em] uppercase"
                        style={{ color: 'var(--settings-accent)' }}
                    >
                        {t('settings.personal.sound.preview', 'Preview')}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.personal.sound.preview.description',
                            'Sound playback now uses these values whenever a map, tool or activity plays optional audio.',
                        )}
                    </p>
                    <div className="mt-5 grid gap-2 text-sm">
                        <SoundMeter
                            label={t(
                                'settings.personal.sound.effects',
                                'Effects volume',
                            )}
                            muted={form.muted}
                            value={form.effectsVolume}
                        />
                        <SoundMeter
                            label={t(
                                'settings.personal.sound.ambience',
                                'Ambience volume',
                            )}
                            muted={form.muted}
                            value={form.ambienceVolume}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-950"
                    disabled={saving}
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
                </button>
            </div>
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
        <label className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-[#050816]/70">
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
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0b1117]"
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

function SoundMeter({
    label,
    muted,
    value,
}: {
    label: string;
    muted: boolean;
    value: number;
}) {
    const effectiveValue = muted ? 0 : value;

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{label}</span>
                <span className="text-slate-500 dark:text-slate-400">
                    {effectiveValue}%
                </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                    className="h-full rounded-full"
                    style={{
                        backgroundColor: 'var(--settings-accent)',
                        width: `${effectiveValue}%`,
                    }}
                />
            </div>
        </div>
    );
}

function clampVolume(value: number): number {
    if (!Number.isFinite(value)) {
        return 100;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
}
