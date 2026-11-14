import { Languages, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { platformTranslationChangedEvent, usePlatformTranslation } from './original-platform-translation';

type LanguagePreference = { available_languages: { code: string; name: string; native_name: string }[]; locale: string };

/** Source-adapted from PersonalSettingsContent and LanguageSettingsPanel. */
export function OriginalPersonalLanguagePage({ appearance }: { appearance: OriginalAppearance }) {
    const t = usePlatformTranslation();
    const [preference, setPreference] = useState<LanguagePreference>({ available_languages: [], locale: 'en' });
    const [savedLocale, setSavedLocale] = useState('en');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { void apiClient.GET('/learner/language-preference').then(({ data, response }) => { if (!response.ok || !data) throw new Error(); setPreference(data); setSavedLocale(data.locale); }).catch(() => setError('Language preferences could not be loaded.')); }, []);
    async function save() { if (saving || preference.locale === savedLocale) return; setSaving(true); setError(null); try { const token = await getCsrfToken(); const { data, response } = await apiClient.PATCH('/learner/language-preference', { body: { locale: preference.locale }, params: { header: { 'X-CSRF-Token': token } } }); if (!response.ok || !data) throw new Error(); setPreference(data); setSavedLocale(data.locale); window.dispatchEvent(new Event(platformTranslationChangedEvent)); } catch { setError('Language preferences could not be saved.'); } finally { setSaving(false); } }
    return <OriginalPersonalSettingsShell activeSection="language" appearance={appearance}><section className="grid gap-5"><header className="flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]"><Languages className="size-5" /><p className="text-xs font-medium tracking-[0.18em] uppercase">{t('settings.personal.sections.language', 'Language')}</p></div><h1 className="text-2xl font-semibold tracking-normal text-[var(--settings-primary-text)]">{t('settings.personal.language.current', 'Current language')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.personal.language.description', 'Choose the language used for platform controls and learner-visible activity copy.')}</p></div></header><div className="grid w-full min-w-0 gap-5 lg:max-w-[45%]"><label className="grid gap-2" htmlFor="language"><span className="text-sm font-medium">{t('settings.personal.language.current', 'Current language')}</span><select className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm" id="language" onChange={(event) => setPreference((current) => ({ ...current, locale: event.target.value }))} value={preference.locale}>{preference.available_languages.map((language) => <option key={language.code} value={language.code}>{language.name} ({language.native_name})</option>)}</select></label><button className="inline-flex w-fit items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={saving || preference.locale === savedLocale} onClick={() => void save()} type="button"><Save className="mr-2 size-4" />{t('settings.personal.language.save', 'Save language')}</button>{error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}</div></section></OriginalPersonalSettingsShell>;
}
