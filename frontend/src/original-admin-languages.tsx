import { Download, FileUp, Plus, Save } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type Language = components['schemas']['AdminLanguage'];

/** Source-adapted from Laravel's presentation/localization Languages panel. */
export function OriginalAdminLanguagesPage({ appearance }: { appearance: OriginalAppearance }) {
    const t = usePlatformTranslation();
    const [languages, setLanguages] = useState<Language[]>([]);
    const [selectedCode, setSelectedCode] = useState('en');
    const [isEnabled, setIsEnabled] = useState(true);
    const [name, setName] = useState('');
    const [nativeName, setNativeName] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ code: '', name: '', native_name: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const uploadInput = useRef<HTMLInputElement>(null);
    const selected = useMemo(() => languages.find((language) => language.code === selectedCode) ?? languages[0] ?? null, [languages, selectedCode]);
    const changed = Boolean(selected && !selected.is_default && (
        selected.is_enabled !== isEnabled
        || selected.name !== name
        || selected.native_name !== nativeName
    ));

    async function load(): Promise<void> {
        setBusy(true); setError('');
        try {
            const { data, response } = await apiClient.GET('/admin/languages');
            if (!response.ok || !data) throw new Error('unavailable');
            setLanguages(data.languages);
            setSelectedCode((current) => data.languages.some((language) => language.code === current) ? current : (data.languages[0]?.code ?? 'en'));
        } catch {
            setError(t('settings.administration.languages.unavailable', 'Language administration is temporarily unavailable.'));
        } finally { setBusy(false); }
    }

    useEffect(() => { void load(); }, []);
    useEffect(() => {
        setIsEnabled(selected?.is_enabled ?? true);
        setName(selected?.name ?? '');
        setNativeName(selected?.native_name ?? '');
    }, [selected]);

    async function create(): Promise<void> {
        setBusy(true); setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/admin/languages', { body: { code: createForm.code.trim(), name: createForm.name.trim(), native_name: createForm.native_name.trim() }, params: { header: { 'X-CSRF-Token': token } } });
            if (!response.ok || !data) throw new Error('invalid');
            setLanguages((current) => [...current, data]); setSelectedCode(data.code); setCreateOpen(false); setCreateForm({ code: '', name: '', native_name: '' });
        } catch {
            setError(t('settings.administration.languages.create_error', 'The language could not be created. Check its code and names.'));
        } finally { setBusy(false); }
    }

    async function save(): Promise<void> {
        if (!selected || !changed) return;
        setBusy(true); setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/languages/{code}', { body: { is_enabled: isEnabled, name: name.trim(), native_name: nativeName.trim() }, params: { header: { 'X-CSRF-Token': token }, path: { code: selected.code } } });
            if (!response.ok || !data) throw new Error('invalid');
            setLanguages((current) => current.map((language) => language.code === data.code ? data : language));
        } catch {
            setError(t('settings.administration.languages.save_error', 'The language details could not be saved.'));
        } finally { setBusy(false); }
    }

    async function downloadCatalog(code: string, english: boolean): Promise<void> {
        setBusy(true); setError('');
        try {
            const result = english ? await apiClient.GET('/admin/localization/catalogs/english') : await apiClient.GET('/admin/languages/{code}/translation-catalog', { params: { path: { code } } });
            if (!result.response.ok || !result.data) throw new Error('unavailable');
            const href = URL.createObjectURL(new Blob([JSON.stringify(result.data.catalog, null, 2)], { type: 'application/json' }));
            const link = document.createElement('a'); link.href = href; link.download = `learning-worlds-${code}-translations.json`; link.click(); URL.revokeObjectURL(href);
        } catch {
            setError(t('settings.administration.languages.download_error', 'The translation catalog could not be downloaded.'));
        } finally { setBusy(false); }
    }

    async function importCatalog(file: File | null): Promise<void> {
        if (!file || !selected || selected.is_default) return;
        setBusy(true); setError('');
        try {
            const token = await getCsrfToken();
            const body = new FormData(); body.append('catalog', file);
            const response = await fetch(`/api/v1/admin/languages/${encodeURIComponent(selected.code)}/translation-catalog/import`, { body, credentials: 'same-origin', headers: { 'X-CSRF-Token': token }, method: 'POST' });
            if (!response.ok) throw new Error('invalid');
            await load();
        } catch {
            setError(t('settings.administration.languages.import_error', 'The catalog could not be imported. Use a source-compatible JSON file under 2 MiB.'));
        } finally { setBusy(false); if (uploadInput.current) uploadInput.current.value = ''; }
    }

    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" data-wl-id="settings.administration.languages" style={settingsStyle(appearance)}>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 pb-5"><div><Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings">{t('settings.navigation', 'Settings')}</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">{t('settings.administration.languages.eyebrow', 'Administration')}</p><h1 className="mt-2 text-3xl font-semibold">{t('settings.administration.languages.head_title', 'Language administration')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.administration.languages.description', 'Create supported languages and import translated platform and activity catalogs.')}</p></div><button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!changed || busy} onClick={() => void save()} type="button"><Save className="size-4" />{busy ? t('common.saving', 'Saving…') : t('settings.administration.languages.save', 'Save language')}</button></header>
            {error ? <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
            <section className="grid min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] lg:grid-cols-[20rem_minmax(0,1fr)]">
                <aside className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] p-4 lg:border-r lg:border-b-0"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{t('settings.administration.languages.available', 'Available languages')}</h2><p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">{t('settings.administration.languages.available_description', 'English is the source catalog.')}</p></div><button aria-expanded={createOpen} aria-label={t('settings.administration.languages.add', 'Add language')} className="rounded border border-[var(--settings-border-color)] p-2 text-[var(--settings-accent)] hover:bg-[var(--settings-active-background)]" onClick={() => setCreateOpen((open) => !open)} type="button"><Plus className="size-4" /></button></div>
                    {createOpen ? <form className="mt-4 grid gap-3 border border-[var(--settings-border-color)] p-3" data-wl-id="settings.administration.languages.create" onSubmit={(event) => { event.preventDefault(); void create(); }}><LanguageInput label={t('settings.administration.languages.code', 'Language code')} onChange={(value) => setCreateForm((current) => ({ ...current, code: value }))} placeholder={t('settings.administration.languages.code_placeholder', 'Code, e.g. ja')} value={createForm.code} /><LanguageInput label={t('settings.administration.languages.name', 'Language name')} onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))} placeholder={t('settings.administration.languages.name_placeholder', 'Name, e.g. Japanese')} value={createForm.name} /><LanguageInput label={t('settings.administration.languages.native_name', 'Native name')} onChange={(value) => setCreateForm((current) => ({ ...current, native_name: value }))} placeholder={t('settings.administration.languages.native_name_placeholder', 'Native name, e.g. Japanese')} value={createForm.native_name} /><button className="inline-flex items-center justify-center gap-2 rounded bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={busy} type="submit"><Plus className="size-4" />{t('settings.administration.languages.create', 'Create')}</button></form> : null}
                    <div className="mt-4 grid gap-2" data-wl-id="settings.administration.languages.list">{languages.map((language) => <button aria-pressed={selected?.code === language.code} className="rounded-lg border p-3 text-left transition hover:border-[var(--settings-accent)]" key={language.code} onClick={() => setSelectedCode(language.code)} style={selected?.code === language.code ? { background: 'color-mix(in srgb, var(--settings-accent) 14%, transparent)', borderColor: 'var(--settings-accent)' } : undefined} type="button"><span className="block text-sm font-medium">{language.name}</span><span className="mt-1 block text-xs text-[var(--settings-muted-text)]">{language.native_name} · {language.code}</span></button>)}</div>
                </aside>
                <section className="min-h-0 overflow-y-auto bg-[var(--settings-content-background)] p-5" data-wl-id="settings.administration.languages.editor">{!selected ? <p className="text-sm text-[var(--settings-muted-text)]">{busy ? t('common.loading', 'Loading…') : t('settings.administration.languages.empty', 'No language catalogs yet.')}</p> : <div className="mx-auto max-w-3xl"><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">{t('settings.administration.languages.catalog', 'Translation catalog')}</p><h2 className="mt-2 text-2xl font-semibold">{selected.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.administration.languages.catalog_description', 'Export English, translate its JSON values, then upload it here. The import keeps only learner-visible activity copy and ignores answer correctness or graph behavior.')}</p><div className="mt-5 flex flex-wrap gap-3"><button className="inline-flex items-center gap-2 rounded border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)] disabled:opacity-50" disabled={busy} onClick={() => void downloadCatalog('en', true)} type="button"><Download className="size-4" />{t('settings.administration.languages.download_english', 'Download English')}</button>{!selected.is_default ? <><button className="inline-flex items-center gap-2 rounded border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium hover:bg-[var(--settings-active-background)] disabled:opacity-50" disabled={busy} onClick={() => void downloadCatalog(selected.code, false)} type="button"><Download className="size-4" />{t('settings.administration.languages.download_current', 'Download current catalog')}</button><button className="inline-flex items-center gap-2 rounded bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={busy} onClick={() => uploadInput.current?.click()} type="button"><FileUp className="size-4" />{t('settings.administration.languages.import', 'Upload translation catalog')}</button><input accept="application/json,text/plain,.json" className="hidden" onChange={(event) => void importCatalog(event.currentTarget.files?.[0] ?? null)} ref={uploadInput} type="file" /></> : null}</div>{selected.is_default ? <p className="mt-6 rounded border border-dashed border-[var(--settings-border-color)] p-4 text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.administration.languages.default_notice', 'English is the canonical source. Download it to prepare another language.')}</p> : <div className="mt-6 grid gap-5 rounded border border-[var(--settings-border-color)] p-5"><div className="grid gap-5 sm:grid-cols-2"><LanguageInput label={t('settings.administration.languages.name', 'Language name')} onChange={setName} value={name} /><LanguageInput label={t('settings.administration.languages.native_name', 'Native name')} onChange={setNativeName} value={nativeName} /></div><div className="flex items-center justify-between gap-4 border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4"><span><span className="block text-sm font-medium">{t('settings.administration.languages.enabled', 'Enabled for learners')}</span><span className="mt-1 block text-xs text-[var(--settings-muted-text)]">{t('settings.administration.languages.enabled_description', 'Disabled languages remain editable but cannot be selected by learners.')}</span></span><button aria-checked={isEnabled} aria-label={t('settings.administration.languages.enabled', 'Enabled for learners')} className="inline-flex size-5 items-center justify-center rounded border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] text-xs font-bold text-[var(--settings-accent)]" disabled={busy} onClick={() => setIsEnabled((current) => !current)} role="checkbox" type="button">{isEnabled ? '✓' : null}</button></div></div>}</div>}</section>
            </section>
        </div>
    </main>;
}

function LanguageInput({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
    return <label className="grid gap-1 text-sm font-medium">{label}<input className="rounded border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" maxLength={80} onChange={(event) => onChange(event.currentTarget.value)} placeholder={placeholder} value={value} /></label>;
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
