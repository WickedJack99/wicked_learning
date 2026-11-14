import { Plus, Save, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { LearningSupportSettingsShell } from './extracted-learning-support-navigation';
import type { OriginalAppearance } from './original-appearance';

type LearningTaxonomy = components['schemas']['AdminLearningTaxonomy'];
type CompetenceTopic = components['schemas']['AdminCompetenceTopic'];
type LearningConcept = components['schemas']['AdminLearningConcept'];
type Section = 'competence-topics' | 'learning-concepts';
type CompetenceDraft = Omit<CompetenceTopic, 'slug'>;
type ConceptDraft = Omit<LearningConcept, 'slug'>;

const inputClass =
    'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm transition outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 dark:border-white/20 dark:bg-white/[0.035] dark:text-white';
const primaryButtonClass =
    'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-500/25 dark:text-violet-100 dark:hover:bg-violet-500/35';
const secondaryButtonClass =
    'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/6';

/**
 * Source-adapted from the Laravel Admin Panel's Competence Topics and Concept
 * Library sections. Only Inertia data/mutations are replaced with the typed
 * Rust contract; source information hierarchy and authoring language remain.
 */
export function OriginalLearningTaxonomyPage({
    appearance,
    initialSection = 'competence-topics',
    onSignedOut,
    settingsAccess,
}: {
    appearance: OriginalAppearance;
    initialSection?: Section;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    const [taxonomy, setTaxonomy] = useState<LearningTaxonomy | null>(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [error, setError] = useState('');
    const [section, setSection] = useState<Section>(initialSection);

    useEffect(() => {
        setSection(initialSection);
    }, [initialSection]);

    function load(): void {
        setLoading(true);
        void apiClient
            .GET('/admin/learning-taxonomy')
            .then(({ data, response }) => {
                if ([401, 403, 404].includes(response.status)) {
                    setForbidden(true);
                    return;
                }
                if (!response.ok || !data) {
                    throw new Error('taxonomy unavailable');
                }
                setTaxonomy(data);
                setSection((current) =>
                    current === 'competence-topics' && !data.can_manage_competence_topics
                        ? 'learning-concepts'
                        : current === 'learning-concepts' && !data.can_manage_learning_concepts
                          ? 'competence-topics'
                          : current,
                );
                setError('');
            })
            .catch(() => setError('Learning-support administration is temporarily unavailable.'))
            .finally(() => setLoading(false));
    }

    useEffect(load, []);

    if (forbidden) {
        return <Navigate replace to="/home" />;
    }

    return (
        <LearningSupportSettingsShell
            activeSection={initialSection}
            appearance={appearance}
            onSignedOut={onSignedOut}
            settingsAccess={settingsAccess}
        >
            <section className="flex h-full min-h-0 flex-col overflow-y-auto p-5 sm:p-8 lg:p-10" data-wl-id="admin.learning-taxonomy">
                {error ? <p className="mb-5 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}
                {loading ? (
                    <p className="py-10 text-sm text-slate-500 dark:text-slate-400">Loading administration…</p>
                ) : taxonomy && section === 'competence-topics' && taxonomy.can_manage_competence_topics ? (
                    <CompetenceTopicsSection key={taxonomy.competence_topics.map((topic) => topic.slug).join(',')} topics={taxonomy.competence_topics} onSaved={load} />
                ) : taxonomy && section === 'learning-concepts' && taxonomy.can_manage_learning_concepts ? (
                    <LearningConceptsSection key={taxonomy.learning_concepts.map((concept) => concept.slug).join(',')} concepts={taxonomy.learning_concepts} onSaved={load} />
                ) : null}
            </section>
        </LearningSupportSettingsShell>
    );
}

function CompetenceTopicsSection({ onSaved, topics }: { onSaved: () => void; topics: CompetenceTopic[] }) {
    const baseline = useMemo(() => { const entries = topics.map(toCompetenceDraft); return entries.length > 0 ? entries : [emptyCompetenceTopic()]; }, [topics]);
    const [drafts, setDrafts] = useState<CompetenceDraft[]>(baseline);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const changed = JSON.stringify(drafts) !== JSON.stringify(baseline);

    function update(index: number, field: keyof CompetenceDraft, value: string | number | boolean): void { setDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, [field]: value } : draft)); }
    function add(): void { setDrafts((current) => [...current, emptyCompetenceTopic()]); }
    function remove(index: number): void { setDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index).length > 0 ? current.filter((_, draftIndex) => draftIndex !== index) : [emptyCompetenceTopic()]); }
    async function save(): Promise<void> {
        setSaving(true); setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH('/admin/competence-topics', { body: { topics: drafts.filter((draft) => draft.name.trim()).map((draft) => ({ ...draft, description: draft.description?.trim() || null })) }, params: { header: { 'X-CSRF-Token': token } } });
            if (!response.ok) throw new Error('save failed');
            onSaved();
        } catch { setError('The competence topics could not be saved.'); } finally { setSaving(false); }
    }
    function submit(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); void save(); }

    return <form className="flex min-h-[calc(100svh-5rem)] flex-col" data-wl-id="admin.learning-taxonomy.competence-topics" onSubmit={submit}>
        <header className="border-b border-slate-200 pb-5 dark:border-white/10"><p className="text-xs font-semibold tracking-[0.2em] text-violet-700 uppercase dark:text-violet-300">Competence</p><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-3xl font-semibold tracking-tight">Competence Topics</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Define topic thresholds for competence star growth. Size uses all recorded evidence; brightness and glow use the trailing 30 days without exposing measurements to learners.</p></div><button className={secondaryButtonClass} onClick={add} type="button"><Plus className="size-4" />Add topic</button></div></header>
        <section className="grid gap-5 border-b border-slate-200 py-5 sm:grid-cols-2 dark:border-white/10"><Stat label="Configured topics" value={drafts.filter((topic) => topic.name.trim()).length} /><Stat label="Active topics" value={drafts.filter((topic) => topic.name.trim() && topic.is_active).length} /></section>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="grid gap-3">{drafts.map((topic, index) => <article className="grid gap-3 border-b border-slate-200 py-5 dark:border-white/10" key={`${topic.name}-${index}`}><div className="grid gap-3 lg:max-w-[45%]"><Field label="Topic"><input className={inputClass} onChange={(event) => update(index, 'name', event.target.value)} placeholder="e.g. Algebra" value={topic.name} /></Field><Field label="Description"><textarea className={`${inputClass} min-h-20 h-auto py-2`} onChange={(event) => update(index, 'description', event.target.value)} value={topic.description ?? ''} /></Field></div><div className="grid gap-3 pt-1 lg:grid-cols-[8rem_8rem_8rem_auto] lg:items-end"><Threshold label="Size threshold" onChange={(value) => update(index, 'growth_threshold', value)} value={topic.growth_threshold} /><Threshold label="Brightness threshold" onChange={(value) => update(index, 'emittance_threshold', value)} value={topic.emittance_threshold} /><Threshold label="Glow threshold" onChange={(value) => update(index, 'aura_threshold', value)} value={topic.aura_threshold} /><div className="flex items-center gap-2"><label className="flex items-center gap-3 py-3 text-sm font-medium"><input checked={topic.is_active} className="size-4 accent-violet-600" onChange={(event) => update(index, 'is_active', event.target.checked)} type="checkbox" />Active</label><button aria-label="Remove competence topic" className="grid size-10 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/6" onClick={() => remove(index)} type="button"><Trash2 className="size-4" /></button></div></div></article>)}</div></div>
        <footer className="mt-5 flex shrink-0 items-center gap-4 border-t border-slate-200 pt-5 dark:border-white/10"><button className={primaryButtonClass} disabled={!changed || saving} onClick={() => void save()} type="button"><Save className="size-4" />Save topics</button>{error ? <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}</footer>
    </form>;
}

function LearningConceptsSection({ concepts, onSaved }: { concepts: LearningConcept[]; onSaved: () => void }) {
    const baseline = useMemo(() => { const entries = concepts.map(toConceptDraft); return entries.length > 0 ? entries : [emptyConcept()]; }, [concepts]);
    const [drafts, setDrafts] = useState<ConceptDraft[]>(baseline);
    const [page, setPage] = useState(1); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
    const changed = JSON.stringify(drafts) !== JSON.stringify(baseline); const pageCount = Math.max(1, Math.ceil(drafts.length / 4)); const pageDrafts = drafts.slice((page - 1) * 4, page * 4);
    function update(index: number, field: keyof ConceptDraft, value: string | boolean): void { const absolute = (page - 1) * 4 + index; setDrafts((current) => current.map((draft, draftIndex) => draftIndex === absolute ? { ...draft, [field]: value } : draft)); }
    function add(): void { setDrafts((current) => { const next = [...current, emptyConcept()]; setPage(Math.ceil(next.length / 4)); return next; }); }
    function remove(index: number): void { const absolute = (page - 1) * 4 + index; setDrafts((current) => { const next = current.filter((_, draftIndex) => draftIndex !== absolute); return next.length > 0 ? next : [emptyConcept()]; }); }
    async function save(): Promise<void> { setSaving(true); setError(''); try { const token = await getCsrfToken(); const { response } = await apiClient.PATCH('/admin/learning-concepts', { body: { concepts: drafts.filter((draft) => draft.name.trim()).map((draft) => ({ ...draft, description: draft.description?.trim() || null })) }, params: { header: { 'X-CSRF-Token': token } } }); if (!response.ok) throw new Error('save failed'); onSaved(); } catch { setError('The learning concepts could not be saved.'); } finally { setSaving(false); } }
    function submit(event: FormEvent<HTMLFormElement>): void { event.preventDefault(); void save(); }
    return <form className="flex min-h-[calc(100svh-5rem)] flex-col" data-wl-id="admin.learning-taxonomy.learning-concepts" onSubmit={submit}><header className="border-b border-slate-200 pb-5 dark:border-white/10"><p className="text-xs font-semibold tracking-[0.2em] text-violet-700 uppercase dark:text-violet-300">Evidence</p><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-3xl font-semibold tracking-tight">Concept Library</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Maintain shared vocabulary for authoring evidence. Activities keep selected names as stable snapshots.</p></div><button className={secondaryButtonClass} onClick={add} type="button"><Plus className="size-4" />Add concept</button></div></header><section className="grid gap-5 border-b border-slate-200 py-5 sm:grid-cols-2 dark:border-white/10"><Stat label="Learning concepts" value={drafts.filter((concept) => concept.name.trim()).length} /><Stat label="Active concepts" value={drafts.filter((concept) => concept.name.trim() && concept.is_active).length} /></section><div className="min-h-0 flex-1 overflow-y-auto pr-1"><div className="grid min-h-[32rem] gap-3">{pageDrafts.map((concept, index) => <article className="grid content-start gap-3 border-b border-slate-200 py-5 dark:border-white/10" key={`${concept.name}-${index}`}><div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><Field label="Name"><input className={inputClass} onChange={(event) => update(index, 'name', event.target.value)} placeholder="e.g. Cognitive load" value={concept.name} /></Field><Field label="Description"><textarea className={`${inputClass} min-h-16 h-auto py-2`} onChange={(event) => update(index, 'description', event.target.value)} value={concept.description ?? ''} /></Field></div><div className="flex items-center justify-between gap-3"><label className="flex items-center gap-3 text-sm font-medium"><input checked={concept.is_active} className="size-4 accent-violet-600" onChange={(event) => update(index, 'is_active', event.target.checked)} type="checkbox" />Available in authoring</label><button aria-label="Remove learning concept" className="grid size-10 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/6" onClick={() => remove(index)} type="button"><Trash2 className="size-4" /></button></div></article>)}</div></div><footer className="mt-5 flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-white/10"><Pagination currentPage={page} onPageChange={setPage} pageCount={pageCount} /><div className="flex items-center gap-4"><button className={primaryButtonClass} disabled={!changed || saving} onClick={() => void save()} type="button"><Save className="size-4" />Save concepts</button>{error ? <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p> : null}</div></footer></form>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Threshold({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) { return <Field label={label}><input className={inputClass} min="0.01" onChange={(event) => onChange(Number(event.target.value))} step="0.1" type="number" value={value} /></Field>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="border-l-2 border-violet-500 pl-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">{label}</p></div>; }
function Pagination({ currentPage, onPageChange, pageCount }: { currentPage: number; onPageChange: (page: number) => void; pageCount: number }) { return <div className="flex items-center gap-2 text-sm"><button className={secondaryButtonClass} disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} type="button">Previous</button><span aria-live="polite">Page {currentPage} of {pageCount}</span><button className={secondaryButtonClass} disabled={currentPage === pageCount} onClick={() => onPageChange(currentPage + 1)} type="button">Next</button></div>; }
function toCompetenceDraft(topic: CompetenceTopic): CompetenceDraft { const { slug: _slug, ...draft } = topic; return draft; }
function toConceptDraft(concept: LearningConcept): ConceptDraft { const { slug: _slug, ...draft } = concept; return draft; }
function emptyCompetenceTopic(): CompetenceDraft { return { name: '', description: null, growth_threshold: 20, emittance_threshold: 20, aura_threshold: 10, is_active: true }; }
function emptyConcept(): ConceptDraft { return { name: '', description: null, is_active: true }; }
