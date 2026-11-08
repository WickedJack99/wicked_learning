import { Download, Image, Pencil, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Asset = components['schemas']['AdminMediaAsset'];
type AssetPage = components['schemas']['AdminMediaAssetPage'];
type Metadata = components['schemas']['AdminMediaAssetMetadataRequest'];

const blankMetadata = (): Metadata => ({ category: null, display_name: null, has_transparency: null, is_animated: null, tags: [] });
const metadataOf = (asset: Asset): Metadata => ({ category: asset.category, display_name: asset.display_name, has_transparency: asset.has_transparency, is_animated: asset.is_animated, tags: asset.tags });

/** Source-adapted from `settings/assets/media.tsx`'s reusable visual workspace. */
export function OriginalMediaLibraryPage() {
    const [page, setPage] = useState<AssetPage | null>(null);
    const [selected, setSelected] = useState<Asset | null>(null);
    const [draft, setDraft] = useState<Metadata>(blankMetadata);
    const [search, setSearch] = useState('');
    const [tag, setTag] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const uploadInput = useRef<HTMLInputElement>(null);
    const replaceInput = useRef<HTMLInputElement>(null);

    const load = useCallback(async (nextPage = 1) => {
        setBusy(true); setError(null);
        try {
            const { data, response } = await apiClient.GET('/admin/media-assets', { params: { query: { page: nextPage, per_page: 12, q: search || undefined, tag: tag || undefined } } });
            if (!response.ok || !data) throw new Error('unavailable');
            setPage(data);
            setSelected((current) => data.items.find((asset) => asset.id === current?.id) ?? data.items[0] ?? null);
        } catch { setError('The visual library could not be loaded. Check your asset access and try again.'); }
        finally { setBusy(false); }
    }, [search, tag]);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => { setDraft(selected ? metadataOf(selected) : blankMetadata()); }, [selected]);

    async function sendFile(url: string, file: File): Promise<Asset | null> {
        const token = await getCsrfToken();
        const form = new FormData(); form.append('file', file);
        const response = await fetch(`/api/v1${url}`, { body: form, credentials: 'same-origin', headers: { 'X-CSRF-Token': token }, method: 'POST' });
        if (!response.ok) return null;
        return (await response.json() as { asset: Asset }).asset;
    }

    const upload = async (file: File | null) => {
        if (!file) return;
        setBusy(true); setError(null);
        try {
            const asset = await sendFile('/admin/media-assets', file);
            if (!asset) throw new Error('upload');
            await load(); setSelected(asset);
        } catch { setError('This file could not be stored. Use a GIF, JPEG, PNG, WebP, or SVG under 5 MiB.'); }
        finally { setBusy(false); if (uploadInput.current) uploadInput.current.value = ''; }
    };

    const replace = async (file: File | null) => {
        if (!file || !selected) return;
        if (!window.confirm(`Replace ${selected.display_name}? Existing references keep this visual link.`)) return;
        setBusy(true); setError(null);
        try {
            const asset = await sendFile(`/admin/media-assets/${selected.id}/replace`, file);
            if (!asset) throw new Error('replace');
            setSelected(asset); await load(page?.pagination.page ?? 1);
        } catch { setError('The visual could not be replaced.'); }
        finally { setBusy(false); if (replaceInput.current) replaceInput.current.value = ''; }
    };

    const saveMetadata = async () => {
        if (!selected) return;
        setBusy(true); setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/media-assets/{asset_id}', { params: { header: { 'X-CSRF-Token': token }, path: { asset_id: selected.id } }, body: draft });
            if (!response.ok || !data) throw new Error('metadata');
            setSelected(data.asset); await load(page?.pagination.page ?? 1);
        } catch { setError('The visual metadata could not be saved. Names, categories, and tags are bounded.'); }
        finally { setBusy(false); }
    };

    const remove = async () => {
        if (!selected || !selected.can_delete) return;
        const referenceNote = selected.reference_count ? ` It is used by ${selected.reference_count} saved reference${selected.reference_count === 1 ? '' : 's'} and cannot be removed until those links are changed.` : ' It is not currently used by saved content.';
        if (!window.confirm(`Delete ${selected.display_name}?${referenceNote}`)) return;
        setBusy(true); setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE('/admin/media-assets/{asset_id}', { params: { header: { 'X-CSRF-Token': token }, path: { asset_id: selected.id } } });
            if (!response.ok) throw new Error('delete');
            setSelected(null); await load(page?.pagination.page ?? 1);
        } catch { setError('This visual could not be deleted. It may still be used by saved content.'); }
        finally { setBusy(false); }
    };

    return <main className="min-h-svh bg-slate-100 px-4 py-5 text-slate-950 dark:bg-[#0b1117] dark:text-slate-100" data-wl-id="settings.assets.media">
        <div className="mx-auto max-w-[92rem]"><Link className="inline-flex rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10" to="/settings">Settings</Link>
            <header className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-medium tracking-[.18em] text-teal-700 uppercase dark:text-teal-300">Assets</p><h1 className="mt-1 text-3xl font-semibold">Visual library</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Upload, search, preview, replace and describe reusable visuals. Replacing keeps saved Rust-owned references stable; referenced visuals are protected from deletion.</p></div><button className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50" disabled={busy} onClick={() => uploadInput.current?.click()} type="button"><Plus className="size-4" />Add visual</button><input accept="image/gif,image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => void upload(event.target.files?.[0] ?? null)} ref={uploadInput} type="file" /></header>
            {error ? <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="alert">{error}</p> : null}
            <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,.75fr)]"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950"><div className="flex flex-wrap gap-2"><label className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-slate-300 px-2 dark:border-white/20"><Search className="size-4 text-slate-500" /><input aria-label="Search visuals" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" onChange={(event) => setSearch(event.target.value)} value={search} /></label><input aria-label="Filter visuals by tag" className="rounded-md border border-slate-300 bg-transparent px-2 py-2 text-sm dark:border-white/20" onChange={(event) => setTag(event.target.value)} placeholder="Tag" value={tag} /><button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" disabled={busy} onClick={() => void load()} type="button">Search</button></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{page?.items.length ? page.items.map((asset) => <button className={`overflow-hidden rounded-lg border text-left transition ${selected?.id === asset.id ? 'border-teal-500 ring-2 ring-teal-500/25' : 'border-slate-200 hover:border-teal-400 dark:border-white/10'}`} key={asset.id} onClick={() => setSelected(asset)} type="button"><div className="grid aspect-video place-items-center bg-slate-100 dark:bg-slate-900"><img alt="" className="max-h-full max-w-full object-contain" src={asset.url} /></div><span className="block p-3"><strong className="block truncate text-sm">{asset.display_name}</strong><span className="mt-1 block truncate text-xs text-slate-500">{asset.tags.join(' · ') || asset.content_type}</span></span></button>) : <p className="col-span-full rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20">{busy ? 'Loading visual library…' : 'No saved visual matches this page.'}</p>}</div>
                {page ? <nav aria-label="Visual library pagination" className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">Page {page.pagination.page} of {page.pagination.last_page}</span><span className="flex gap-2"><button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-white/20" disabled={busy || page.pagination.page <= 1} onClick={() => void load(page.pagination.page - 1)} type="button">Previous</button><button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-white/20" disabled={busy || page.pagination.page >= page.pagination.last_page} onClick={() => void load(page.pagination.page + 1)} type="button">Next</button></span></nav> : null}</div>
                <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950">{selected ? <><div className="grid aspect-video place-items-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900"><img alt={`Preview of ${selected.display_name}`} className="max-h-full max-w-full object-contain" src={selected.url} /></div><div className="mt-4 flex flex-wrap gap-2"><button className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={() => replaceInput.current?.click()} type="button"><Upload className="size-4" />Replace</button><a className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" href={`${selected.url}?download=true`}><Download className="size-4" />Download</a>{selected.can_delete ? <button className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-300/10" onClick={() => void remove()} type="button"><Trash2 className="size-4" />Delete</button> : null}<input accept="image/gif,image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => void replace(event.target.files?.[0] ?? null)} ref={replaceInput} type="file" /></div><p className="mt-3 text-xs leading-5 text-slate-500">{selected.reference_count ? `Used by ${selected.reference_count} saved reference${selected.reference_count === 1 ? '' : 's'}.` : 'Not currently used by saved Rust content.'}</p><form className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10" onSubmit={(event) => { event.preventDefault(); void saveMetadata(); }}><h2 className="inline-flex items-center gap-2 font-medium"><Pencil className="size-4" />Visual details</h2><Field label="Name"><input aria-label="Visual name" className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" onChange={(event) => setDraft((value) => ({ ...value, display_name: event.target.value || null }))} value={draft.display_name ?? ''} /></Field><Field label="Category"><input aria-label="Visual category" className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value || null }))} value={draft.category ?? ''} /></Field><Field label="Tags"><input aria-label="Visual tags" className="mt-1 w-full rounded-md border border-slate-300 bg-transparent px-2 py-1.5 text-sm dark:border-white/20" onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) }))} value={(draft.tags ?? []).join(', ')} /></Field><label className="mt-3 flex items-center gap-2 text-sm"><input checked={draft.has_transparency === true} onChange={(event) => setDraft((value) => ({ ...value, has_transparency: event.target.checked }))} type="checkbox" />Has transparency</label><label className="mt-2 flex items-center gap-2 text-sm"><input checked={draft.is_animated === true} onChange={(event) => setDraft((value) => ({ ...value, is_animated: event.target.checked }))} type="checkbox" />Is animated</label><button className="mt-4 inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy} type="submit"><Save className="size-4" />Save details</button></form></> : <div className="grid min-h-80 place-items-center text-center text-sm text-slate-500"><span><Image className="mx-auto mb-2 size-7" />Select a visual to preview and edit it.</span></div>}</aside></section></div>
    </main>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="mt-3 block text-sm font-medium">{label}{children}</label>; }
