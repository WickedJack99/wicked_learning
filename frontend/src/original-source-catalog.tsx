import {
    History,
    Pencil,
    Plus,
    RotateCcw,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { usePlatformTranslation } from './original-platform-translation';

type SourceRecord = components['schemas']['AdminSourceRecord'];
type SourceRecordPage = components['schemas']['AdminSourceRecordPage'];
type SourceVersionPage = components['schemas']['AdminSourceRecordVersionPage'];
type SourceRequest = components['schemas']['AdminSourceRecordRequest'];

const blank = (): SourceRequest => ({
    anchor: null,
    concepts: [],
    excerpt: null,
    published_at: null,
    publisher: null,
    rights: null,
    title: '',
    url: '',
});
const asForm = (source: SourceRecord): SourceRequest => ({
    anchor: source.anchor,
    concepts: source.concepts,
    excerpt: source.excerpt,
    published_at: source.published_at,
    publisher: source.publisher,
    rights: source.rights,
    title: source.title,
    url: source.url,
});

/**
 * Source-adapted from Laravel's ActivitySourceReferenceFields catalog pane.
 * It retains the same bounded catalog search, metadata edit, revision and
 * restore behavior while the later activity-form slice reconnects “use this
 * source” to every migrated activity type.
 */
export function OriginalSourceCatalogDialog({ onClose }: { onClose: () => void }) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState<SourceRecordPage | null>(null);
    const [search, setSearch] = useState('');
    const [concept, setConcept] = useState('');
    const [draft, setDraft] = useState<SourceRequest>(blank);
    const [editing, setEditing] = useState<SourceRecord | null>(null);
    const [versions, setVersions] = useState<SourceVersionPage | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async (nextPage = 1) => {
        setBusy(true);
        setError(null);
        try {
            const { data, response } = await apiClient.GET('/admin/source-records', {
                params: {
                    query: {
                        concept: concept || undefined,
                        page: nextPage,
                        per_page: 12,
                        search: search || undefined,
                    },
                },
            });
            if (!response.ok || !data) {
                throw new Error('catalog unavailable');
            }
            setPage(data);
        } catch {
            setError(t('settings.world_builder.source_catalog.load_error', 'The source catalog could not be loaded. Try again.'));
        } finally {
            setBusy(false);
        }
    }, [concept, search, t]);

    useEffect(() => {
        void load();
    }, [load]);

    const open = async (source: SourceRecord) => {
        setEditing(source);
        setDraft(asForm(source));
        setVersions(null);
        setError(null);
        setBusy(true);
        try {
            const { data, response } = await apiClient.GET('/admin/source-records/{source_id}/versions', {
                params: { path: { source_id: source.id }, query: { page: 1, per_page: 8 } },
            });
            if (!response.ok || !data) {
                throw new Error('history unavailable');
            }
            setVersions(data);
        } catch {
            setError(t('settings.world_builder.source_catalog.history_load_error', 'The source history could not be loaded.'));
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const request = editing
                ? apiClient.PATCH('/admin/source-records/{source_id}', {
                    body: draft,
                    params: { header: { 'X-CSRF-Token': token }, path: { source_id: editing.id } },
                })
                : apiClient.POST('/admin/source-records', {
                    body: draft,
                    params: { header: { 'X-CSRF-Token': token } },
                });
            const { data, response } = await request;
            if (!response.ok || !data) {
                throw new Error('save unavailable');
            }
            setEditing(data.source_record);
            setDraft(asForm(data.source_record));
            await load(page?.pagination.current_page ?? 1);
            if (editing) {
                await open(data.source_record);
            }
        } catch {
            setError(t('settings.world_builder.source_catalog.save_error', 'The source could not be saved. Check the required title and HTTPS URL.'));
        } finally {
            setBusy(false);
        }
    };

    const restore = async (versionId: string) => {
        if (!editing || !window.confirm(t('settings.world_builder.source_catalog.restore_confirm', 'Restore this source version? The current source will be preserved in history.'))) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/admin/source-records/{source_id}/versions/{version_id}', {
                params: {
                    header: { 'X-CSRF-Token': token },
                    path: { source_id: editing.id, version_id: versionId },
                },
            });
            if (!response.ok || !data) {
                throw new Error('restore unavailable');
            }
            setEditing(data.source_record);
            setDraft(asForm(data.source_record));
            await open(data.source_record);
            await load(page?.pagination.current_page ?? 1);
        } catch {
            setError(t('settings.world_builder.source_catalog.restore_error', 'This source version could not be restored.'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async () => {
        if (!editing || !window.confirm(t('settings.world_builder.source_catalog.delete_confirm', 'Delete this reusable source record? Existing copied activity references are unchanged.'))) {
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE('/admin/source-records/{source_id}', {
                params: { header: { 'X-CSRF-Token': token }, path: { source_id: editing.id } },
            });
            if (!response.ok) {
                throw new Error('delete unavailable');
            }
            setEditing(null);
            setDraft(blank);
            setVersions(null);
            await load();
        } catch {
            setError(t('settings.world_builder.source_catalog.delete_error', 'This source could not be deleted.'));
        } finally {
            setBusy(false);
        }
    };

    const update = <Key extends keyof SourceRequest>(key: Key, value: SourceRequest[Key]) => {
        setDraft((current) => ({ ...current, [key]: value }));
    };

    return (
        <div aria-labelledby="source-catalog-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" data-wl-id="authoring.source-catalog" role="dialog">
            <section className="max-h-[min(48rem,calc(100svh-2rem))] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300"><History className="size-4" />{t('settings.world_builder.source_catalog.eyebrow', 'Reusable sources')}</p>
                        <h2 className="mt-1 text-xl font-semibold" id="source-catalog-title">{t('settings.world_builder.source_catalog.title', 'Source catalog')}</h2>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{t('settings.world_builder.source_catalog.description', 'Save, search and revise reusable citations. Existing activity references keep their copied source details.')}</p>
                    </div>
                    <button aria-label={t('settings.world_builder.source_catalog.close', 'Close source catalog')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={onClose} type="button"><X className="size-5" /></button>
                </header>
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="status">{error}</p> : null}
                <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                    <div>
                        <div className="flex flex-wrap gap-2">
                            <label className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-slate-300 px-2 dark:border-white/20"><Search className="size-4 text-slate-500" /><input aria-label={t('settings.world_builder.source_catalog.search_label', 'Search sources')} className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" onChange={(event) => setSearch(event.target.value)} value={search} /></label>
                            <input aria-label={t('settings.world_builder.source_catalog.concept_filter_label', 'Filter sources by concept')} className="rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-white/20 dark:bg-slate-900" onChange={(event) => setConcept(event.target.value)} placeholder={t('settings.world_builder.source_catalog.concept_filter_placeholder', 'Concept')} value={concept} />
                            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={() => void load()} type="button">{t('settings.world_builder.source_catalog.search', 'Search')}</button>
                            <button className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800" onClick={() => { setEditing(null); setDraft(blank); setVersions(null); }} type="button"><Plus className="size-4" />{t('settings.world_builder.source_catalog.new', 'New source')}</button>
                        </div>
                        <div className="mt-3 grid gap-2">
                            {busy && !page ? <p className="text-sm text-slate-500">{t('settings.world_builder.source_catalog.loading', 'Loading source catalog…')}</p> : page?.items.length ? page.items.map((source) => <article className={`rounded-lg border p-3 ${editing?.id === source.id ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-slate-200 dark:border-white/10'}`} key={source.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{source.title}</h3><a className="break-all text-xs text-teal-700 underline dark:text-teal-300" href={source.url} rel="noreferrer" target="_blank">{source.url}</a>{source.concepts.length ? <p className="mt-1 text-xs text-slate-500">{source.concepts.join(' · ')}</p> : null}</div><button className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" onClick={() => void open(source)} type="button"><Pencil className="size-4" />{t('settings.world_builder.source_catalog.edit', 'Edit')}</button></div></article>) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-white/20">{t('settings.world_builder.source_catalog.empty', 'No saved source matches this catalog page.')}</p>}
                        </div>
                        {page ? <nav aria-label={t('settings.world_builder.source_catalog.pagination', 'Source catalog pagination')} className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">{t('settings.world_builder.source_catalog.page', 'Page :current of :total', { current: page.pagination.current_page, total: page.pagination.last_page })}</span><div className="flex gap-2"><button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-white/20" disabled={busy || page.pagination.current_page <= 1} onClick={() => void load(page.pagination.current_page - 1)} type="button">{t('settings.world_builder.source_catalog.previous', 'Previous')}</button><button className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50 dark:border-white/20" disabled={busy || page.pagination.current_page >= page.pagination.last_page} onClick={() => void load(page.pagination.current_page + 1)} type="button">{t('settings.world_builder.source_catalog.next', 'Next')}</button></div></nav> : null}
                    </div>
                    <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                        <h3 className="font-medium">{editing ? t('settings.world_builder.source_catalog.edit_title', 'Edit saved source') : t('settings.world_builder.source_catalog.new_title', 'New saved source')}</h3>
                        <SourceForm draft={draft} onChange={update} />
                        <div className="mt-3 flex flex-wrap justify-between gap-2"><div>{editing ? <button className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-300/10" disabled={busy} onClick={() => void remove()} type="button"><Trash2 className="size-4" />{t('settings.world_builder.source_catalog.delete', 'Delete')}</button> : null}</div><button className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60" disabled={busy} onClick={() => void save()} type="button"><Save className="size-4" />{busy ? t('settings.world_builder.source_catalog.saving', 'Saving…') : t('settings.world_builder.source_catalog.save', 'Save source')}</button></div>
                        {editing ? <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10"><h4 className="text-sm font-medium">{t('settings.world_builder.source_catalog.history', 'Source history')}</h4>{versions?.items.length ? <div className="mt-2 grid gap-2">{versions.items.map((version) => <div className="flex items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm dark:border-white/10" key={version.id}><span><strong>{version.source_record.title}</strong><br /><time className="text-xs text-slate-500">{new Date(version.created_at).toLocaleString()}</time></span><button className="inline-flex items-center gap-1 rounded px-2 py-1 text-teal-800 hover:bg-teal-50 disabled:opacity-60 dark:text-teal-200 dark:hover:bg-teal-300/10" disabled={busy} onClick={() => void restore(version.id)} type="button"><RotateCcw className="size-4" />{t('settings.world_builder.source_catalog.restore', 'Restore')}</button></div>)}</div> : <p className="mt-2 text-sm text-slate-500">{t('settings.world_builder.source_catalog.history_empty', 'No earlier source version yet. The first edit creates one.')}</p>}</div> : null}
                    </div>
                </div>
            </section>
        </div>
    );
}

function SourceForm({ draft, onChange }: { draft: SourceRequest; onChange: <Key extends keyof SourceRequest>(key: Key, value: SourceRequest[Key]) => void }) {
    const t = usePlatformTranslation();
    const text = (key: Exclude<keyof SourceRequest, 'concepts'>, label: string, required = false, type = 'text') => <label className="mt-3 block text-sm font-medium">{label}<input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-normal dark:border-white/20 dark:bg-slate-900" onChange={(event) => onChange(key, event.target.value || null)} required={required} type={type} value={(draft[key] ?? '') as string} /></label>;

    return <div>{text('title', t('settings.world_builder.source_catalog.field_title', 'Title'), true)}{text('url', t('settings.world_builder.source_catalog.field_url', 'URL'), true, 'url')}<div className="grid gap-3 sm:grid-cols-2">{text('publisher', t('settings.world_builder.source_catalog.field_publisher', 'Publisher'))}{text('published_at', t('settings.world_builder.source_catalog.field_published_at', 'Published date'), false, 'date')}</div>{text('rights', t('settings.world_builder.source_catalog.field_rights', 'Rights'))}{text('anchor', t('settings.world_builder.source_catalog.field_anchor', 'Anchor'))}{text('excerpt', t('settings.world_builder.source_catalog.field_excerpt', 'Excerpt'))}<label className="mt-3 block text-sm font-medium">{t('settings.world_builder.source_catalog.field_concepts', 'Concepts')} <span className="font-normal text-slate-500">{t('settings.world_builder.source_catalog.field_concepts_hint', '(comma-separated)')}</span><input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 font-normal dark:border-white/20 dark:bg-slate-900" onChange={(event) => onChange('concepts', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} value={(draft.concepts ?? []).join(', ')} /></label></div>;
}
