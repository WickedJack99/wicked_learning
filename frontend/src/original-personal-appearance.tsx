import { Brush, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { usePlatformTranslation } from './original-platform-translation';

/** Source-adapted from AppearanceSettingsPanel and PersonalSettingsContent. */
export function OriginalPersonalAppearancePage({ appearance, onAppearanceChange }: { appearance: OriginalAppearance; onAppearanceChange: (appearance: OriginalAppearance) => Promise<void> }) {
    const t = usePlatformTranslation();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modes = [{ icon: Sun, label: 'Light', value: 'light' as const }, { icon: Moon, label: 'Dark', value: 'dark' as const }];
    async function select(value: OriginalAppearance): Promise<void> { if (saving || value === appearance) return; setSaving(true); setError(null); try { await onAppearanceChange(value); } catch { setError('Appearance could not be saved.'); } finally { setSaving(false); } }
    return <OriginalPersonalSettingsShell activeSection="appearance" appearance={appearance}><section className="grid gap-5"><header className="flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]"><Brush className="size-5" /><p className="text-xs font-medium tracking-[0.18em] uppercase">{t('settings.personal.sections.appearance', 'Appearance')}</p></div><h1 className="text-2xl font-semibold tracking-normal text-[var(--settings-primary-text)]">{t('settings.personal.appearance.title', 'Visual mode')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.personal.appearance.description', 'Choose the appearance used after signing in.')}</p></div></header><div className="w-full min-w-0 lg:max-w-[45%]"><div className="settings-rounded-control inline-flex gap-1 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-appearance-switch-background)] p-1">{modes.map(({ icon: Icon, label, value }) => <button aria-pressed={appearance === value} className={`flex items-center rounded-md px-3.5 py-1.5 transition-colors ${appearance === value ? 'bg-[var(--settings-appearance-switch-active-background)] text-[var(--settings-appearance-switch-active-text)] shadow-xs' : 'text-[var(--settings-appearance-switch-inactive-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]'}`} disabled={saving} key={value} onClick={() => void select(value)} type="button"><Icon className="-ml-1 size-4" /><span className="ml-1.5 text-sm">{label}</span></button>)}</div>{saving ? <p className="mt-3 text-sm text-[var(--settings-muted-text)]">Saving appearance…</p> : null}{error ? <p className="mt-3 text-sm text-red-500" role="alert">{error}</p> : null}</div></section></OriginalPersonalSettingsShell>;
}
