import { BookOpen, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Activity = components['schemas']['AdminEditableActivity'];
type SourceRecord = components['schemas']['AdminSourceRecord'];
type SourceReference = components['schemas']['AdminActivitySourceReferenceInput'];

const blankReference = (): SourceReference => ({
    anchor: null,
    concepts: [],
    excerpt: null,
    published_at: null,
    publisher: null,
    rights: null,
    title: null,
    url: null,
});

export function OriginalActivitySourceReferencesDialog({
    activity,
    evidenceConceptOptions,
    onClose,
    onSaved,
    sourceRecords,
}: {
    activity: Activity;
    evidenceConceptOptions: string[];
    onClose: () => void;
    onSaved: () => void;
    sourceRecords: SourceRecord[];
}) {
    const [references, setReferences] = useState<SourceReference[]>(() => referencesFrom(activity));
    const [selectedRecordId, setSelectedRecordId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const update = (index: number, field: Exclude<keyof SourceReference, 'concepts'>, value: string) => {
        setReferences((current) => current.map((reference, candidateIndex) => candidateIndex === index ? { ...reference, [field]: value || null } : reference));
    };

    const addConcept = (index: number, concept: string) => {
        if (!concept) return;
        setReferences((current) => current.map((reference, candidateIndex) => candidateIndex === index && !reference.concepts.some((value) => value.toLowerCase() === concept.toLowerCase()) ? { ...reference, concepts: [...reference.concepts, concept] } : reference));
    };

    const addSavedRecord = () => {
        const source = sourceRecords.find((record) => record.id === selectedRecordId);
        if (!source || references.length >= 5) return;
        setReferences((current) => [...current, sourceReferenceFromRecord(source)]);
        setSelectedRecordId('');
    };

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH('/admin/world-builder/activities/{activity_id}/source-references', {
                body: { source_references: references, updated_at: activity.updated_at },
                params: { header: { 'X-CSRF-Token': token }, path: { activity_id: activity.id } },
            });
            if (response.status === 409) {
                setError('This activity changed while you were editing sources. Reload it and try again.');
                return;
            }
            if (!response.ok) throw new Error('source references unavailable');
            onSaved();
        } catch {
            setError('The source references could not be saved. Check your connection and try again.');
        } finally {
            setSaving(false);
        }
    };

    return <div aria-labelledby="activity-source-references-title" className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog"><form className="mx-auto my-6 max-w-4xl rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900" data-wl-id="authoring.activity-source-references" onSubmit={(event) => void save(event)}><header className="flex items-start justify-between gap-4"><div><p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-teal-700 uppercase dark:text-teal-300"><BookOpen className="size-4" />Inspectable learning context</p><h2 className="mt-1 text-xl font-semibold" id="activity-source-references-title">Source references</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Attach up to five copied citations to <strong>{activity.title}</strong>. Choosing a saved source copies it here, so later catalog edits never alter this activity’s evidence context.</p></div><button aria-label="Close source references" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button"><X className="size-5" /></button></header>
        <section className="mt-6 rounded-lg border border-slate-200 p-4 dark:border-white/10"><h3 className="text-sm font-semibold">Add a saved source</h3><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Saved source" className="min-w-56 flex-1 rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-white/20" onChange={(event) => setSelectedRecordId(event.target.value)} value={selectedRecordId}><option value="">Choose a saved source</option>{sourceRecords.map((source) => <option key={source.id} value={source.id}>{source.title}</option>)}</select><button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10" disabled={!selectedRecordId || references.length >= 5} onClick={addSavedRecord} type="button"><Plus className="size-4" />Attach copy</button></div>{sourceRecords.length === 0 ? <p className="mt-2 text-sm text-slate-500">No saved sources are available yet. Add a citation below or open the source catalog from the World Builder workspace.</p> : null}</section>
        <div className="mt-5 grid gap-4">{references.map((reference, index) => <article className="rounded-lg border border-slate-200 p-4 dark:border-white/10" key={index}><div className="flex items-center justify-between gap-3"><h3 className="font-medium">Source {index + 1}</h3><button aria-label={`Remove source ${index + 1}`} className="rounded p-2 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-300/10" onClick={() => setReferences((current) => current.filter((_, candidateIndex) => candidateIndex !== index))} type="button"><Trash2 className="size-4" /></button></div><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Title" onChange={(value) => update(index, 'title', value)} required value={reference.title ?? ''} /><Field label="URL" onChange={(value) => update(index, 'url', value)} required type="url" value={reference.url ?? ''} /><Field label="Publisher" onChange={(value) => update(index, 'publisher', value)} value={reference.publisher ?? ''} /><Field label="Published date" onChange={(value) => update(index, 'published_at', value)} type="date" value={reference.published_at ?? ''} /><Field label="Rights or licence" onChange={(value) => update(index, 'rights', value)} value={reference.rights ?? ''} /><Field label="Stable anchor" onChange={(value) => update(index, 'anchor', value)} value={reference.anchor ?? ''} /><label className="grid gap-1 text-sm font-medium md:col-span-2">Short excerpt or location note<textarea className="min-h-20 rounded-md border border-slate-300 bg-transparent px-3 py-2 font-normal dark:border-white/20" onChange={(event) => update(index, 'excerpt', event.target.value)} value={reference.excerpt ?? ''} /></label></div><div className="mt-3"><label className="grid gap-1 text-sm font-medium">Concepts<select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-white/20" onChange={(event) => { addConcept(index, event.target.value); event.currentTarget.value = ''; }} value=""><option value="">Choose a concept to add</option>{evidenceConceptOptions.filter((concept) => !reference.concepts.some((value) => value.toLowerCase() === concept.toLowerCase())).map((concept) => <option key={concept} value={concept}>{concept}</option>)}</select></label>{reference.concepts.length ? <div className="mt-2 flex flex-wrap gap-2">{reference.concepts.map((concept) => <button className="rounded-full border border-teal-300 bg-teal-50 px-2 py-1 text-xs text-teal-800 hover:bg-teal-100 dark:border-teal-300/30 dark:bg-teal-300/10 dark:text-teal-100" key={concept} onClick={() => setReferences((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, concepts: candidate.concepts.filter((value) => value !== concept) } : candidate))} type="button">{concept} ×</button>)}</div> : null}</div></article>)}</div>
        {references.length === 0 ? <p className="mt-5 text-sm text-slate-500">No sources attached yet.</p> : null}<div className="mt-5"><button className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10" disabled={references.length >= 5} onClick={() => setReferences((current) => [...current, blankReference()])} type="button"><Plus className="size-4" />Add citation</button></div>{error ? <p className="mt-4 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}<footer className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10"><button className="rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60" disabled={saving} type="submit"><Save className="size-4" />{saving ? 'Saving…' : 'Save source references'}</button></footer></form></div>;
}

function Field({ label, onChange, required = false, type = 'text', value }: { label: string; onChange: (value: string) => void; required?: boolean; type?: string; value: string }) {
    return <label className="grid gap-1 text-sm font-medium">{label}<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 font-normal dark:border-white/20" onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} /></label>;
}

function referencesFrom(activity: Activity): SourceReference[] {
    const references = activity.config.sourceReferences;
    if (!Array.isArray(references)) return [];
    return references.slice(0, 5).flatMap((reference) => {
        if (!reference || typeof reference !== 'object') return [];
        const value = reference as Record<string, unknown>;
        return [{ anchor: stringOrNull(value.anchor), concepts: stringArray(value.concepts), excerpt: stringOrNull(value.excerpt), published_at: stringOrNull(value.publishedAt), publisher: stringOrNull(value.publisher), rights: stringOrNull(value.rights), title: stringOrNull(value.title), url: stringOrNull(value.url) }];
    });
}

function sourceReferenceFromRecord(source: SourceRecord): SourceReference {
    return { anchor: source.anchor, concepts: source.concepts, excerpt: source.excerpt, published_at: source.published_at, publisher: source.publisher, rights: source.rights, title: source.title, url: source.url };
}

function stringOrNull(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : []; }
