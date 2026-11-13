import { Eye, Save } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { publicPresentationStyle } from './public-presentation';

type Presentation = components['schemas']['PublicPresentation'];
type Palette = components['schemas']['PublicPalette'];
type PaletteField = Exclude<keyof Palette, `${string}_opacity`>;
type Mode = 'dark' | 'light';

const fields: Array<{ field: PaletteField; label: string }> = [
    { field: 'heading_text', label: 'Heading text' },
    { field: 'body_text', label: 'Body text' },
    { field: 'muted_text', label: 'Muted text' },
    { field: 'accent_text', label: 'Accent' },
    { field: 'control_text', label: 'Control text' },
    { field: 'control_border', label: 'Control border' },
    { field: 'welcome_overlay', label: 'Welcome background blend' },
];

/** Source-adapted from the public portion of `color-palette.tsx`. The
 * separate Rust route is intentionally scoped to the only palette model that
 * currently has a complete Rust owner: public presentation. */
export function OriginalPublicPalettePage({ appearance }: { appearance: OriginalAppearance }) {
    const [saved, setSaved] = useState<Presentation | null>(null);
    const [draft, setDraft] = useState<Presentation | null>(null);
    const [mode, setMode] = useState<Mode>(appearance);
    const [preview, setPreview] = useState<'public' | 'login'>('public');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void apiClient.GET('/admin/public-presentation').then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) {
                setError('Color palette settings are unavailable for this account.');
                return;
            }
            setSaved(data);
            setDraft(structuredClone(data));
        }).catch(() => active && setError('Color palette settings are temporarily unavailable.'));
        return () => { active = false; };
    }, []);

    const changed = Boolean(saved && draft && JSON.stringify(saved.public_palette) !== JSON.stringify(draft.public_palette));
    const palette = draft?.public_palette[mode];
    const storedPalette = saved?.public_palette[mode];

    function update(field: PaletteField, color: string, opacity: number): void {
        setDraft((current) => current ? {
            ...current,
            public_palette: {
                ...current.public_palette,
                [mode]: { ...current.public_palette[mode], [field]: color, [`${field}_opacity`]: opacity },
            },
        } : current);
    }

    async function save(): Promise<void> {
        if (!draft || !changed || busy) return;
        setBusy(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/public-presentation', {
                body: draft,
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok || !data) throw new Error('save');
            setSaved(data);
            setDraft(structuredClone(data));
        } catch {
            setError('The public palette could not be saved. Use colors up to 64 characters and opacity from 0 to 100.');
        } finally {
            setBusy(false);
        }
    }

    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 pb-5"><div><Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)]" to="/settings?panel=admin-public-pages">Public presentation</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Administration</p><h1 className="mt-2 text-3xl font-semibold">Color palette</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Edit the public color system used by welcome, authentication, source and information pages.</p></div><button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!changed || busy || !draft} onClick={() => void save()} type="button"><Save className="size-4" />{busy ? 'Saving…' : 'Save changes'}</button></header>
            {error ? <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
            {!draft || !palette ? <p className="p-6 text-sm text-[var(--settings-muted-text)]">Loading color palette settings…</p> : <section className="grid min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]"><div className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] xl:border-r xl:border-b-0"><div className="border-b border-[var(--settings-border-color)] p-5 text-sm leading-6 text-[var(--settings-muted-text)]">Public colors are used by the welcome page, auth pages, source page and public information pages.</div><div className="divide-y divide-[var(--settings-border-color)]">{fields.map(({ field, label }) => <PaletteFieldEditor field={field} key={field} label={label} onChange={update} palette={palette} storedPalette={storedPalette} />)}</div></div><div className="min-h-0 overflow-y-auto bg-[var(--settings-content-background)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">Live preview</p><h2 className="mt-1 text-lg font-semibold">Public text colors</h2></div><div className="flex items-center gap-1"><ModeSwitch mode={mode} onChange={setMode} /><div aria-label="Public text colors preview" className="ml-3 flex items-center gap-1" role="tablist"><PreviewButton active={preview === 'public'} label="Public pages" onClick={() => setPreview('public')} /><PreviewButton active={preview === 'login'} label="Login" onClick={() => setPreview('login')} /></div></div></div>{preview === 'public' ? <PublicPreview mode={mode} presentation={draft} /> : <LoginPreview mode={mode} presentation={draft} />}</div></section>}
        </div>
    </main>;
}

function PaletteFieldEditor({ field, label, onChange, palette, storedPalette }: { field: PaletteField; label: string; onChange: (field: PaletteField, color: string, opacity: number) => void; palette: Palette; storedPalette?: Palette }) {
    const opacityField = `${field}_opacity` as keyof Palette;
    const color = palette[field] as string;
    const opacity = palette[opacityField] as number;
    const reset = storedPalette?.[field] as string | undefined;
    const resetOpacity = storedPalette?.[opacityField] as number | undefined;
    return <div className="grid gap-3 p-5"><div className="flex items-center justify-between gap-3"><label className="text-sm font-medium">{label}</label>{reset !== undefined && (reset !== color || resetOpacity !== opacity) ? <button className="text-xs text-[var(--settings-accent)] hover:underline" onClick={() => onChange(field, reset, resetOpacity ?? 100)} type="button">Reset</button> : null}</div><div className="grid grid-cols-[auto_minmax(0,1fr)_5.5rem] gap-2"><input aria-label={`${label} picker`} className="h-9 w-12 cursor-pointer rounded border border-[var(--settings-border-color)] bg-transparent p-1" onChange={(event) => onChange(field, event.target.value, opacity)} type="color" value={isHexColor(color) ? color : '#000000'} /><input aria-label={label} className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" maxLength={64} onChange={(event) => onChange(field, event.target.value, opacity)} value={color} /><label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-[var(--settings-muted-text)]"><input aria-label={`${label} opacity`} className="w-full accent-[var(--settings-accent)]" max="100" min="0" onChange={(event) => onChange(field, color, boundedOpacity(event.target.value))} type="range" value={opacity} /><span>{opacity}%</span></label></div></div>;
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
    return <div aria-label="Palette appearance" className="inline-flex rounded-md border border-[var(--settings-border-color)] p-1" role="group">{(['dark', 'light'] as Mode[]).map((item) => <button aria-pressed={mode === item} className={`rounded px-3 py-1.5 text-xs font-medium ${mode === item ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : 'text-[var(--settings-muted-text)]'}`} key={item} onClick={() => onChange(item)} type="button">{item === 'dark' ? 'Dark' : 'Light'}</button>)}</div>;
}

function PreviewButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return <button aria-selected={active} className={`border-b-2 px-3 py-1.5 text-xs font-medium ${active ? 'border-[var(--settings-accent)] text-[var(--settings-accent)]' : 'border-transparent text-[var(--settings-muted-text)]'}`} onClick={onClick} role="tab" type="button">{label}</button>;
}

function PublicPreview({ mode, presentation }: { mode: Mode; presentation: Presentation }) {
    const style = publicPresentationStyle(presentation, mode, 'welcome');
    return <section className="mt-5 overflow-hidden border border-[var(--public-control-border)] p-6" style={style}><p className="text-xs font-medium tracking-[0.18em] uppercase" style={{ color: 'var(--public-accent)' }}>Explorable learning platform</p><h3 className="mt-3 text-3xl font-semibold" style={{ color: 'var(--public-heading-text)' }}>Learning Worlds</h3><p className="mt-3 max-w-xl leading-7" style={{ color: 'var(--public-body-text)' }}>A source-adapted preview of public heading, body, accent and overlay colors.</p><button className="mt-5 rounded-md px-4 py-2 text-sm font-medium" style={{ background: 'var(--public-accent)', color: 'var(--public-control-text)' }} type="button">Enter the first world</button><p className="mt-4 text-sm" style={{ color: 'var(--public-muted-text)' }}>Muted orientation and explanatory copy.</p></section>;
}

function LoginPreview({ mode, presentation }: { mode: Mode; presentation: Presentation }) {
    const style = publicPresentationStyle(presentation, mode, 'login');
    return <section className="mx-auto mt-5 max-w-sm border p-6" style={{ ...style, background: 'var(--auth-panel-background)', borderColor: 'var(--auth-border-line-color)' }}><div className="grid size-10 place-items-center rounded-md" style={{ background: 'var(--public-accent)', color: 'var(--public-control-text)' }}><Eye className="size-5" /></div><h3 className="mt-5 text-2xl font-semibold" style={{ color: 'var(--public-heading-text)' }}>Welcome back</h3><p className="mt-2 text-sm leading-6" style={{ color: 'var(--public-body-text)' }}>Use your account to continue learning.</p><label className="mt-5 grid gap-1 text-sm font-medium" style={{ color: 'var(--public-body-text)' }}>Email address<input className="rounded border bg-transparent px-3 py-2" readOnly style={{ borderColor: 'var(--public-control-border)' }} value="you@example.test" /></label><button className="mt-4 w-full rounded-md px-4 py-2 text-sm font-medium" style={{ background: 'var(--public-accent)', color: 'var(--public-control-text)' }} type="button">Log in</button></section>;
}

function boundedOpacity(value: string): number {
    return Math.min(100, Math.max(0, Number.parseInt(value, 10) || 0));
}

function isHexColor(value: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
