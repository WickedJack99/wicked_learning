import { Hammer, Image, LoaderCircle, Package, Plus, Save, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { MediaPicker } from './original-world-builder';

type Item = components['schemas']['AdminEditableItem'];
type ItemRequest = components['schemas']['AdminCatalogItemRequest'];
type Tool = components['schemas']['AdminEditableTool'];
type ToolRequest = components['schemas']['AdminCatalogToolRequest'];
type Kind = 'items' | 'tools';
type ImageField = 'image_dark' | 'image_light' | 'animation_dark' | 'animation_light';

type ItemForm = {
    description: string;
    image_dark: string;
    image_light: string;
    slug: string;
    title: string;
};

type ToolForm = ItemForm & {
    animation_dark: string;
    animation_duration_seconds: string;
    animation_light: string;
    animation_width_percent: string;
    image_width_percent: string;
};

const blankItem = (): ItemForm => ({ description: '', image_dark: '', image_light: '', slug: '', title: '' });
const blankTool = (): ToolForm => ({ ...blankItem(), animation_dark: '', animation_duration_seconds: '', animation_light: '', animation_width_percent: '', image_width_percent: '16' });
const itemForm = (item: Item): ItemForm => ({ description: item.description ?? '', image_dark: item.image_dark ?? '', image_light: item.image_light ?? '', slug: item.slug, title: item.title });
const toolForm = (tool: Tool): ToolForm => ({ ...itemForm(tool), animation_dark: tool.animation_dark ?? '', animation_duration_seconds: tool.animation_duration_seconds?.toString() ?? '', animation_light: tool.animation_light ?? '', animation_width_percent: tool.animation_width_percent?.toString() ?? '', image_width_percent: tool.image_width_percent.toString() });

/**
 * Source-adapted from Laravel's `settings/assets/items.tsx` and `tools.tsx`.
 * The source's searchable list, new-entry state and two-pane metadata editor
 * are kept; Rust replaces Inertia navigation with typed, same-origin commands.
 */
export function OriginalAssetCatalogPage({ kind }: { kind: Kind }) {
    const [items, setItems] = useState<Item[]>([]);
    const [tools, setTools] = useState<Tool[]>([]);
    const [selectedId, setSelectedId] = useState<string | 'new'>('new');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [picker, setPicker] = useState<ImageField | null>(null);

    const load = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            if (kind === 'items') {
                const { data, response } = await apiClient.GET('/admin/assets/items');
                if (!response.ok || !data) throw new Error('items unavailable');
                setItems(data.items);
                setSelectedId((current) => current !== 'new' && data.items.some((item) => item.id === current) ? current : data.items[0]?.id ?? 'new');
            } else {
                const { data, response } = await apiClient.GET('/admin/assets/tools');
                if (!response.ok || !data) throw new Error('tools unavailable');
                setTools(data.tools);
                setSelectedId((current) => current !== 'new' && data.tools.some((tool) => tool.id === current) ? current : data.tools[0]?.id ?? 'new');
            }
        } catch {
            setError(`The reusable ${kind === 'items' ? 'item' : 'tool'} library could not be loaded. Check your asset access and try again.`);
        } finally {
            setBusy(false);
        }
    }, [kind]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => { setSearch(''); setError(null); setNotice(null); setPicker(null); }, [kind]);

    const catalog = kind === 'items' ? items : tools;
    const selected = selectedId === 'new' ? null : catalog.find((entry) => entry.id === selectedId) ?? null;
    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return catalog;
        return catalog.filter((entry) => [entry.title, entry.slug, entry.description ?? ''].join(' ').toLowerCase().includes(needle));
    }, [catalog, search]);

    return <main className="min-h-svh bg-slate-100 px-4 py-5 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100" data-wl-id={`settings.assets.${kind}`}>
        <div className="mx-auto max-w-[92rem]">
            <Link className="inline-flex rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10" to="/settings?panel=admin-assets&asset=visuals">Assets &amp; World Objects</Link>
            <header className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-[.18em] text-teal-700 uppercase dark:text-teal-300">Administration</p><h1 className="mt-1 text-3xl font-semibold">{kind === 'items' ? 'Edit items' : 'Edit tools'}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{kind === 'items' ? 'Consumable or collectible inventory objects.' : 'Inspectable tools and map interaction helpers.'}</p></div><nav aria-label="Reusable world objects" className="flex rounded-lg border border-slate-300 p-1 text-sm dark:border-white/20"><Link className={`rounded-md px-3 py-2 ${kind === 'items' ? 'bg-teal-700 text-white' : 'hover:bg-slate-200 dark:hover:bg-white/10'}`} to="/settings?panel=admin-assets&asset=items">Items</Link><Link className={`rounded-md px-3 py-2 ${kind === 'tools' ? 'bg-teal-700 text-white' : 'hover:bg-slate-200 dark:hover:bg-white/10'}`} to="/settings?panel=admin-assets&asset=tools">Tools</Link></nav></header>
            {error ? <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
            {notice ? <p className="mt-4 rounded-md border border-teal-300 bg-teal-50 p-3 text-sm text-teal-950 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-100" role="status">{notice}</p> : null}
            <section className="mt-5 grid min-h-[42rem] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.55fr)]">
                {kind === 'items' ? <ItemEditor key={selected?.id ?? 'new'} onPick={setPicker} onSaved={(item) => { setItems((current) => sort([...current.filter((entry) => entry.id !== item.id), item])); setSelectedId(item.id); setNotice('Item saved.'); }} selected={selected as Item | null} setBusy={setBusy} setError={setError} busy={busy} /> : <ToolEditor key={selected?.id ?? 'new'} onPick={setPicker} onSaved={(tool) => { setTools((current) => sort([...current.filter((entry) => entry.id !== tool.id), tool])); setSelectedId(tool.id); setNotice('Tool saved.'); }} selected={selected as Tool | null} setBusy={setBusy} setError={setError} busy={busy} />}
                <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950"><div className="flex gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 px-2 dark:border-white/20"><Search className="size-4 text-slate-500" /><input aria-label={`Search ${kind}`} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" onChange={(event) => setSearch(event.currentTarget.value)} value={search} /></label><button className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={() => setSelectedId('new')} type="button"><Plus className="size-4" />New</button></div><div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">{filtered.map((entry) => <button className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === entry.id ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 dark:bg-teal-500/10' : 'border-slate-200 hover:border-teal-400 dark:border-white/10'}`} key={entry.id} onClick={() => setSelectedId(entry.id)} type="button"><span className="block truncate text-sm font-medium">{entry.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{entry.slug}{entry.description ? ` · ${entry.description}` : ''}</span></button>)}{!filtered.length ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/20">{busy ? 'Loading library…' : `No ${kind} match this search.`}</p> : null}</div></aside>
            </section>
        </div>
        {picker ? <MediaPicker onClose={() => setPicker(null)} onSelect={(asset) => { window.dispatchEvent(new CustomEvent('wicked-learning-catalog-media', { detail: { field: picker, url: asset.url } })); setPicker(null); }} /> : null}
    </main>;
}

function ItemEditor({ busy, onPick, onSaved, selected, setBusy, setError }: { busy: boolean; onPick: (field: ImageField) => void; onSaved: (item: Item) => void; selected: Item | null; setBusy: (value: boolean) => void; setError: (value: string | null) => void }) {
    const [form, setForm] = useCatalogForm<ItemForm>(selected ? itemForm(selected) : blankItem());
    async function save(): Promise<void> { const body: ItemRequest = { ...form, description: optional(form.description), image_dark: optional(form.image_dark), image_light: optional(form.image_light), slug: optional(form.slug) }; setBusy(true); setError(null); try { const token = await getCsrfToken(); const result = selected ? await apiClient.PATCH('/admin/assets/items/{item_id}', { body, params: { header: { 'X-CSRF-Token': token }, path: { item_id: selected.id } } }) : await apiClient.POST('/admin/assets/items', { body, params: { header: { 'X-CSRF-Token': token } } }); if (!result.response.ok || !result.data) throw new Error('save'); onSaved(result.data.item); } catch { setError('The item could not be saved. Name and slug must be unique, and all text and media fields are bounded.'); } finally { setBusy(false); } }
    return <EditorShell busy={busy} icon={<Package className="size-5" />} onSave={() => void save()} title={selected ? selected.title : 'New item'} saveLabel="Save item"><Text field="Item name" onChange={(value) => setForm((current) => ({ ...current, title: value }))} value={form.title} /><Text field="Slug" hint="Generated from the name when empty" onChange={(value) => setForm((current) => ({ ...current, slug: value }))} value={form.slug} /><Area field="Description" onChange={(value) => setForm((current) => ({ ...current, description: value }))} value={form.description} /><MediaFields fields={['image_dark', 'image_light']} form={form} labels={{ image_dark: 'Dark image', image_light: 'Light image' }} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} onPick={onPick} /></EditorShell>;
}

function ToolEditor({ busy, onPick, onSaved, selected, setBusy, setError }: { busy: boolean; onPick: (field: ImageField) => void; onSaved: (tool: Tool) => void; selected: Tool | null; setBusy: (value: boolean) => void; setError: (value: string | null) => void }) {
    const [form, setForm] = useCatalogForm<ToolForm>(selected ? toolForm(selected) : blankTool());
    async function save(): Promise<void> { const number = (value: string) => value.trim() ? Number(value) : null; const body: ToolRequest = { ...form, animation_dark: optional(form.animation_dark), animation_duration_seconds: number(form.animation_duration_seconds), animation_light: optional(form.animation_light), animation_width_percent: number(form.animation_width_percent), description: optional(form.description), image_dark: optional(form.image_dark), image_light: optional(form.image_light), image_width_percent: number(form.image_width_percent), slug: optional(form.slug) }; setBusy(true); setError(null); try { const token = await getCsrfToken(); const result = selected ? await apiClient.PATCH('/admin/assets/tools/{tool_id}', { body, params: { header: { 'X-CSRF-Token': token }, path: { tool_id: selected.id } } }) : await apiClient.POST('/admin/assets/tools', { body, params: { header: { 'X-CSRF-Token': token } } }); if (!result.response.ok || !result.data) throw new Error('save'); onSaved(result.data.tool); } catch { setError('The tool could not be saved. Name and slug must be unique; display dimensions and duration have source bounds.'); } finally { setBusy(false); } }
    return <EditorShell busy={busy} icon={<Hammer className="size-5" />} onSave={() => void save()} title={selected ? selected.title : 'Create tool'} saveLabel={selected ? 'Save tool' : 'Create tool'}><Text field="Tool name" onChange={(value) => setForm((current) => ({ ...current, title: value }))} value={form.title} /><Text field="Slug" hint="Generated from the name when empty" onChange={(value) => setForm((current) => ({ ...current, slug: value }))} value={form.slug} /><Area field="Description" onChange={(value) => setForm((current) => ({ ...current, description: value }))} value={form.description} /><MediaFields fields={['image_dark', 'image_light', 'animation_dark', 'animation_light']} form={form} labels={{ animation_dark: 'Dark animation GIF/WebP', animation_light: 'Light animation GIF/WebP', image_dark: 'Dark tool image', image_light: 'Light tool image' }} onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))} onPick={onPick} /><div className="grid gap-4 md:grid-cols-3"><Text field="Animation duration in seconds" onChange={(value) => setForm((current) => ({ ...current, animation_duration_seconds: value }))} type="number" value={form.animation_duration_seconds} /><Text field="Tool image width %" onChange={(value) => setForm((current) => ({ ...current, image_width_percent: value }))} type="number" value={form.image_width_percent} /><Text field="Animation width %" onChange={(value) => setForm((current) => ({ ...current, animation_width_percent: value }))} type="number" value={form.animation_width_percent} /></div></EditorShell>;
}

function useCatalogForm<T extends Record<string, string>>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [form, setForm] = useState(initial);
    useEffect(() => { const receive = (event: Event) => { const detail = (event as CustomEvent<{ field: keyof T; url: string }>).detail; if (detail) setForm((current) => ({ ...current, [detail.field]: detail.url })); }; window.addEventListener('wicked-learning-catalog-media', receive); return () => window.removeEventListener('wicked-learning-catalog-media', receive); }, []);
    return [form, setForm];
}

function EditorShell({ busy, children, icon, onSave, saveLabel, title }: { busy: boolean; children: React.ReactNode; icon: React.ReactNode; onSave: () => void; saveLabel: string; title: string }) { return <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950"><div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-white/10"><span className="flex size-10 items-center justify-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200">{icon}</span><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-slate-500">Reusable authoring catalog entry.</p></div></div><div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="grid gap-4">{children}</div></div><div className="border-t border-slate-200 p-4 dark:border-white/10"><button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} onClick={onSave} type="button">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{saveLabel}</button></div></section>; }
function Text({ field, hint, onChange, type = 'text', value }: { field: string; hint?: string; onChange: (value: string) => void; type?: 'number' | 'text'; value: string }) { return <label className="grid gap-1 text-sm font-medium">{field}<input aria-label={field} className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-teal-600 dark:border-white/20" onChange={(event) => onChange(event.currentTarget.value)} type={type} value={value} />{hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}</label>; }
function Area({ field, onChange, value }: { field: string; onChange: (value: string) => void; value: string }) { return <label className="grid gap-1 text-sm font-medium">{field}<textarea aria-label={field} className="min-h-28 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-teal-600 dark:border-white/20" onChange={(event) => onChange(event.currentTarget.value)} value={value} /></label>; }
function MediaFields<T extends Record<string, string>>({ fields, form, labels, onChange, onPick }: { fields: ImageField[]; form: T; labels: Partial<Record<ImageField, string>>; onChange: (field: ImageField, value: string) => void; onPick: (field: ImageField) => void }) { return <div className="grid gap-4 md:grid-cols-2">{fields.map((field) => <label className="grid gap-1 text-sm font-medium" key={field}>{labels[field]}<span className="flex gap-2"><input aria-label={labels[field]} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-teal-600 dark:border-white/20" onChange={(event) => onChange(field, event.currentTarget.value)} value={form[field] ?? ''} /><button aria-label={`Choose ${labels[field]}`} className="rounded border border-slate-300 px-3 text-xs hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={() => onPick(field)} type="button"><Image className="size-4" /></button></span></label>)}</div>; }
function optional(value: string): string | null { return value.trim() || null; }
function sort<T extends { title: string }>(entries: T[]): T[] { return entries.sort((left, right) => left.title.localeCompare(right.title)); }
