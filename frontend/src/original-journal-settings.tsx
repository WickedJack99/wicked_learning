import { Image, Images, Plus, Save, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { journalThemeImageUrl, journalThemeStyle } from './original-journal-theme';

type JournalPolicy = components['schemas']['AdminJournalFeedbackPolicy'];
type JournalTheme = components['schemas']['LearnerJournalTheme'];
type JournalThemeMode = components['schemas']['LearnerJournalThemeMode'];
type BackgroundAsset = components['schemas']['LearnerJournalBackgroundAsset'];
type MediaAsset = components['schemas']['AdminMediaAsset'];
type MediaAssetPage = components['schemas']['AdminMediaAssetPage'];
type Section = 'policy' | 'background';
type Mode = 'dark' | 'light';

/** Source-adapted from `pages/settings/journal.tsx`. The standalone route keeps
 * the original policy, background, asset, mode and preview workflow while its
 * saves go through the Rust-owned contract. */
export function OriginalJournalSettingsPage({ appearance }: { appearance: OriginalAppearance }) {
    const [policy, setPolicy] = useState<JournalPolicy | null>(null);
    const [draft, setDraft] = useState<JournalPolicy | null>(null);
    const [section, setSection] = useState<Section>('policy');
    const [mode, setMode] = useState<Mode>('dark');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void apiClient.GET('/admin/journal-feedback/policy').then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) {
                setError('Journal settings are temporarily unavailable.');
                return;
            }
            setPolicy(data);
            setDraft(structuredClone(data));
        }).catch(() => active && setError('Journal settings are temporarily unavailable.'));
        return () => { active = false; };
    }, []);

    const changed = Boolean(policy && draft && JSON.stringify(policy) !== JSON.stringify(draft));
    const activeTheme = draft?.theme[mode] ?? null;

    function updateTheme(updater: (theme: JournalTheme) => JournalTheme): void {
        setDraft((current) => current ? { ...current, theme: updater(current.theme) } : current);
    }

    function updateMode(updater: (current: JournalThemeMode) => JournalThemeMode): void {
        updateTheme((theme) => ({ ...theme, [mode]: updater(theme[mode]) }));
    }

    async function save(): Promise<void> {
        if (!draft || !changed || busy) return;
        setBusy(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/journal-feedback/policy', {
                body: draft,
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok || !data) throw new Error('save');
            setPolicy(data);
            setDraft(structuredClone(data));
        } catch {
            setError('The Journal settings could not be saved. Check each image and value, then try again.');
        } finally {
            setBusy(false);
        }
    }

    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 pb-5">
                <div><Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=admin-learning-support&support=feedback-requests">Learning Support</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Administration</p><h1 className="mt-2 text-3xl font-semibold">Journal</h1></div>
                <button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!changed || busy || !draft} onClick={() => void save()} type="button"><Save className="size-4" />{busy ? 'Saving…' : 'Save changes'}</button>
            </header>
            {error ? <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
            {!draft ? <p className="p-6 text-sm text-[var(--settings-muted-text)]">Loading Journal settings…</p> : <section className="min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)]">
                <div className="grid h-full min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
                    <aside className="border-b border-[var(--settings-border-color)] p-3 lg:border-r lg:border-b-0"><SectionButton active={section === 'policy'} description="Expert access consent and Journal safeguards." icon={<ShieldCheck className="size-4" />} label="Policy" onClick={() => setSection('policy')} /><SectionButton active={section === 'background'} description="Book, parchment or other Journal backdrop." icon={<Image className="size-4" />} label="Background" onClick={() => setSection('background')} /></aside>
                    <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--settings-border-color)] pb-4"><div><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Journal settings</p><h2 className="mt-2 text-2xl font-semibold">{section === 'policy' ? 'Policy' : 'Background'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Configure learner Journal behavior and visuals for the selected appearance mode.</p></div>{section === 'background' ? <div className="flex flex-wrap gap-2"><button className="rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm disabled:opacity-50" disabled={(activeTheme?.background_assets.length ?? 12) >= 12} onClick={() => updateMode((current) => ({ ...current, background_assets: [...current.background_assets, newAsset()] }))} type="button"><Plus className="mr-1 inline size-4" />Add asset</button><ModeSwitch mode={mode} onChange={setMode} /></div> : null}</header>
                        {section === 'policy' ? <PolicyFields checked={draft.allow_review_requests} onChange={(allow_review_requests) => setDraft((current) => current ? { ...current, allow_review_requests } : current)} /> : null}
                        {section === 'background' && activeTheme ? <BackgroundFields mode={mode} onChange={updateMode} theme={activeTheme} /> : null}
                    </div>
                </div>
            </section>}
        </div>
    </main>;
}

function SectionButton({ active, description, icon, label, onClick }: { active: boolean; description: string; icon: ReactNode; label: string; onClick: () => void }) {
    return <button className={`mb-2 flex w-full items-start gap-3 rounded-md p-3 text-left ${active ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : 'hover:bg-[var(--settings-active-background)]'}`} onClick={onClick} type="button"><span className="mt-0.5">{icon}</span><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[var(--settings-muted-text)]">{description}</span></span></button>;
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
    return <div aria-label="Appearance mode" className="inline-flex rounded-md border border-[var(--settings-border-color)] p-1"><button className={`rounded px-3 py-1.5 text-sm ${mode === 'dark' ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : ''}`} onClick={() => onChange('dark')} type="button">Dark</button><button className={`rounded px-3 py-1.5 text-sm ${mode === 'light' ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : ''}`} onClick={() => onChange('light')} type="button">Light</button></div>;
}

function PolicyFields({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
    return <section className="mt-6 max-w-4xl"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--settings-active-background)] text-[var(--settings-accent)]"><ShieldCheck className="size-5" /></span><div><h3 className="font-semibold">Optional expert access</h3><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">Learners can explicitly request informational feedback on their private Journal pages. This only records consent and does not send entries anywhere by itself.</p></div></div><label className="mt-6 flex cursor-pointer items-start gap-3 border-y border-[var(--settings-border-color)] py-4 text-sm"><input checked={checked} className="mt-1 size-4 accent-teal-600" onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span><span className="block font-medium">Allow learners to request informational feedback</span><span className="mt-1 block leading-6 text-[var(--settings-muted-text)]">Feedback is available only after a learner deliberately shares a page.</span></span></label></section>;
}

function BackgroundFields({ mode, onChange, theme }: { mode: Mode; onChange: (updater: (current: JournalThemeMode) => JournalThemeMode) => void; theme: JournalThemeMode }) {
    function updateAsset(id: string, updater: (asset: BackgroundAsset) => BackgroundAsset): void { onChange((current) => ({ ...current, background_assets: current.background_assets.map((asset) => asset.id === id ? updater(asset) : asset) })); }
    function removeAsset(id: string): void { onChange((current) => ({ ...current, background_assets: current.background_assets.filter((asset) => asset.id !== id) })); }
    return <section className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_28rem]"><div className="min-w-0"><ImageInput description={`Displayed behind the Journal in ${mode} mode. A book page, desk, parchment or subtle texture works well.`} id={`journal-${mode}-background`} label={`${capitalize(mode)} mode background image`} onChange={(background_image) => onChange((current) => ({ ...current, background_image }))} value={theme.background_image} /><div className="mt-5 grid gap-4 border-t border-[var(--settings-border-color)] pt-4 sm:grid-cols-3"><NumberInput label="Horizontal position" max={100} min={0} onChange={(background_position_x) => onChange((current) => ({ ...current, background_position_x }))} value={theme.background_position_x} /><NumberInput label="Vertical position" max={100} min={0} onChange={(background_position_y) => onChange((current) => ({ ...current, background_position_y }))} value={theme.background_position_y} /><NumberInput label="Zoom" max={300} min={25} onChange={(background_zoom) => onChange((current) => ({ ...current, background_zoom }))} value={theme.background_zoom} /></div><p className="mt-3 text-sm leading-6 text-[var(--settings-muted-text)]">100% keeps the normal cover fit. Lower values shrink the image; higher values zoom in without changing its aspect ratio.</p><section className="mt-6 border-t border-[var(--settings-border-color)] pt-4"><h3 className="font-semibold">Decorative assets</h3><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">Place ornaments, bookmarks or other images over the base background in {mode} mode.</p>{theme.background_assets.length === 0 ? <p className="mt-4 text-sm text-[var(--settings-muted-text)]">No decorative assets yet.</p> : null}{theme.background_assets.map((asset, index) => <div className="mt-5 border-t border-[var(--settings-border-color)] pt-4" key={asset.id}><div className="mb-4 flex items-center justify-between gap-3"><h4 className="font-medium">Asset {index + 1}</h4><button aria-label={`Remove asset ${index + 1}`} className="rounded p-2 hover:bg-[var(--settings-active-background)]" onClick={() => removeAsset(asset.id)} type="button"><Trash2 className="size-4" /></button></div><ImageInput description="Placed behind Journal controls and above the base background." id={`journal-${mode}-asset-${asset.id}`} label={`Asset ${index + 1} image`} onChange={(image) => updateAsset(asset.id, (current) => ({ ...current, image }))} value={asset.image} /><div className="mt-5 grid gap-4 sm:grid-cols-3"><NumberInput label="Horizontal position" max={100} min={0} onChange={(position_x) => updateAsset(asset.id, (current) => ({ ...current, position_x }))} value={asset.position_x} /><NumberInput label="Vertical position" max={100} min={0} onChange={(position_y) => updateAsset(asset.id, (current) => ({ ...current, position_y }))} value={asset.position_y} /><NumberInput label="Zoom" max={300} min={25} onChange={(zoom) => updateAsset(asset.id, (current) => ({ ...current, zoom }))} value={asset.zoom} /></div></div>)}</section></div><JournalPreview mode={mode} theme={theme} /></section>;
}

function ImageInput({ description, id, label, onChange, value }: { description: string; id: string; label: string; onChange: (value: string) => void; value: string }) {
    const [uploading, setUploading] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const upload = useRef<HTMLInputElement>(null);
    const preview = journalThemeImageUrl(value);
    async function uploadImage(file: File | null): Promise<void> { if (!file) return; setUploading(true); setUploadError(''); try { const token = await getCsrfToken(); const form = new FormData(); form.append('file', file); const response = await fetch('/api/v1/admin/media-assets', { body: form, credentials: 'same-origin', headers: { 'X-CSRF-Token': token }, method: 'POST' }); if (!response.ok) throw new Error('upload'); const data = await response.json() as { asset: MediaAsset }; onChange(data.asset.url); } catch { setUploadError('This image could not be stored. Use a GIF, JPEG, PNG, WebP, or SVG under 5 MiB.'); } finally { setUploading(false); if (upload.current) upload.current.value = ''; } }
    return <div className="grid gap-2"><div className="flex items-start gap-3"><Image className="mt-0.5 size-5 text-[var(--settings-accent)]" /><div><label className="font-medium" htmlFor={id}>{label}</label><p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">{description}</p></div></div><input className="w-full rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" id={id} onChange={(event) => onChange(event.target.value)} placeholder="/images/themes/journal-paper-leather-background.png" value={value} />{preview ? <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border border-[var(--settings-border-color)] p-2"><img alt="" className="size-12 object-contain" src={preview} /><span className="truncate text-xs text-[var(--settings-muted-text)]">{value}</span></div> : null}{uploadError ? <p className="text-sm text-red-700 dark:text-red-200" role="alert">{uploadError}</p> : null}<div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-3 py-1.5 text-sm disabled:opacity-50" disabled={uploading} onClick={() => upload.current?.click()} type="button"><Upload className="size-4" />{uploading ? 'Uploading…' : 'Upload'}</button><input accept="image/gif,image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0] ?? null)} ref={upload} type="file" /><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-3 py-1.5 text-sm" onClick={() => setPickerOpen(true)} type="button"><Images className="size-4" />Select existing</button><button className="rounded px-3 py-1.5 text-sm hover:bg-[var(--settings-active-background)]" onClick={() => onChange('')} type="button">Clear</button></div>{pickerOpen ? <MediaPicker onClose={() => setPickerOpen(false)} onSelect={(asset) => { onChange(asset.url); setPickerOpen(false); }} /> : null}</div>;
}

function MediaPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (asset: MediaAsset) => void }) {
    const [page, setPage] = useState<MediaAssetPage | null>(null);
    const [error, setError] = useState('');
    useEffect(() => { let active = true; void apiClient.GET('/admin/media-assets', { params: { query: { page: 1, per_page: 12 } } }).then(({ data, response }) => { if (!active) return; if (!response.ok || !data) { setError('Reusable visuals are unavailable for this account.'); return; } setPage(data); }).catch(() => active && setError('Reusable visuals are unavailable for this account.')); return () => { active = false; }; }, []);
    return <div aria-label="Select existing visual" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4" role="dialog"><div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Select existing visual</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Selection stores a stable Rust-owned media reference when the Journal settings are saved.</p></div><button aria-label="Close media picker" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="size-5" /></button></div>{error ? <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{error}</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">{page?.items.map((asset) => <button className="overflow-hidden rounded-lg border border-slate-200 text-left hover:border-teal-500 dark:border-white/10" key={asset.id} onClick={() => onSelect(asset)} type="button"><div className="grid aspect-video place-items-center bg-slate-100 dark:bg-slate-900"><img alt="" className="max-h-full max-w-full object-contain" src={asset.url} /></div><span className="block p-3 text-sm font-medium">{asset.display_name}</span></button>) ?? <p className="col-span-full py-6 text-sm text-slate-500">Loading visuals…</p>}</div>}</div></div>;
}

function NumberInput({ label, max, min, onChange, value }: { label: string; max: number; min: number; onChange: (value: number) => void; value: number }) { return <label className="grid gap-1 text-sm font-medium">{label}<input className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" max={max} min={min} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next)))); }} type="number" value={value} /></label>; }

function JournalPreview({ mode, theme }: { mode: Mode; theme: JournalThemeMode }) {
    const paired = useMemo(() => ({ dark: theme, light: theme }) as JournalTheme, [theme]);
    const style = journalThemeStyle(paired, mode);
    const background = journalThemeImageUrl(theme.background_image);
    return <div className="relative flex aspect-[3/2] w-full max-w-[28rem] self-start justify-self-center overflow-hidden rounded-xl border 2xl:justify-self-end" style={{ ...style, background: 'var(--journal-panel-background)', borderColor: 'var(--journal-panel-border)' }}><div aria-hidden="true" className="absolute inset-0 overflow-hidden">{background ? <img alt="" className="size-full max-w-none object-cover" src={background} style={{ objectPosition: 'var(--journal-background-position)', transform: 'scale(var(--journal-background-zoom))', transformOrigin: 'var(--journal-background-position)' }} /> : null}{theme.background_assets.map((asset) => { const image = journalThemeImageUrl(asset.image); return image ? <img alt="" className="absolute max-w-none" key={asset.id} src={image} style={{ left: `${asset.position_x}%`, top: `${asset.position_y}%`, transform: 'translate(-50%, -50%)', width: `${asset.zoom}%` }} /> : null; })}</div><div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--journal-background-overlay)' }} /><div className="relative z-10 flex w-full flex-col"><header className="flex items-center justify-between border-b px-3 py-2" style={{ background: 'var(--journal-header-background)', borderColor: 'var(--journal-panel-border)' }}><span className="text-xs font-semibold" style={{ color: 'var(--journal-heading-text)' }}>Journal</span><span className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--journal-button-border)', color: 'var(--journal-button-text)' }}>Export</span></header><div className="grid min-h-0 flex-1 grid-cols-[28%_1fr]"><aside className="border-r p-3" style={{ background: 'var(--journal-sidebar-background)', borderColor: 'var(--journal-panel-border)' }}><div className="rounded border p-2 text-xs" style={{ background: 'var(--journal-selected-background)', borderColor: 'var(--journal-selected-border)', color: 'var(--journal-selected-text)' }}>Field notes</div></aside><div className="p-3" style={{ background: 'var(--journal-content-background)' }}><h3 className="text-sm font-semibold" style={{ color: 'var(--journal-heading-text)' }}>A clear thought</h3><div className="mt-3 rounded border p-3 text-xs leading-5" style={{ background: 'var(--journal-input-background)', borderColor: 'var(--journal-button-border)', color: 'var(--journal-body-text)' }}>Markdown reflections appear in this writing area.</div></div></div></div></div>;
}

function newAsset(): BackgroundAsset { return { id: globalThis.crypto?.randomUUID?.() ?? `asset-${Date.now()}`, image: '', position_x: 50, position_y: 50, zoom: 100 }; }
function capitalize(value: string): string { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function settingsStyle(appearance: OriginalAppearance): CSSProperties { const dark = appearance === 'dark'; return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties; }
