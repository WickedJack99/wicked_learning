import { Bot, CircleAlert, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type Activity = components['schemas']['AdminEditableActivity'];
type ReviewTemplate = components['schemas']['AdminActivityReviewTemplate'];
type ReviewResponse =
    components['schemas']['ReviewAdminActivityAiResponse'];

/**
 * Source-adapted from Laravel's activity-review dialog. Suggestions remain
 * review material only: metadata application is an explicitly separate flow.
 */
export function OriginalActivityAiReviewDialog({
    activity,
    templates,
    onClose,
    onReviewed,
}: {
    activity: Activity;
    templates: ReviewTemplate[];
    onClose: () => void;
    onReviewed: () => void;
}) {
    const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
    const [review, setReview] = useState<ReviewResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reviewing, setReviewing] = useState(false);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!templateId) {
            setError('Choose an enabled activity review helper first.');
            return;
        }
        setError(null);
        setReviewing(true);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/admin/world-builder/activities/{activity_id}/ai-review',
                {
                    body: { template_id: templateId },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { activity_id: activity.id },
                    },
                },
            );
            if (!response.ok || !data) {
                setError(
                    response.status === 422
                        ? 'The helper did not return a safe structured review. No activity changes were made.'
                        : 'The review could not be completed. Check the selected helper configuration and try again.',
                );
                return;
            }
            setReview(data);
            onReviewed();
        } catch {
            setError(
                'The review could not be completed. Check your connection and try again.',
            );
        } finally {
            setReviewing(false);
        }
    };

    const current = review?.ai_review.review as Record<string, unknown> | undefined;
    const suggestions = stringList(current?.suggestions);
    const strengths = stringList(current?.strengths);
    const learning = record(current?.learningDesign);

    return (
        <div
            aria-labelledby="activity-ai-review-title"
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"
            data-wl-id="authoring.activity-ai-review"
            role="dialog"
        >
            <section className="max-h-[min(46rem,calc(100svh-2rem))] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-950">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-violet-700 uppercase dark:text-violet-300">
                            <Sparkles className="size-4" />
                            Activity review
                        </p>
                        <h2 className="mt-1 text-xl font-semibold" id="activity-ai-review-title">
                            {activity.title}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Review the learning design with a configured helper. This is not a learner grade, does not use learner data, and never changes the activity automatically.
                        </p>
                    </div>
                    <button aria-label="Close activity review" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white" onClick={onClose} type="button"><X className="size-5" /></button>
                </header>

                {error ? <p aria-live="polite" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100" role="status">{error}</p> : null}

                {review && current ? (
                    <ReviewResult
                        learning={learning}
                        review={current}
                        strengths={strengths}
                        suggestions={suggestions}
                    />
                ) : (
                    <form className="mt-6" onSubmit={(event) => void submit(event)}>
                        {templates.length > 0 ? (
                            <label className="block text-sm font-medium">
                                Review helper
                                <select className="mt-2 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 dark:border-white/20" onChange={(event) => setTemplateId(event.target.value)} value={templateId}>
                                    {templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.provider_label ? ` · ${template.provider_label}` : ''}{template.model ? ` (${template.model})` : ''}</option>)}
                                </select>
                            </label>
                        ) : (
                            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100">No enabled activity review helper is configured. Add one in AI settings first.</p>
                        )}
                        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
                            <button className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10" disabled={reviewing} onClick={onClose} type="button">Cancel</button>
                            <button className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-60 dark:bg-violet-400 dark:text-slate-950" disabled={reviewing || templates.length === 0} type="submit"><Bot className="size-4" />{reviewing ? 'Reviewing…' : 'Review activity'}</button>
                        </div>
                    </form>
                )}
            </section>
        </div>
    );
}

function ReviewResult({ learning, review, strengths, suggestions }: { learning: Record<string, unknown>; review: Record<string, unknown>; strengths: string[]; suggestions: string[] }) {
    return <div className="mt-6 grid gap-5" data-wl-id="authoring.activity-ai-review.result">
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 text-sm leading-6 text-violet-950 dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-50">{text(review.summary) || 'The review was saved without a summary.'}</p>
        <ReviewList heading="Strengths" items={strengths} />
        <ReviewList heading="Optional suggestions" items={suggestions} />
        <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10"><h3 className="font-semibold">Learning-design alignment</h3><div className="mt-3 grid gap-3 text-sm"><Signal label="Purpose" value={record(learning.purpose)} /><Signal label="Topics" value={record(learning.topics)} /></div>{learning.suggestedLearningIntent || stringList(learning.suggestedCompetenceTopics).length ? <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-200">Suggested metadata is shown for consideration only. Applying activity metadata is not part of this review action.</p> : null}</section>
        <section className="rounded-lg border border-slate-200 p-4 dark:border-white/10"><h3 className="font-semibold">Supportive learning environment</h3><div className="mt-3 grid gap-3 text-sm">{Object.entries(record(review.sdt)).map(([label, value]) => <Signal key={label} label={label} value={record(value)} />)}{Object.entries(record(review.feedbackGuidance)).map(([label, value]) => <Signal key={`feedback-${label}`} label={`Feedback: ${label}`} value={record(value)} />)}</div></section>
    </div>;
}

function ReviewList({ heading, items }: { heading: string; items: string[] }) { return <section><h3 className="font-semibold">{heading}</h3>{items.length ? <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">None recorded.</p>}</section>; }
function Signal({ label, value }: { label: string; value: Record<string, unknown> }) { return <div><p className="font-medium capitalize">{label} <span className="text-slate-500">· {text(value.signal) || 'unclear'}</span></p><p className="mt-1 leading-6 text-slate-600 dark:text-slate-300">{text(value.note) || 'No note was provided.'}</p></div>; }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
