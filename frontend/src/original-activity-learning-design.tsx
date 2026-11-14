import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { usePlatformTranslation } from './original-platform-translation';

type Activity = components['schemas']['AdminEditableActivity'];

export type LearningDesignSuggestions = {
    suggestedLearningIntent: string | null;
    suggestedCompetenceTopics: string[];
};

type TopicDraft = { topic: string; weight: string };

const intents = [
    ['apply', 'Apply'],
    ['explain', 'Explain'],
    ['participate', 'Participate'],
    ['reflect', 'Reflect'],
    ['retrieve', 'Retrieve'],
    ['review', 'Review / revisit'],
    ['transfer', 'Transfer'],
] as const;
type LearningIntent = (typeof intents)[number][0];

/**
 * Source-adapted from the activity editor's competence section. A review can
 * prefill this form, but only the author can make and save the actual write.
 */
export function OriginalActivityLearningDesignDialog({
    activity,
    competenceTopicOptions,
    onClose,
    onSaved,
    suggestions,
}: {
    activity: Activity;
    competenceTopicOptions: string[];
    onClose: () => void;
    onSaved: () => void;
    suggestions: LearningDesignSuggestions;
}) {
    const t = usePlatformTranslation();
    const initial = draftFrom(activity, suggestions);
    const [learningIntent, setLearningIntent] = useState(initial.learningIntent);
    const [topics, setTopics] = useState(initial.topics);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const parsedTopics = topics
            .map((topic) => ({ topic: topic.topic.trim(), weight: Number(topic.weight) }))
            .filter((topic) => topic.topic);
        if (
            parsedTopics.some(
                (topic) =>
                    !topic.topic ||
                    topic.topic.length > 120 ||
                    !Number.isFinite(topic.weight) ||
                    topic.weight <= 0 ||
                    topic.weight > 1000,
            )
        ) {
            setError(t('settings.activity_learning_design.validation_error', 'Give every retained competence topic a name and a contribution between 0.01 and 1000.'));
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/world-builder/activities/{activity_id}/learning-design',
                {
                    body: {
                        learning_intent: learningIntent || null,
                        competence_topics: parsedTopics,
                        updated_at: activity.updated_at,
                    },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: activity.id },
                    },
                },
            );
            if (!response.ok) {
                setError(
                    response.status === 409
                        ? t('settings.activity_learning_design.conflict_error', 'This activity changed elsewhere. Close this draft, reload the graph, and review the newer version.')
                        : t('settings.activity_learning_design.save_error', 'The learning design could not be saved. Check the values and try again.'),
                );
                return;
            }
            onSaved();
        } catch {
            setError(t('settings.activity_learning_design.connection_error', 'The learning design could not be saved. Check your connection and try again.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div aria-labelledby="activity-learning-design-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4" data-wl-id="authoring.activity-learning-design" role="dialog">
            <form className="max-h-[min(46rem,calc(100svh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950" onSubmit={(event) => void save(event)}>
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-violet-700 uppercase dark:text-violet-300"><Sparkles className="size-4" />Review draft</p>
                        <h2 className="mt-1 text-xl font-semibold" id="activity-learning-design-title">Edit learning-design metadata</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">The review has only prepared this editable draft. Check it against the activity, adjust it as needed, and save explicitly. Saving marks the activity as needing a new review.</p>
                    </div>
                    <button aria-label="Close learning-design draft" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white" onClick={onClose} type="button"><X className="size-5" /></button>
                </header>
                {error ? <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="status">{error}</p> : null}
                <div className="mt-6 grid gap-5">
                    <label className="grid gap-2 text-sm font-medium">Learning purpose
                        <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => setLearningIntent(event.target.value as LearningIntent | '')} value={learningIntent}>
                            <option value="">Use the activity type’s usual purpose</option>
                            {intents.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <section><div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold">Competence topics</h3><p className="mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">Reuse an available topic when it fits. The contribution is internal authoring metadata, not a learner score.</p></div><button className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-white/20 dark:hover:bg-white/10" disabled={topics.length >= 20} onClick={() => setTopics((current) => [...current, { topic: '', weight: '1' }])} type="button"><Plus className="size-3.5" />Add topic</button></div>
                        <div className="mt-4 grid gap-3">{topics.map((topic, index) => <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end dark:border-white/10 dark:bg-white/5" key={index}><label className="grid gap-1 text-sm font-medium">Topic<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" list={`learning-design-topic-options-${index}`} onChange={(event) => setTopics((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, topic: event.target.value } : candidate))} value={topic.topic} /><datalist id={`learning-design-topic-options-${index}`}>{competenceTopicOptions.map((option) => <option key={option} value={option} />)}</datalist></label><label className="grid gap-1 text-sm font-medium">Contribution<input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" min="0.01" onChange={(event) => setTopics((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, weight: event.target.value } : candidate))} step="0.1" type="number" value={topic.weight} /></label><button aria-label={`Remove ${topic.topic || 'topic'}`} className="rounded-md p-2 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-300/10" onClick={() => setTopics((current) => current.filter((_, candidateIndex) => candidateIndex !== index))} type="button"><Trash2 className="size-4" /></button></div>)}</div>
                    </section>
                </div>
                <footer className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10"><button className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" disabled={saving} onClick={onClose} type="button">Cancel</button><button className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save reviewed metadata'}</button></footer>
            </form>
        </div>
    );
}

function draftFrom(activity: Activity, suggestions: LearningDesignSuggestions): { learningIntent: LearningIntent | ''; topics: TopicDraft[] } {
    const config = activity.config as Record<string, unknown>;
    const existingTopics = Array.isArray(config.competenceTopics)
        ? config.competenceTopics.flatMap((entry) => {
              if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
              const topic = (entry as Record<string, unknown>).topic;
              const weight = (entry as Record<string, unknown>).weight;
              return typeof topic === 'string' && topic.trim() ? [{ topic, weight: typeof weight === 'number' && Number.isFinite(weight) && weight > 0 ? String(weight) : '1' }] : [];
          })
        : [];
    const suggestedIntent = suggestions.suggestedLearningIntent;
    const configuredIntent = typeof config.learningIntent === 'string' && intents.some(([value]) => value === config.learningIntent)
        ? config.learningIntent as LearningIntent
        : '';
    return {
        learningIntent: suggestedIntent && intents.some(([value]) => value === suggestedIntent)
            ? suggestedIntent as LearningIntent
            : configuredIntent,
        topics: suggestions.suggestedCompetenceTopics.length ? suggestions.suggestedCompetenceTopics.map((topic) => ({ topic, weight: '1' })) : existingTopics,
    };
}
