import { FileText, Github, Image, Images, LayoutPanelTop, LogIn, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { type CSSProperties, type Dispatch, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { publicPresentationStyle } from './public-presentation';

type Presentation = components['schemas']['PublicPresentation'];
type WelcomePage = components['schemas']['PublicWelcomePage'];
type WelcomeButton = components['schemas']['PublicWelcomeButton'];
type MediaAsset = components['schemas']['AdminMediaAsset'];
type MediaAssetPage = components['schemas']['AdminMediaAssetPage'];
type PublicPage = components['schemas']['PublicPage'];
type PublicSourceLinks = components['schemas']['PublicSourceLinks'];
type SourceLink = components['schemas']['PublicSourceLink'];
type Section = 'branding' | 'backgrounds' | 'welcome' | 'information' | 'source-links';
type Mode = 'dark' | 'light';
type AuthPage = 'login' | 'register' | 'welcome';

const authPages: Array<{ key: AuthPage; label: string; description: string }> = [
    { key: 'login', label: 'Login', description: 'Background imagery for the sign-in page.' },
    { key: 'register', label: 'Registration', description: 'Background imagery for invitation registration.' },
    { key: 'welcome', label: 'Welcome and public pages', description: 'Fallback imagery for welcome, information and source pages.' },
];

/** Source-adapted from `pages/settings/presentation.tsx`. This preserves the
 * Laravel editor's workspace structure, image controls and welcome-page
 * editing while swapping Inertia form glue for the typed Rust contract. */
export function OriginalPublicPresentationPage({ appearance }: { appearance: OriginalAppearance }) {
    const [presentation, setPresentation] = useState<Presentation | null>(null);
    const [draft, setDraft] = useState<Presentation | null>(null);
    const [section, setSection] = useState<Section>('branding');
    const [mode, setMode] = useState<Mode>('dark');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [informationPages, setInformationPages] = useState<PublicPage[] | null>(null);
    const [informationDrafts, setInformationDrafts] = useState<PublicPage[] | null>(null);
    const [sourceLinks, setSourceLinks] = useState<PublicSourceLinks | null>(null);
    const [sourceLinksDraft, setSourceLinksDraft] = useState<PublicSourceLinks | null>(null);

    useEffect(() => {
        let active = true;
        void apiClient.GET('/admin/public-presentation').then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) {
                setError('Public presentation settings are unavailable for this account.');
                return;
            }
            setPresentation(data);
            setDraft(structuredClone(data));
        }).catch(() => active && setError('Public presentation settings are temporarily unavailable.'));
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        void Promise.all([
            apiClient.GET('/admin/public-information-pages'),
            apiClient.GET('/admin/public-source-links'),
        ]).then(([pages, links]) => {
            if (!active) return;
            if (!pages.response.ok || !pages.data || !links.response.ok || !links.data) {
                setError('Public content settings are unavailable for this account.');
                return;
            }
            setInformationPages(pages.data);
            setInformationDrafts(structuredClone(pages.data));
            setSourceLinks(links.data);
            setSourceLinksDraft(structuredClone(links.data));
        }).catch(() => active && setError('Public content settings are temporarily unavailable.'));
        return () => { active = false; };
    }, []);

    const changed = Boolean(draft && presentation && JSON.stringify(draft) !== JSON.stringify(presentation));
    const informationChanged = Boolean(informationDrafts && informationPages && JSON.stringify(informationDrafts) !== JSON.stringify(informationPages));
    const sourceLinksChanged = Boolean(sourceLinksDraft && sourceLinks && JSON.stringify(sourceLinksDraft) !== JSON.stringify(sourceLinks));

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
            setPresentation(data);
            setDraft(structuredClone(data));
        } catch {
            setError('The public presentation could not be saved. Check its copy, colors, and selected images, then try again.');
        } finally {
            setBusy(false);
        }
    }

    async function saveInformationPages(): Promise<void> {
        if (!informationDrafts || !informationPages || !informationChanged || busy) return;
        setBusy(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const saved = await Promise.all(informationDrafts.map(async (page) => {
                const original = informationPages.find((item) => item.slug === page.slug);
                if (original?.body === page.body) return original;
                const { data, response } = await apiClient.PATCH('/admin/public-information-pages/{slug}', {
                    body: { body: page.body },
                    params: { header: { 'X-CSRF-Token': token }, path: { slug: page.slug as 'about' | 'imprint' | 'data-protection' } },
                });
                if (!response.ok || !data) throw new Error('save');
                return data;
            }));
            setInformationPages(saved);
            setInformationDrafts(structuredClone(saved));
        } catch {
            setError('The public information pages could not be saved. Keep markdown within 50,000 characters and try again.');
        } finally {
            setBusy(false);
        }
    }

    async function saveSourceLinks(): Promise<void> {
        if (!sourceLinksDraft || !sourceLinksChanged || busy) return;
        setBusy(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/public-source-links', {
                body: sourceLinksDraft,
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok || !data) throw new Error('save');
            setSourceLinks(data);
            setSourceLinksDraft(structuredClone(data));
        } catch {
            setError('The source links could not be saved. Use an HTTP(S) URL, an 80-character label, and at most twelve modified-source links.');
        } finally {
            setBusy(false);
        }
    }

    const saveCurrent = section === 'information' ? saveInformationPages : section === 'source-links' ? saveSourceLinks : save;
    const currentChanged = section === 'information' ? informationChanged : section === 'source-links' ? sourceLinksChanged : changed;

    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 pb-5">
                <div><Link className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings">Settings</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Administration</p><h1 className="mt-2 text-3xl font-semibold">Public presentation</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Configure the source-adapted branding, public pages, welcome sequence and AGPL source links. <Link className="font-medium text-[var(--settings-accent)] hover:underline" to="/settings?panel=admin-presentation-localization&presentation=palette">Public color palette</Link> and cursor images are configured in their source settings workspaces.</p></div>
                <button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50" disabled={!currentChanged || busy || !draft} onClick={() => void saveCurrent()} type="button"><Save className="size-4" />{busy ? 'Saving…' : 'Save changes'}</button>
            </header>
            {error ? <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}
            {!draft ? <p className="p-6 text-sm text-[var(--settings-muted-text)]">Loading public presentation settings…</p> : <section className="min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)]"><div className="grid h-full min-h-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="border-b border-[var(--settings-border-color)] p-3 lg:border-r lg:border-b-0"><SectionButton active={section === 'branding'} description="Logo used on public authentication surfaces." icon={<Image className="size-4" />} label="Branding" onClick={() => setSection('branding')} /><SectionButton active={section === 'backgrounds'} description="Public and authentication page imagery." icon={<LogIn className="size-4" />} label="Backgrounds" onClick={() => setSection('backgrounds')} /><SectionButton active={section === 'welcome'} description="Full-screen welcome sequence copy and actions." icon={<LayoutPanelTop className="size-4" />} label="Welcome pages" onClick={() => setSection('welcome')} /><SectionButton active={section === 'information'} description="About, imprint and data-protection markdown." icon={<FileText className="size-4" />} label="Information pages" onClick={() => setSection('information')} /><SectionButton active={section === 'source-links'} description="Original and deployment-modified source locations." icon={<Github className="size-4" />} label="Source links" onClick={() => setSection('source-links')} /></aside>
                <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--settings-border-color)] pb-4"><div><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Public presentation</p><h2 className="mt-2 text-2xl font-semibold">{section === 'branding' ? 'Branding' : section === 'backgrounds' ? 'Backgrounds' : section === 'welcome' ? 'Welcome pages' : section === 'information' ? 'Information pages' : 'Source links'}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{section === 'branding' ? 'Choose the shared platform logo.' : section === 'backgrounds' ? `Edit ${mode} mode background images.` : section === 'welcome' ? `Edit ${mode} mode welcome-page imagery. Copy and actions are shared across modes.` : section === 'information' ? 'Edit the fixed About, Imprint and Data protection markdown shown on public routes.' : 'Configure the upstream repository and deployment-specific modified source locations.'}</p></div>{section === 'backgrounds' || section === 'welcome' ? <ModeSwitch mode={mode} onChange={setMode} /> : null}</header>
                    {section === 'branding' ? <BrandingEditor value={draft.branding.logo} onChange={(logo) => setDraft((current) => current ? { ...current, branding: { ...current.branding, logo } } : current)} /> : null}
                    {section === 'backgrounds' ? <BackgroundsEditor draft={draft} mode={mode} onChange={setDraft} /> : null}
                    {section === 'welcome' ? <WelcomePagesEditor draft={draft} mode={mode} onChange={setDraft} /> : null}
                    {section === 'information' ? <InformationPagesEditor pages={informationDrafts} onChange={setInformationDrafts} /> : null}
                    {section === 'source-links' ? <SourceLinksEditor links={sourceLinksDraft} onChange={setSourceLinksDraft} /> : null}
                </div>
            </div></section>}
        </div>
    </main>;
}

function SectionButton({ active, description, icon, label, onClick }: { active: boolean; description: string; icon: ReactNode; label: string; onClick: () => void }) {
    return <button className={`mb-2 flex w-full items-start gap-3 rounded-md p-3 text-left ${active ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : 'hover:bg-[var(--settings-active-background)]'}`} onClick={onClick} type="button"><span className="mt-0.5">{icon}</span><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-[var(--settings-muted-text)]">{description}</span></span></button>;
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
    return <div aria-label="Appearance mode" className="inline-flex rounded-md border border-[var(--settings-border-color)] p-1"><button className={`rounded px-3 py-1.5 text-sm ${mode === 'dark' ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : ''}`} onClick={() => onChange('dark')} type="button">Dark</button><button className={`rounded px-3 py-1.5 text-sm ${mode === 'light' ? 'bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : ''}`} onClick={() => onChange('light')} type="button">Light</button></div>;
}

function BrandingEditor({ onChange, value }: { onChange: (value: string) => void; value: string }) {
    return <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]"><ImageInput description="This image appears on the sign-in, password recovery and registration surfaces. Transparent images work best." label="Platform logo" onChange={(value) => onChange(value ?? '')} value={value} /><div className="grid min-h-56 place-items-center rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-6"><img alt="Logo preview" className="max-h-36 max-w-full object-contain" src={value || '/images/logo.png'} /></div></section>;
}

function BackgroundsEditor({ draft, mode, onChange }: { draft: Presentation; mode: Mode; onChange: Dispatch<SetStateAction<Presentation | null>> }) {
    function update(page: AuthPage, background_image: string | null): void { onChange((current) => current ? { ...current, auth: { ...current.auth, [page]: { ...current.auth[page], [mode]: { ...current.auth[page][mode], background_image } } } } : current); }
    return <section className="mt-6 grid gap-5">{authPages.map((page) => <div className="border-b border-[var(--settings-border-color)] pb-5 last:border-b-0" key={page.key}><h3 className="font-semibold">{page.label}</h3><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">{page.description}</p><div className="mt-4"><ImageInput description={`Displayed in ${mode} mode. Upload a fresh visual or select an existing reusable visual.`} label={`${capitalize(mode)} mode background`} onChange={(background_image) => update(page.key, background_image)} value={draft.auth[page.key][mode].background_image} /></div></div>)}</section>;
}

function WelcomePagesEditor({ draft, mode, onChange }: { draft: Presentation; mode: Mode; onChange: Dispatch<SetStateAction<Presentation | null>> }) {
    function update(index: number, updater: (page: WelcomePage) => WelcomePage): void { onChange((current) => current ? { ...current, welcome: { pages: current.welcome.pages.map((page, pageIndex) => pageIndex === index ? updater(page) : page) } } : current); }
    function remove(index: number): void { onChange((current) => current && current.welcome.pages.length > 1 ? { ...current, welcome: { pages: current.welcome.pages.filter((_, pageIndex) => pageIndex !== index) } } : current); }
    function add(): void { onChange((current) => !current || current.welcome.pages.length >= 12 ? current : { ...current, welcome: { pages: [...current.welcome.pages, blankWelcomePage()] } }); }
    return <section className="mt-6 grid gap-5"><div className="flex justify-end"><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-3 py-2 text-sm disabled:opacity-50" disabled={draft.welcome.pages.length >= 12} onClick={add} type="button"><Plus className="size-4" />Add page</button></div>{draft.welcome.pages.map((page, index) => <article className="rounded-lg border border-[var(--settings-border-color)] p-4" key={`${page.title}-${index}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold">Page {index + 1}</p><p className="mt-1 text-xs text-[var(--settings-muted-text)]">A page is always retained so the anonymous welcome route remains orienting.</p></div><button aria-label={`Remove welcome page ${index + 1}`} className="rounded p-2 text-red-700 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-300" disabled={draft.welcome.pages.length <= 1} onClick={() => remove(index)} type="button"><Trash2 className="size-4" /></button></div><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><TextInput label="Eyebrow" onChange={(eyebrow) => update(index, (current) => ({ ...current, eyebrow }))} value={page.eyebrow} /><TextInput label="Title" onChange={(title) => update(index, (current) => ({ ...current, title }))} value={page.title} /></div><Textarea label="Body" onChange={(body) => update(index, (current) => ({ ...current, body }))} value={page.body} /><ImageInput description={`Displayed behind this welcome page in ${mode} mode.`} label={`${capitalize(mode)} mode page background`} onChange={(image) => update(index, (current) => ({ ...current, backgrounds: { ...current.backgrounds, [mode]: image } }))} value={page.backgrounds[mode]} /><WelcomeButtons buttons={page.buttons} onChange={(buttons) => update(index, (current) => ({ ...current, buttons }))} /></div><WelcomePreview mode={mode} page={page} presentation={draft} /></div></article>)}</section>;
}

function WelcomeButtons({ buttons, onChange }: { buttons: WelcomeButton[]; onChange: (buttons: WelcomeButton[]) => void }) {
    const update = (index: number, key: keyof WelcomeButton, value: string) => onChange(buttons.map((button, buttonIndex) => buttonIndex === index ? { ...button, [key]: value } : button));
    return <section className="border-t border-[var(--settings-border-color)] pt-4"><div className="flex items-center justify-between gap-3"><div><h4 className="font-medium">Actions</h4><p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">Source welcome actions use the application’s existing destinations.</p></div><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-2 py-1.5 text-sm disabled:opacity-50" disabled={buttons.length >= 6} onClick={() => onChange([...buttons, { text: 'New button', target: '/world' }])} type="button"><Plus className="size-4" />Add action</button></div>{buttons.map((button, index) => <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" key={`${button.text}-${index}`}><TextInput label={`Action ${index + 1} label`} onChange={(value) => update(index, 'text', value)} value={button.text} /><TextInput label={`Action ${index + 1} destination`} onChange={(value) => update(index, 'target', value)} value={button.target} /><button aria-label={`Remove action ${index + 1}`} className="self-end rounded p-2 text-red-700 hover:bg-red-500/10 dark:text-red-300" onClick={() => onChange(buttons.filter((_, buttonIndex) => buttonIndex !== index))} type="button"><Trash2 className="size-4" /></button></div>)}</section>;
}

function InformationPagesEditor({ onChange, pages }: { onChange: Dispatch<SetStateAction<PublicPage[] | null>>; pages: PublicPage[] | null }) {
    if (!pages) return <p className="mt-6 text-sm text-[var(--settings-muted-text)]">Loading public information pages…</p>;
    return <section className="mt-6 grid gap-5">{pages.map((page) => <article className="rounded-lg border border-[var(--settings-border-color)] p-4" key={page.slug}><div><h3 className="font-semibold">{page.title}</h3><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">Markdown shown at /{page.slug}. The route and page title remain the fixed source public-information surface.</p></div><Textarea label={`${page.title} markdown`} onChange={(body) => onChange((current) => current?.map((item) => item.slug === page.slug ? { ...item, body } : item) ?? current)} value={page.body} /></article>)}</section>;
}

function SourceLinksEditor({ links, onChange }: { links: PublicSourceLinks | null; onChange: Dispatch<SetStateAction<PublicSourceLinks | null>> }) {
    const changeOrigin = (key: keyof SourceLink, value: string) => onChange((current) => current ? { ...current, origin: { ...current.origin, [key]: value } } : current);
    const changeModified = (index: number, key: keyof SourceLink, value: string) => onChange((current) => current ? { ...current, modified_sources: current.modified_sources.map((link, linkIndex) => linkIndex === index ? { ...link, [key]: value } : link) } : current);
    if (!links) return <p className="mt-6 text-sm text-[var(--settings-muted-text)]">Loading source-link settings…</p>;
    return <section className="mt-6 grid gap-5"><article className="rounded-lg border border-[var(--settings-border-color)] p-4"><h3 className="font-semibold">Origin</h3><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">The upstream source repository shown first on the public source-code page.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><TextInput label="Button label" onChange={(label) => changeOrigin('label', label)} value={links.origin.label} /><TextInput label="Repository URL" onChange={(url) => changeOrigin('url', url)} value={links.origin.url} /></div></article><div className="flex justify-end"><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-3 py-2 text-sm disabled:opacity-50" disabled={links.modified_sources.length >= 12} onClick={() => onChange((current) => current ? { ...current, modified_sources: [...current.modified_sources, { label: 'Modified source', url: 'https://github.com/example/example' }] } : current)} type="button"><Plus className="size-4" />Add modified source</button></div>{links.modified_sources.map((link, index) => <article className="rounded-lg border border-[var(--settings-border-color)] p-4" key={`${link.url}-${index}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Modified source {index + 1}</h3><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">A public source location for this deployment or a modified version.</p></div><button aria-label={`Remove modified source ${index + 1}`} className="rounded p-2 text-red-700 hover:bg-red-500/10 dark:text-red-300" onClick={() => onChange((current) => current ? { ...current, modified_sources: current.modified_sources.filter((_, linkIndex) => linkIndex !== index) } : current)} type="button"><Trash2 className="size-4" /></button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><TextInput label="Button label" onChange={(label) => changeModified(index, 'label', label)} value={link.label} /><TextInput label="Source URL" onChange={(url) => changeModified(index, 'url', url)} value={link.url} /></div></article>)}</section>;
}

export function ImageInput({ description, label, onChange, value }: { description: string; label: string; onChange: (value: string | null) => void; value: string | null }) {
    const [uploading, setUploading] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const upload = useRef<HTMLInputElement>(null);
    async function uploadImage(file: File | null): Promise<void> { if (!file) return; setUploading(true); setUploadError(''); try { const token = await getCsrfToken(); const form = new FormData(); form.append('file', file); const response = await fetch('/api/v1/admin/media-assets', { body: form, credentials: 'same-origin', headers: { 'X-CSRF-Token': token }, method: 'POST' }); if (!response.ok) throw new Error('upload'); const data = await response.json() as { asset: MediaAsset }; onChange(data.asset.url); } catch { setUploadError('This image could not be stored. Use a GIF, JPEG, PNG, WebP, or SVG under 5 MiB.'); } finally { setUploading(false); if (upload.current) upload.current.value = ''; } }
    return <div className="grid gap-2"><div><label className="font-medium">{label}</label><p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">{description}</p></div><input aria-label={label} className="w-full rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" onChange={(event) => onChange(event.target.value || null)} placeholder="/images/themes/example.png" value={value ?? ''} />{value ? <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 border border-[var(--settings-border-color)] p-2"><img alt="" className="size-12 object-contain" src={value} /><span className="truncate text-xs text-[var(--settings-muted-text)]">{value}</span></div> : null}{uploadError ? <p className="text-sm text-red-700 dark:text-red-200" role="alert">{uploadError}</p> : null}<div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-3 py-1.5 text-sm disabled:opacity-50" disabled={uploading} onClick={() => upload.current?.click()} type="button"><Upload className="size-4" />{uploading ? 'Uploading…' : 'Upload'}</button><input accept="image/gif,image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0] ?? null)} ref={upload} type="file" /><button className="inline-flex items-center gap-1 rounded border border-[var(--settings-border-color)] px-3 py-1.5 text-sm" onClick={() => setPickerOpen(true)} type="button"><Images className="size-4" />Select existing</button><button className="rounded px-3 py-1.5 text-sm hover:bg-[var(--settings-active-background)]" onClick={() => onChange(null)} type="button">Clear</button></div>{pickerOpen ? <MediaPicker onClose={() => setPickerOpen(false)} onSelect={(asset) => { onChange(asset.url); setPickerOpen(false); }} /> : null}</div>;
}

function MediaPicker({ onClose, onSelect }: { onClose: () => void; onSelect: (asset: MediaAsset) => void }) {
    const [page, setPage] = useState<MediaAssetPage | null>(null); const [error, setError] = useState('');
    useEffect(() => { let active = true; void apiClient.GET('/admin/media-assets', { params: { query: { page: 1, per_page: 12 } } }).then(({ data, response }) => { if (!active) return; if (!response.ok || !data) { setError('Reusable visuals are unavailable for this account.'); return; } setPage(data); }).catch(() => active && setError('Reusable visuals are unavailable for this account.')); return () => { active = false; }; }, []);
    return <div aria-label="Select existing visual" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4" role="dialog"><div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Select existing visual</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">The saved presentation holds a stable Rust-owned media reference.</p></div><button aria-label="Close media picker" className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="size-5" /></button></div>{error ? <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">{error}</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">{page?.items.map((asset) => <button className="overflow-hidden rounded-lg border border-slate-200 text-left hover:border-teal-500 dark:border-white/10" key={asset.id} onClick={() => onSelect(asset)} type="button"><div className="grid aspect-video place-items-center bg-slate-100 dark:bg-slate-900"><img alt="" className="max-h-full max-w-full object-contain" src={asset.url} /></div><span className="block p-3 text-sm font-medium">{asset.display_name}</span></button>) ?? <p className="col-span-full py-6 text-sm text-slate-500">Loading visuals…</p>}</div>}</div></div>;
}

function TextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) { return <label className="grid gap-1 text-sm font-medium">{label}<input className="rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm" onChange={(event) => onChange(event.target.value)} value={value} /></label>; }
function Textarea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) { return <label className="grid gap-1 text-sm font-medium">{label}<textarea className="min-h-28 rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm leading-6" onChange={(event) => onChange(event.target.value)} value={value} /></label>; }
function WelcomePreview({ mode, page, presentation }: { mode: Mode; page: WelcomePage; presentation: Presentation }) { const style = publicPresentationStyle(presentation, mode, 'welcome'); const background = page.backgrounds[mode] ?? presentation.auth.welcome[mode].background_image; return <div className="relative min-h-64 overflow-hidden rounded-lg border border-[var(--settings-border-color)] bg-[var(--auth-background-color)] p-5" style={style}><div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: background ? `url(${background})` : 'none' }} /><div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--public-welcome-overlay)' }} /><div className="relative z-10"><p className="text-xs font-medium tracking-[.18em] uppercase" style={{ color: 'var(--public-accent)' }}>{page.eyebrow}</p><h3 className="mt-3 text-2xl font-semibold" style={{ color: 'var(--public-heading-text)' }}>{page.title}</h3><p className="mt-3 text-sm leading-6" style={{ color: 'var(--public-body-text)' }}>{page.body}</p></div></div>; }
function blankWelcomePage(): WelcomePage { return { backgrounds: { dark: null, light: null }, body: 'Describe this public welcome page.', buttons: [{ text: 'Open learning desk', target: '/world' }], eyebrow: 'New page', title: 'New welcome page' }; }
function capitalize(value: string): string { return `${value.charAt(0).toUpperCase()}${value.slice(1)}`; }
function settingsStyle(appearance: OriginalAppearance): CSSProperties { const dark = appearance === 'dark'; return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties; }
