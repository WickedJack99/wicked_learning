import { Eye, Save } from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { PresentationLocalizationSettingsShell } from './extracted-presentation-localization-navigation';
import type { OriginalAppearance } from './original-appearance';
import { publicPresentationStyle, settingsPresentationStyle } from './public-presentation';

type Presentation = components['schemas']['PublicPresentation'];
type Palette = components['schemas']['PublicPalette'];
type PaletteField = Exclude<keyof Palette, `${string}_opacity`>;
type SettingsPalette = components['schemas']['SettingsPalette'];
type SettingsPaletteField = Exclude<keyof SettingsPalette, `${string}_opacity`>;
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

const settingsFields: Array<{ field: SettingsPaletteField; label: string }> = [
    { field: 'accent', label: 'Accent' },
    { field: 'accent_foreground', label: 'Accent foreground' },
    { field: 'active_background', label: 'Active item background' },
    { field: 'appearance_switch_background', label: 'Appearance switch background' },
    { field: 'appearance_switch_active_background', label: 'Appearance switch active background' },
    { field: 'appearance_switch_active_text', label: 'Appearance switch active text' },
    { field: 'appearance_switch_inactive_text', label: 'Appearance switch inactive text' },
    { field: 'sidebar_background', label: 'Sidebar background' },
    { field: 'nested_sidebar_background', label: 'Nested menu background' },
    { field: 'content_background', label: 'Content background' },
    { field: 'panel_background', label: 'Panel background' },
    { field: 'input_background', label: 'Input field background' },
    { field: 'input_border_color', label: 'Input field border' },
    { field: 'border_color', label: 'Border color' },
    { field: 'muted_text', label: 'Muted text' },
    { field: 'scrollbar_thumb', label: 'Scrollbar thumb' },
];

/** Source-adapted from `color-palette.tsx`, limited to palette models exposed
 * by the Rust public-presentation contract. */
export function OriginalPublicPalettePage({ appearance, onSignedOut, settingsAccess }: { appearance: OriginalAppearance; onSignedOut: () => void; settingsAccess: Record<string, boolean> }) {
    const [saved, setSaved] = useState<Presentation | null>(null);
    const [draft, setDraft] = useState<Presentation | null>(null);
    const [mode, setMode] = useState<Mode>(appearance);
    const [section, setSection] = useState<'public' | 'settings'>('public');
    const [preview, setPreview] = useState<'public' | 'login'>('public');
    const [settingsPreview, setSettingsPreview] = useState<'settings' | 'controls'>('settings');
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

    const changed = Boolean(saved && draft && (JSON.stringify(saved.public_palette) !== JSON.stringify(draft.public_palette) || JSON.stringify(saved.settings_palette) !== JSON.stringify(draft.settings_palette)));
    const palette = draft?.public_palette[mode];
    const storedPalette = saved?.public_palette[mode];
    const settingsPalette = draft?.settings_palette[mode];
    const storedSettingsPalette = saved?.settings_palette[mode];

    function update(field: PaletteField, color: string, opacity: number): void {
        setDraft((current) => current ? {
            ...current,
            public_palette: {
                ...current.public_palette,
                [mode]: { ...current.public_palette[mode], [field]: color, [`${field}_opacity`]: opacity },
            },
        } : current);
    }

    function updateSettings(field: SettingsPaletteField, color: string, opacity: number): void {
        setDraft((current) => current ? {
            ...current,
            settings_palette: {
                ...current.settings_palette,
                [mode]: { ...current.settings_palette[mode], [field]: color, [`${field}_opacity`]: opacity },
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
            setError('The color palette could not be saved. Use colors up to 64 characters and opacity from 0 to 100.');
        } finally {
            setBusy(false);
        }
    }

    return <PresentationLocalizationSettingsShell activeSection="palette" appearance={appearance} onSignedOut={onSignedOut} settingsAccess={settingsAccess}>
        <div className="h-full min-h-0 overflow-y-auto p-4 sm:p-5">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 pb-5"><div><Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)]" to="/settings?panel=admin-public-pages">Public presentation</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Administration</p><h1 className="mt-2 text-3xl font-semibold">Color palette</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Edit the public and settings color systems owned by the current Rust presentation contract.</p></div><button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!changed || busy || !draft} onClick={() => void save()} type="button"><Save className="size-4" />{busy ? 'Saving…' : 'Save changes'}</button></header>
            {error ? <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
            {!draft || !palette || !settingsPalette ? <p className="p-6 text-sm text-[var(--settings-muted-text)]">Loading color palette settings…</p> : <><div aria-label="Color palette sections" className="mb-5 flex gap-2 border-b border-[var(--settings-border-color)]" role="tablist"><SectionButton active={section === 'public'} label="Public text colors" onClick={() => setSection('public')} /><SectionButton active={section === 'settings'} label="Settings UI" onClick={() => setSection('settings')} /></div>{section === 'public' ? <section className="grid min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]"><div className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] xl:border-r xl:border-b-0"><div className="border-b border-[var(--settings-border-color)] p-5 text-sm leading-6 text-[var(--settings-muted-text)]">Public colors are used by the welcome page, auth pages, source page and public information pages.</div><div className="divide-y divide-[var(--settings-border-color)]">{fields.map(({ field, label }) => <PaletteFieldEditor field={field} key={field} label={label} onChange={update} palette={palette} storedPalette={storedPalette} />)}</div></div><div className="min-h-0 overflow-y-auto bg-[var(--settings-content-background)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">Live preview</p><h2 className="mt-1 text-lg font-semibold">Public text colors</h2></div><div className="flex items-center gap-1"><ModeSwitch mode={mode} onChange={setMode} /><div aria-label="Public text colors preview" className="ml-3 flex items-center gap-1" role="tablist"><PreviewButton active={preview === 'public'} label="Public pages" onClick={() => setPreview('public')} /><PreviewButton active={preview === 'login'} label="Login" onClick={() => setPreview('login')} /></div></div></div>{preview === 'public' ? <PublicPreview mode={mode} presentation={draft} /> : <LoginPreview mode={mode} presentation={draft} />}</div></section> : <SettingsPaletteEditor mode={mode} onChange={updateSettings} palette={settingsPalette} presentation={draft} preview={settingsPreview} storedPalette={storedSettingsPalette} onPreviewChange={setSettingsPreview} onModeChange={setMode} />}</>}
        </div>
    </PresentationLocalizationSettingsShell>;
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

function SectionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
    return <button aria-selected={active} className={`border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-[var(--settings-accent)] text-[var(--settings-accent)]' : 'border-transparent text-[var(--settings-muted-text)]'}`} onClick={onClick} role="tab" type="button">{label}</button>;
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

function SettingsPaletteEditor({ mode, onChange, onModeChange, onPreviewChange, palette, presentation, preview, storedPalette }: { mode: Mode; onChange: (field: SettingsPaletteField, color: string, opacity: number) => void; onModeChange: (mode: Mode) => void; onPreviewChange: (preview: 'settings' | 'controls') => void; palette: SettingsPalette; presentation: Presentation; preview: 'settings' | 'controls'; storedPalette?: SettingsPalette }) {
    return <section className="grid min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]"><div className="min-h-0 overflow-y-auto border-b border-[var(--settings-border-color)] xl:border-r xl:border-b-0"><div className="border-b border-[var(--settings-border-color)] p-5 text-sm leading-6 text-[var(--settings-muted-text)]">Settings UI colors control the accent marks, selected menu text, focus rings and active controls inside the settings workspace.</div><div className="divide-y divide-[var(--settings-border-color)]">{settingsFields.map(({ field, label }) => <SettingsPaletteFieldEditor field={field} key={field} label={label} onChange={onChange} palette={palette} storedPalette={storedPalette} />)}</div></div><div className="min-h-0 overflow-y-auto bg-[var(--settings-content-background)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium tracking-[0.16em] text-[var(--settings-accent)] uppercase">Live preview</p><h2 className="mt-1 text-lg font-semibold">Settings workspace</h2></div><div className="flex items-center gap-1"><ModeSwitch mode={mode} onChange={onModeChange} /><div aria-label="Settings UI preview" className="ml-3 flex items-center gap-1" role="tablist"><PreviewButton active={preview === 'settings'} label="Settings" onClick={() => onPreviewChange('settings')} /><PreviewButton active={preview === 'controls'} label="Controls" onClick={() => onPreviewChange('controls')} /></div></div></div>{preview === 'settings' ? <SettingsPreview mode={mode} presentation={presentation} /> : <SettingsControlsPreview mode={mode} presentation={presentation} />}</div></section>;
}

function SettingsPaletteFieldEditor({ field, label, onChange, palette, storedPalette }: { field: SettingsPaletteField; label: string; onChange: (field: SettingsPaletteField, color: string, opacity: number) => void; palette: SettingsPalette; storedPalette?: SettingsPalette }) {
    const opacityField = `${field}_opacity` as keyof SettingsPalette;
    const color = palette[field] as string;
    const opacity = palette[opacityField] as number;
    const reset = storedPalette?.[field] as string | undefined;
    const resetOpacity = storedPalette?.[opacityField] as number | undefined;
    return <div className="grid gap-3 p-5"><div className="flex items-center justify-between gap-3"><label className="text-sm font-medium">{label}</label>{reset !== undefined && (reset !== color || resetOpacity !== opacity) ? <button className="text-xs text-[var(--settings-accent)] hover:underline" onClick={() => onChange(field, reset, resetOpacity ?? 100)} type="button">Reset</button> : null}</div><div className="grid grid-cols-[auto_minmax(0,1fr)_5.5rem] gap-2"><input aria-label={`${label} picker`} className="h-9 w-12 cursor-pointer rounded border border-[var(--settings-border-color)] bg-transparent p-1" onChange={(event) => onChange(field, event.target.value, opacity)} type="color" value={isHexColor(color) ? color : '#000000'} /><input aria-label={label} className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" maxLength={64} onChange={(event) => onChange(field, event.target.value, opacity)} value={color} /><label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs text-[var(--settings-muted-text)]"><input aria-label={`${label} opacity`} className="w-full accent-[var(--settings-accent)]" max="100" min="0" onChange={(event) => onChange(field, color, boundedOpacity(event.target.value))} type="range" value={opacity} /><span>{opacity}%</span></label></div></div>;
}

function SettingsPreview({ mode, presentation }: { mode: Mode; presentation: Presentation }) {
    const style = settingsPresentationStyle(presentation, mode);
    return <section className="mt-5 grid gap-4 border p-4" style={{ ...style, background: 'var(--settings-content-background)', borderColor: 'var(--settings-border-color)', color: 'var(--settings-muted-text)' }}><div className="grid gap-4 lg:grid-cols-[10rem_10rem_minmax(0,1fr)]"><aside className="rounded-md border p-3" style={{ background: 'var(--settings-sidebar-background)', borderColor: 'var(--settings-border-color)' }}>{['Personal', 'World Builder', 'Color Palette'].map((item, index) => <div className="relative mt-2 rounded px-3 py-2 text-sm font-medium" key={item} style={index === 2 ? { background: 'var(--settings-active-background)', color: 'var(--settings-accent)' } : { color: 'var(--settings-muted-text)' }}>{index === 2 ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ background: 'var(--settings-accent)' }} /> : null}<span className="pl-2">{item}</span></div>)}</aside><aside className="rounded-md border p-3" style={{ background: 'var(--settings-nested-sidebar-background)', borderColor: 'var(--settings-border-color)' }}>{['Profile', 'Appearance', 'Sound'].map((item, index) => <div className="relative mt-2 rounded px-3 py-2 text-sm font-medium" key={item} style={index === 1 ? { background: 'var(--settings-active-background)', color: 'var(--settings-accent)' } : { color: 'var(--settings-muted-text)' }}>{index === 1 ? <span className="absolute inset-y-2 left-0 w-1 rounded-r-full" style={{ background: 'var(--settings-accent)' }} /> : null}<span className="pl-2">{item}</span></div>)}</aside><section className="rounded-md border p-4" style={{ background: 'var(--settings-panel-background)', borderColor: 'var(--settings-border-color)' }}><p className="text-xs font-semibold tracking-[0.16em] uppercase" style={{ color: 'var(--settings-accent)' }}>Settings eyebrow</p><h3 className="mt-2 text-xl font-semibold">Appearance</h3><p className="mt-2 text-sm" style={{ color: 'var(--settings-muted-text)' }}>Active menus, buttons, borders and muted text use these tokens.</p><div className="mt-5 flex flex-wrap gap-2"><button className="rounded-md px-4 py-2 text-sm font-semibold" style={{ background: 'var(--settings-accent)', color: 'var(--settings-accent-foreground)' }} type="button">Save changes</button><button className="rounded-md border px-4 py-2 text-sm" style={{ borderColor: 'var(--settings-border-color)', color: 'var(--settings-muted-text)' }} type="button">Secondary</button></div></section></div></section>;
}

function SettingsControlsPreview({ mode, presentation }: { mode: Mode; presentation: Presentation }) {
    const style = settingsPresentationStyle(presentation, mode);
    return <section className="mt-5 grid gap-4 rounded-md border p-5" style={{ ...style, background: 'var(--settings-content-background)', borderColor: 'var(--settings-border-color)', color: 'var(--settings-muted-text)' }}><div className="w-fit rounded-md border p-1" style={{ background: 'var(--settings-appearance-switch-background)', borderColor: 'var(--settings-border-color)' }}>{['System', 'Light', 'Dark'].map((item, index) => <button className="rounded px-4 py-2 text-sm font-medium" key={item} style={index === 0 ? { background: 'var(--settings-appearance-switch-active-background)', color: 'var(--settings-appearance-switch-active-text)' } : { color: 'var(--settings-appearance-switch-inactive-text)' }} type="button">{item}</button>)}</div><div className="rounded-md border p-4" style={{ background: 'var(--settings-panel-background)', borderColor: 'var(--settings-border-color)' }}><label className="text-sm font-medium">Site name</label><div className="mt-2 rounded-md border px-3 py-2 text-sm" style={{ background: 'var(--settings-input-background)', borderColor: 'var(--settings-input-border-color)', color: 'var(--settings-muted-text)' }}>Platform</div><p className="mt-2 text-xs" style={{ color: 'var(--settings-muted-text)' }}>Secondary helper text and quiet page context.</p></div></section>;
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
