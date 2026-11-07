import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, GripVertical, Plus, Save } from 'lucide-react';
import { type DragEvent, type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type TopicAdministration = components['schemas']['AdminTopicAdministration'];
type TopicArea = components['schemas']['AdminTopicArea'];
type Topic = components['schemas']['AdminTopic'];
type AreaForm = { title: string; description: string };
type TopicForm = { title: string; description: string; content: string; parentId: string; isPublished: boolean };

const inputClass = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-violet-500 focus:ring-3 focus:ring-violet-500/12 dark:border-white/25 dark:bg-white/[0.035] dark:text-white';
const primaryButtonClass = 'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-violet-500/50 bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500/25 dark:text-violet-100 dark:hover:bg-violet-500/35';
const secondaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/6';

/** Source-adapted from the Laravel `TopicAdministration` workspace. */
export function OriginalTopicAdministrationPage() {
    const [data, setData] = useState<TopicAdministration | null>(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [draggingAreaId, setDraggingAreaId] = useState<string | null>(null);

    function load(): void {
        setLoading(true);
        void apiClient.GET('/admin/topics').then(({ data: responseData, response }) => {
            if ([401, 403, 404].includes(response.status)) { setForbidden(true); return; }
            if (!response.ok || !responseData) throw new Error('unavailable');
            setData(responseData); setError(''); setRevision((current) => current + 1);
        }).catch(() => setError('Topic structure is temporarily unavailable.')).finally(() => setLoading(false));
    }
    useEffect(load, []);

    async function reorderAreas(areaIds: string[]): Promise<void> {
        setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH('/admin/topic-areas/reorder', { body: { area_ids: areaIds }, params: { header: { 'X-CSRF-Token': token } } });
            if (!response.ok) throw new Error('invalid');
            load();
        } catch { setError('The topic-area order could not be saved.'); }
    }
    function moveArea(areaId: string, targetIndex: number): void {
        const areaIds = data?.areas.map((area) => area.id) ?? [];
        const sourceIndex = areaIds.indexOf(areaId);
        if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= areaIds.length || sourceIndex === targetIndex) return;
        areaIds.splice(sourceIndex, 1); areaIds.splice(targetIndex, 0, areaId); void reorderAreas(areaIds);
    }
    function dropArea(event: DragEvent<HTMLElement>, targetIndex: number): void {
        event.preventDefault(); if (draggingAreaId !== null) moveArea(draggingAreaId, targetIndex); setDraggingAreaId(null);
    }
    if (forbidden) return <Navigate replace to="/home" />;
    return <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#08111b] dark:text-slate-100" data-wl-id="admin.topics"><div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:px-12 lg:py-12">
        <Link className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300" to="/topics"><ArrowLeft className="size-4" />Back to topics</Link>
        <header className="mt-7 border-b border-slate-200 pb-7 dark:border-white/10"><p className="text-xs font-semibold tracking-[0.2em] text-violet-600 uppercase dark:text-violet-400">Content administration</p><h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Topic structure</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Drag broad areas into the desired order. Topics and subtopics are displayed alphabetically inside their area.</p></header>
        {error ? <p className="mt-5 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}
        {loading ? <p className="py-10 text-sm text-slate-500 dark:text-slate-400">Loading topic structure…</p> : data ? <><CreateAreaForm areas={data.areas} onSaved={load} /><div className="mt-12 space-y-8" data-wl-id="admin.topics.areas">{data.areas.map((area, index) => <section className="border-y border-slate-200 bg-white/40 dark:border-white/10 dark:bg-white/[0.015]" data-wl-id="admin.topics.area" key={`${revision}-${area.id}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropArea(event, index)}><div className="flex items-start gap-3 px-4 py-4 sm:px-5"><button aria-label="Drag to reorder area" className="mt-0.5 hidden size-7 shrink-0 cursor-grab place-items-center text-slate-400 active:cursor-grabbing sm:grid" draggable onDragEnd={() => setDraggingAreaId(null)} onDragStart={() => setDraggingAreaId(area.id)} type="button"><GripVertical className="size-5" /></button><div className="min-w-0 flex-1"><h2 className="text-xl font-medium">{area.title}</h2>{area.description ? <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{area.description}</p> : null}</div><div className="flex shrink-0 items-center gap-1"><MoveButton disabled={index === 0} label="Move area up" onClick={() => moveArea(area.id, index - 1)}><ArrowUp className="size-4" /></MoveButton><MoveButton disabled={index === data.areas.length - 1} label="Move area down" onClick={() => moveArea(area.id, index + 1)}><ArrowDown className="size-4" /></MoveButton></div></div><AreaEditor area={area} onSaved={load} /><TopicList area={area} onSaved={load} /><CreateTopicForm area={area} onSaved={load} /></section>)}</div></> : null}
    </div></main>;
}

function CreateAreaForm({ areas, onSaved }: { areas: TopicArea[]; onSaved: () => void }) {
    const [form, setForm] = useState<AreaForm>({ title: '', description: '' }); const [afterAreaId, setAfterAreaId] = useState(areas.at(-1)?.id ?? ''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
    async function submit(event: FormEvent): Promise<void> { event.preventDefault(); setSaving(true); setError(''); try { const token = await getCsrfToken(); const { response } = await apiClient.POST('/admin/topic-areas', { body: { title: form.title, description: form.description.trim() || null, after_area_id: afterAreaId || null }, params: { header: { 'X-CSRF-Token': token } } }); if (!response.ok) throw new Error('invalid'); setForm({ title: '', description: '' }); onSaved(); } catch { setError('The topic area could not be created.'); } finally { setSaving(false); } }
    return <form className="mt-8 grid gap-4 border-b border-slate-200 pb-8 lg:grid-cols-[1fr_1.4fr_0.8fr_auto] lg:items-end dark:border-white/10" data-wl-id="admin.topics.create-area" onSubmit={submit}><Field label="New area"><input className={inputClass} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Medicine" required value={form.title} /></Field><Field label="Short description"><input className={inputClass} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What belongs to this broad area?" value={form.description} /></Field><Field label="Insert after"><select className={inputClass} onChange={(event) => setAfterAreaId(event.target.value)} value={afterAreaId}><option value="">At the beginning</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.title}</option>)}</select></Field><button className={primaryButtonClass} disabled={saving} type="submit"><Plus className="size-4" />Add area</button>{error ? <p className="text-sm text-rose-700 lg:col-span-4 dark:text-rose-300" role="alert">{error}</p> : null}</form>;
}

function AreaEditor({ area, onSaved }: { area: TopicArea; onSaved: () => void }) {
    const [form, setForm] = useState<AreaForm>({ title: area.title, description: area.description ?? '' }); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
    async function submit(event: FormEvent): Promise<void> { event.preventDefault(); setSaving(true); setError(''); try { const token = await getCsrfToken(); const { response } = await apiClient.PATCH('/admin/topic-areas/{area_id}', { body: { title: form.title, description: form.description.trim() || null }, params: { header: { 'X-CSRF-Token': token }, path: { area_id: area.id } } }); if (!response.ok) throw new Error('invalid'); onSaved(); } catch { setError('The topic area could not be saved.'); } finally { setSaving(false); } }
    return <details className="border-t border-slate-200/70 px-4 py-3 sm:px-5 dark:border-white/8"><summary className="flex cursor-pointer list-none items-center justify-between text-sm text-slate-500 dark:text-slate-400">Edit area details<ChevronDown className="size-4" /></summary><form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}><Field label="Area name"><input className={inputClass} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></Field><Field label="Short description"><input className={inputClass} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></Field><button className={`${secondaryButtonClass} sm:col-span-2 sm:w-fit`} disabled={saving} type="submit"><Save className="size-4" />Save area</button>{error ? <p className="text-sm text-rose-700 sm:col-span-2 dark:text-rose-300" role="alert">{error}</p> : null}</form></details>;
}

function TopicList({ area, onSaved }: { area: TopicArea; onSaved: () => void }) { if (area.topics.length === 0) return <p className="border-t border-slate-200/70 px-4 py-5 text-sm text-slate-500 sm:px-5 dark:border-white/8 dark:text-slate-400">No topics in this area yet.</p>; return <div className="border-t border-slate-200/70 px-4 sm:px-5 dark:border-white/8">{area.topics.map((topic) => <TopicEditor area={area} key={topic.id} onSaved={onSaved} topic={topic} />)}</div>; }

function CreateTopicForm({ area, onSaved }: { area: TopicArea; onSaved: () => void }) {
    const [form, setForm] = useState<TopicForm>(blankTopicForm()); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
    async function submit(event: FormEvent): Promise<void> { event.preventDefault(); setSaving(true); setError(''); try { const token = await getCsrfToken(); const { response } = await apiClient.POST('/admin/topic-areas/{area_id}/topics', { body: topicBody(form), params: { header: { 'X-CSRF-Token': token }, path: { area_id: area.id } } }); if (!response.ok) throw new Error('invalid'); setForm(blankTopicForm()); onSaved(); } catch { setError('The topic could not be created.'); } finally { setSaving(false); } }
    return <details className="border-t border-slate-200/70 px-4 py-4 sm:px-5 dark:border-white/8"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300"><Plus className="size-4" />Add topic or subtopic</summary><form onSubmit={submit}><TopicFields area={area} form={form} setForm={setForm} /><button className={`${primaryButtonClass} mt-4`} disabled={saving} type="submit"><Plus className="size-4" />Create topic</button>{error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}</form></details>;
}

function TopicEditor({ area, topic, onSaved }: { area: TopicArea; topic: Topic; onSaved: () => void }) {
    const [form, setForm] = useState<TopicForm>(formFromTopic(topic)); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
    async function save(): Promise<void> { setSaving(true); setError(''); try { const token = await getCsrfToken(); const { response } = await apiClient.PATCH('/admin/topic-areas/{area_id}/topics/{topic_id}', { body: topicBody(form), params: { header: { 'X-CSRF-Token': token }, path: { area_id: area.id, topic_id: topic.id } } }); if (!response.ok) throw new Error('invalid'); onSaved(); } catch { setError('The topic could not be saved.'); } finally { setSaving(false); } }
    return <details className="border-b border-slate-200/70 py-3 last:border-b-0 dark:border-white/8"><summary className="flex cursor-pointer list-none items-center gap-3"><span className="min-w-0 flex-1 truncate text-sm font-medium">{topic.parent_id ? '↳ ' : ''}{topic.title}</span><TopicState isPublished={topic.is_published} /><ChevronDown className="size-4 text-slate-400" /></summary><TopicFields area={area} excludeTopicId={topic.id} form={form} setForm={setForm} /><button className={`${secondaryButtonClass} mt-4`} disabled={saving} onClick={() => void save()} type="button"><Save className="size-4" />Save topic</button>{error ? <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}</details>;
}

function TopicFields({ area, form, setForm, excludeTopicId }: { area: TopicArea; form: TopicForm; setForm: (form: TopicForm) => void; excludeTopicId?: string }) { return <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Topic title"><input className={inputClass} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></Field><Field label="Parent topic"><select className={inputClass} onChange={(event) => setForm({ ...form, parentId: event.target.value })} value={form.parentId}><option value="">Top-level topic</option>{area.topics.filter((topic) => topic.id !== excludeTopicId && topic.parent_id === null).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></Field><Field className="sm:col-span-2" label="Introduction"><textarea className={`${inputClass} min-h-20 resize-y py-3`} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></Field><Field className="sm:col-span-2" label="Topic content (Markdown)"><textarea className={`${inputClass} min-h-36 resize-y py-3 font-mono text-sm`} onChange={(event) => setForm({ ...form, content: event.target.value })} value={form.content} /></Field><label className="flex items-center gap-3 text-sm text-slate-600 sm:col-span-2 dark:text-slate-300"><input checked={form.isPublished} className="size-4 rounded border-slate-400 accent-violet-600 dark:border-white/35" onChange={(event) => setForm({ ...form, isPublished: event.target.checked })} type="checkbox" />Publish this topic for learners</label></div>; }
function TopicState({ isPublished }: { isPublished: boolean }) { return isPublished ? <span className="inline-flex items-center gap-1 text-xs text-cyan-700 dark:text-cyan-400"><Check className="size-3.5" />Published</span> : <span className="text-xs text-slate-400">Draft</span>; }
function MoveButton({ children, disabled, label, onClick }: { children: ReactNode; disabled: boolean; label: string; onClick: () => void }) { return <button aria-label={label} className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 dark:border-white/10 dark:text-slate-400" disabled={disabled} onClick={onClick} type="button">{children}</button>; }
function Field({ children, className = '', label }: { children: ReactNode; className?: string; label: string }) { return <label className={`grid gap-2 text-sm font-medium ${className}`}><span>{label}</span>{children}</label>; }
function blankTopicForm(): TopicForm { return { title: '', description: '', content: '', parentId: '', isPublished: true }; }
function formFromTopic(topic: Topic): TopicForm { return { title: topic.title, description: topic.description ?? '', content: topic.content ?? '', parentId: topic.parent_id ?? '', isPublished: topic.is_published }; }
function topicBody(form: TopicForm) { return { title: form.title, description: form.description.trim() || null, content: form.content.trim() || null, parent_id: form.parentId || null, is_published: form.isPublished }; }
