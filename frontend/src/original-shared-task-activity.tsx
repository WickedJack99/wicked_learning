import { CheckCircle2, MessageSquareText, Pencil, Send } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type SharedTaskState = components['schemas']['LearnerSharedTaskState'];
type ReviewType = NonNullable<
    components['schemas']['SubmitLearnerSharedTaskReview']['response_type']
>;

/**
 * Source-adapted from `features/world/shared-task-activity.tsx`. The Rust
 * API owns contribution eligibility, anonymity, peer review permissions and
 * shared completion; this keeps the original activity's three working areas.
 */
export function OriginalSharedTaskActivity({
    activity,
    onComplete,
    playRunId,
}: {
    activity: LearnerPlaybackActivity;
    onComplete: () => Promise<void>;
    playRunId: string;
}) {
    const t = usePlatformTranslation();
    const initial = activity.shared_task;
    const config = activity.config as Record<string, unknown>;
    const steps = strings(config.projectSteps);
    const minimumLength = number(config.minimumLength, 20);
    const prompt = string(config.prompt, 'Add a useful contribution.');
    const inputLabel = string(config.inputLabel, 'Your contribution');
    const [state, setState] = useState<SharedTaskState | null>(initial);
    const [area, setArea] = useState<
        'contribute' | 'contributions' | 'peer_review'
    >('contribute');
    const [body, setBody] = useState('');
    const [share, setShare] = useState(false);
    const [step, setStep] = useState<number | null>(null);
    const [reviewBody, setReviewBody] = useState('');
    const [reviewType, setReviewType] = useState<ReviewType | null>(null);
    const [reviewStep, setReviewStep] = useState<number | null>(null);
    const [selectedContribution, setSelectedContribution] = useState<
        string | null
    >(null);
    const [revision, setRevision] = useState('');
    const [followUp, setFollowUp] = useState<Record<string, string>>({});
    const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setState(activity.shared_task);
        setArea('contribute');
        setBody('');
        setRevision('');
        setCompletedSteps(
            activity.shared_task?.checklist.completed_step_indexes ?? [],
        );
    }, [activity.shared_task, activity.slug, playRunId]);

    if (!state) {
        return (
            <ActivityError
                message={t(
                    'activities.shared_task.unavailable',
                    'This shared task is no longer available.',
                )}
            />
        );
    }

    const peerReview = state.peer_review;
    const canSubmit =
        !busy &&
        !state.is_complete &&
        (config.repeatPolicy === 'unlimited' || !state.has_submitted) &&
        body.trim().length >= minimumLength;

    async function request<T>(
        operation: () => Promise<{ data?: T; response: Response }>,
        message: string,
    ): Promise<T | null> {
        setError('');
        try {
            const result = await operation();
            if (!result.response.ok || !result.data)
                throw new Error('rejected');
            return result.data;
        } catch {
            setError(message);
            return null;
        }
    }

    async function submitContribution(): Promise<void> {
        if (!canSubmit) return;
        setBusy('contribution');
        const token = await getCsrfToken();
        const next = await request(
            () =>
                apiClient.POST(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/submissions',
                    {
                        body: {
                            body: body.trim(),
                            project_step_index: step,
                            share_with_peers: share,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                            },
                        },
                    },
                ),
            t(
                'activities.shared_task.submit_error',
                'This contribution could not be accepted.',
            ),
        );
        if (next) {
            setState(next);
            setBody('');
            setStep(null);
            if (next.is_complete && !next.peer_review?.enabled)
                await onComplete();
        }
        setBusy(null);
    }

    async function submitReview(): Promise<void> {
        if (!selectedContribution || reviewBody.trim().length < 10 || busy)
            return;
        setBusy('review');
        const token = await getCsrfToken();
        const next = await request(
            () =>
                apiClient.POST(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews',
                    {
                        body: {
                            body: reviewBody.trim(),
                            project_step_index: reviewStep,
                            response_type: reviewType,
                            submission_id: selectedContribution,
                        },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                            },
                        },
                    },
                ),
            t(
                'activities.shared_task.peer_review_submit_error',
                'This peer review could not be saved.',
            ),
        );
        if (next) {
            setState(next);
            setReviewBody('');
            setSelectedContribution(null);
            if (next.is_complete) await onComplete();
        }
        setBusy(null);
    }

    async function revise(): Promise<void> {
        const submission = state?.submission;
        if (!submission || revision.trim().length < minimumLength || busy)
            return;
        setBusy('revision');
        const token = await getCsrfToken();
        const next = await request(
            () =>
                apiClient.PATCH(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/submissions/{submission_id}/revision',
                    {
                        body: { body: revision.trim() },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                                submission_id: submission.id,
                            },
                        },
                    },
                ),
            t(
                'activities.shared_task.revision_error',
                'This revision could not be saved yet.',
            ),
        );
        if (next) {
            setState(next);
            setRevision('');
        }
        setBusy(null);
    }

    async function markHelpful(
        reviewId: string,
        helpful: boolean,
    ): Promise<void> {
        setBusy(`helpful-${reviewId}`);
        const token = await getCsrfToken();
        const next = await request(
            () =>
                apiClient.PATCH(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews/{review_id}/helpfulness',
                    {
                        body: { helpful },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                                review_id: reviewId,
                            },
                        },
                    },
                ),
            t(
                'activities.shared_task.peer_review_helpful_error',
                'The helpful response mark could not be saved yet.',
            ),
        );
        if (next) setState(next);
        setBusy(null);
    }

    async function saveFollowUp(reviewId: string): Promise<void> {
        setBusy(`follow-${reviewId}`);
        const token = await getCsrfToken();
        const value = followUp[reviewId]?.trim() || null;
        const next = await request(
            () =>
                apiClient.PATCH(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/reviews/{review_id}/follow-up',
                    {
                        body: { body: value },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                                review_id: reviewId,
                            },
                        },
                    },
                ),
            t(
                'activities.shared_task.peer_review_follow_up_error',
                'The private note could not be saved yet.',
            ),
        );
        if (next) {
            setState(next);
            setEditingFollowUp(null);
        }
        setBusy(null);
    }

    async function toggleChecklist(index: number): Promise<void> {
        if (busy) return;
        const previous = completedSteps;
        const nextIndexes = previous.includes(index)
            ? previous.filter((item) => item !== index)
            : [...previous, index].sort((left, right) => left - right);
        setCompletedSteps(nextIndexes);
        setBusy('checklist');
        const token = await getCsrfToken();
        const saved = await request(
            () =>
                apiClient.POST(
                    '/learner/play-runs/{play_run_id}/activities/{activity_slug}/shared-task/checklist',
                    {
                        body: { completed_step_indexes: nextIndexes },
                        params: {
                            header: { 'X-CSRF-Token': token },
                            path: {
                                activity_slug: activity.slug,
                                play_run_id: playRunId,
                            },
                        },
                    },
                ),
            t(
                'activities.shared_task.project_checklist_error',
                'The project step could not be saved yet.',
            ),
        );
        if (saved) setCompletedSteps(saved.completed_step_indexes);
        else setCompletedSteps(previous);
        setBusy(null);
    }

    return (
        <div className="grid gap-4">
            <div className="rounded-lg border border-cyan-200/70 bg-cyan-50/60 p-4 dark:border-teal-200/20 dark:bg-teal-100/6">
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {prompt}
                </p>
                {typeof config.instructions === 'string' &&
                config.instructions ? (
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {config.instructions}
                    </p>
                ) : null}
                <p
                    aria-live="polite"
                    className="mt-3 text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200"
                >
                    {state.is_complete
                        ? t(
                              'activities.shared_task.threshold_reached',
                              'Threshold reached.',
                          )
                        : t(
                              state.remaining === 1
                                  ? 'activities.shared_task.one_more_needed'
                                  : 'activities.shared_task.more_needed',
                              state.remaining === 1
                                  ? ':count more accepted contribution needed.'
                                  : ':count more accepted contributions needed.',
                              { count: state.remaining },
                          )}
                </p>
            </div>
            {typeof config.projectGoal === 'string' ||
            typeof config.projectDeliverable === 'string' ||
            steps.length > 0 ? (
                <section className="rounded-lg border border-cyan-200/70 bg-cyan-50/60 p-4 dark:border-teal-200/20 dark:bg-teal-100/6">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {t(
                            'activities.shared_task.project_brief',
                            'Project brief',
                        )}
                    </h4>
                    <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2 dark:text-slate-200">
                        {typeof config.projectGoal === 'string' &&
                        config.projectGoal ? (
                            <p>
                                <strong>
                                    {t(
                                        'activities.shared_task.project_goal',
                                        'Shared goal',
                                    )}
                                </strong>
                                <br />
                                {config.projectGoal}
                            </p>
                        ) : null}
                        {typeof config.projectDeliverable === 'string' &&
                        config.projectDeliverable ? (
                            <p>
                                <strong>
                                    {t(
                                        'activities.shared_task.project_deliverable',
                                        'Useful outcome',
                                    )}
                                </strong>
                                <br />
                                {config.projectDeliverable}
                            </p>
                        ) : null}
                    </div>
                    {steps.length ? (
                        <ol
                            aria-label={t(
                                'activities.shared_task.project_steps',
                                'Suggested steps',
                            )}
                            className="mt-3 grid gap-2"
                        >
                            {steps.map((item, index) => (
                                <li key={item}>
                                    <label className="flex min-h-11 items-start gap-3 rounded-md border border-cyan-200/70 bg-white/65 px-3 py-2 text-sm text-slate-700 dark:border-teal-200/15 dark:bg-slate-950/30 dark:text-slate-200">
                                        <input
                                            checked={completedSteps.includes(
                                                index,
                                            )}
                                            className="mt-1 size-4 accent-cyan-600"
                                            disabled={Boolean(busy)}
                                            onChange={() =>
                                                void toggleChecklist(index)
                                            }
                                            type="checkbox"
                                        />
                                        <span
                                            className={
                                                completedSteps.includes(index)
                                                    ? 'line-through opacity-60'
                                                    : ''
                                            }
                                        >
                                            {item}
                                        </span>
                                    </label>
                                </li>
                            ))}
                        </ol>
                    ) : null}
                    {steps.length ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {t(
                                'activities.shared_task.project_checklist_hint',
                                'Optional private planning notes for this run. They do not affect completion.',
                            )}
                        </p>
                    ) : null}
                </section>
            ) : null}
            <div
                aria-label={t(
                    'activities.shared_task.area_navigation',
                    'Shared task areas',
                )}
                className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-slate-950/30"
                role="group"
            >
                <AreaButton
                    active={area === 'contribute'}
                    label={t(
                        'activities.shared_task.area.contribute',
                        'Contribute',
                    )}
                    onClick={() => setArea('contribute')}
                />
                {state.can_share_contributions ? (
                    <AreaButton
                        active={area === 'contributions'}
                        label={t(
                            'activities.shared_task.area.contributions',
                            'See contributions',
                        )}
                        onClick={() => setArea('contributions')}
                    />
                ) : null}
                {peerReview ? (
                    <AreaButton
                        active={area === 'peer_review'}
                        label={t(
                            'activities.shared_task.area.peer_review',
                            'Peer review',
                        )}
                        onClick={() => setArea('peer_review')}
                    />
                ) : null}
            </div>
            {area === 'contribute' ? (
                <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
                    {state.has_submitted &&
                    config.repeatPolicy !== 'unlimited' ? (
                        <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {t(
                                'activities.shared_task.contribution_once_body',
                                'This shared task accepts one contribution from you. Use another area above if you want to inspect shared contributions or peer review.',
                            )}
                        </p>
                    ) : (
                        <>
                            <label
                                className="grid gap-2 text-sm font-medium text-slate-800 dark:text-slate-100"
                                htmlFor="shared-task-body"
                            >
                                {inputLabel}
                                <textarea
                                    className="min-h-32 rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 dark:border-white/15 dark:bg-slate-950"
                                    id="shared-task-body"
                                    maxLength={20000}
                                    onChange={(event) =>
                                        setBody(event.target.value)
                                    }
                                    placeholder={t(
                                        'activities.shared_task.placeholder',
                                        'Write a contribution for the shared task.',
                                    )}
                                    value={body}
                                />
                            </label>
                            {steps.length ? (
                                <StepSelect
                                    emptyLabel={t(
                                        'activities.shared_task.project_step_any',
                                        'Any project step',
                                    )}
                                    label={t(
                                        'activities.shared_task.project_step_label',
                                        'Where would this contribution help? (optional)',
                                    )}
                                    onChange={setStep}
                                    steps={steps}
                                    value={step}
                                />
                            ) : null}
                            {state.can_share_contributions ? (
                                <label className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                                    <input
                                        checked={share}
                                        className="mt-1 size-4 accent-cyan-600"
                                        onChange={(event) =>
                                            setShare(event.target.checked)
                                        }
                                        type="checkbox"
                                    />
                                    <span>
                                        {t(
                                            'activities.shared_task.share_with_peers',
                                            'Share this contribution anonymously with later learners.',
                                        )}
                                    </span>
                                </label>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {t(
                                        'activities.shared_task.character_count',
                                        ':current / :minimum characters',
                                        {
                                            current: body.trim().length,
                                            minimum: minimumLength,
                                        },
                                    )}
                                </span>
                                <button
                                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:opacity-50"
                                    disabled={!canSubmit}
                                    onClick={() => void submitContribution()}
                                    type="button"
                                >
                                    <Send className="size-4" />
                                    {t(
                                        'activities.shared_task.submit',
                                        'Submit contribution',
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            ) : null}
            {area === 'contributions' ? (
                <Contributions contributions={state.contributions} t={t} />
            ) : null}
            {area === 'peer_review' && peerReview ? (
                <section className="grid gap-4 rounded-lg border border-violet-200/70 bg-violet-50/60 p-4 dark:border-violet-200/20 dark:bg-violet-100/6">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {t(
                                'activities.shared_task.peer_review',
                                'Peer review',
                            )}
                        </h4>
                        <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {peerReview.prompt}
                        </p>
                    </div>
                    {peerReview.submitted_review ? (
                        <article className="rounded-md border border-cyan-300/70 bg-cyan-50/70 p-3 text-sm leading-6 text-slate-700 dark:border-teal-200/25 dark:bg-teal-100/6 dark:text-slate-200">
                            <strong>
                                {t(
                                    'activities.shared_task.peer_review_your_response',
                                    'Your peer review',
                                )}
                            </strong>
                            <p className="mt-1">
                                {peerReview.submitted_review.body}
                            </p>
                            <p className="mt-1 text-xs">
                                {t(
                                    'activities.shared_task.peer_review_your_response_private',
                                    'This response is visible only to you here.',
                                )}
                            </p>
                        </article>
                    ) : null}
                    {peerReview.received_reviews.length ? (
                        <div className="grid gap-2">
                            <p className="text-xs font-semibold tracking-[0.12em] text-violet-700 uppercase dark:text-violet-200">
                                {t(
                                    'activities.shared_task.peer_review_received',
                                    'Responses to your contribution',
                                )}
                            </p>
                            {peerReview.received_reviews.map((review) => (
                                <article
                                    className="grid gap-2 rounded-md border border-violet-200/80 bg-white/70 p-3 text-sm leading-6 text-slate-700 dark:border-violet-200/15 dark:bg-slate-950/30 dark:text-slate-200"
                                    key={review.id}
                                >
                                    <p>{review.body}</p>
                                    {review.project_step ? (
                                        <p className="text-xs opacity-70">
                                            {t(
                                                'activities.shared_task.project_step',
                                                'Project step',
                                            )}
                                            : {review.project_step}
                                        </p>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            className="rounded-md border px-3 py-1.5 text-xs font-semibold"
                                            disabled={Boolean(busy)}
                                            onClick={() =>
                                                void markHelpful(
                                                    review.id,
                                                    !review.is_helpful,
                                                )
                                            }
                                            type="button"
                                        >
                                            {review.is_helpful
                                                ? t(
                                                      'activities.shared_task.peer_review_helpful_clear',
                                                      'Clear helpful mark',
                                                  )
                                                : t(
                                                      'activities.shared_task.peer_review_helpful',
                                                      'This helped',
                                                  )}
                                        </button>
                                        <button
                                            className="rounded-md px-3 py-1.5 text-xs font-semibold"
                                            onClick={() => {
                                                setEditingFollowUp(review.id);
                                                setFollowUp((current) => ({
                                                    ...current,
                                                    [review.id]:
                                                        current[review.id] ??
                                                        review.follow_up ??
                                                        '',
                                                }));
                                            }}
                                            type="button"
                                        >
                                            {review.follow_up
                                                ? t(
                                                      'activities.shared_task.peer_review_follow_up_edit',
                                                      'Edit private note',
                                                  )
                                                : t(
                                                      'activities.shared_task.peer_review_follow_up_add',
                                                      'Add private note',
                                                  )}
                                        </button>
                                    </div>
                                    {editingFollowUp === review.id ? (
                                        <div className="grid gap-2">
                                            <label
                                                className="grid gap-1 text-sm"
                                                htmlFor={`shared-task-follow-up-${review.id}`}
                                            >
                                                {t(
                                                    'activities.shared_task.peer_review_follow_up_label',
                                                    'What will you carry forward? (private)',
                                                )}
                                                <textarea
                                                    className="min-h-20 rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-950"
                                                    id={`shared-task-follow-up-${review.id}`}
                                                    maxLength={2000}
                                                    onChange={(event) =>
                                                        setFollowUp(
                                                            (current) => ({
                                                                ...current,
                                                                [review.id]:
                                                                    event.target
                                                                        .value,
                                                            }),
                                                        )
                                                    }
                                                    placeholder={t(
                                                        'activities.shared_task.peer_review_follow_up_placeholder',
                                                        'Note one idea, question, or next step for yourself.',
                                                    )}
                                                    value={
                                                        followUp[review.id] ??
                                                        ''
                                                    }
                                                />
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                                    disabled={Boolean(busy)}
                                                    onClick={() =>
                                                        void saveFollowUp(
                                                            review.id,
                                                        )
                                                    }
                                                    type="button"
                                                >
                                                    {t(
                                                        'activities.shared_task.peer_review_follow_up_save',
                                                        'Save private note',
                                                    )}
                                                </button>
                                                <button
                                                    className="rounded-md px-3 py-1.5 text-xs font-semibold"
                                                    onClick={() =>
                                                        setEditingFollowUp(null)
                                                    }
                                                    type="button"
                                                >
                                                    {t(
                                                        'common.cancel',
                                                        'Cancel',
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    ) : null}
                    {state.submission?.can_revise ? (
                        <div className="grid gap-2 rounded-md border border-violet-200/80 bg-white/70 p-3 dark:border-violet-200/15 dark:bg-slate-950/30">
                            <label
                                className="grid gap-2 text-sm font-medium"
                                htmlFor="shared-task-revision"
                            >
                                {t(
                                    'activities.shared_task.revision_label',
                                    'Revised contribution',
                                )}
                                <textarea
                                    className="min-h-24 rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-950"
                                    id="shared-task-revision"
                                    maxLength={20000}
                                    onChange={(event) =>
                                        setRevision(event.target.value)
                                    }
                                    placeholder={t(
                                        'activities.shared_task.revision_placeholder',
                                        'Rewrite your contribution using what you noticed from the feedback.',
                                    )}
                                    value={revision}
                                />
                            </label>
                            <button
                                className="inline-flex w-fit items-center gap-2 rounded-md bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                disabled={
                                    revision.trim().length < minimumLength ||
                                    Boolean(busy)
                                }
                                onClick={() => void revise()}
                                type="button"
                            >
                                <Pencil className="size-4" />
                                {t(
                                    'activities.shared_task.revision_submit',
                                    'Save one revision',
                                )}
                            </button>
                        </div>
                    ) : null}
                    {!peerReview.has_reviewed &&
                    peerReview.reviewable_contributions.length ? (
                        <div className="grid gap-3 rounded-md border border-violet-200/80 bg-white/70 p-3 dark:border-violet-200/15 dark:bg-slate-950/30">
                            <p className="text-sm font-semibold">
                                {t(
                                    'activities.shared_task.peer_review_choose',
                                    'Choose one anonymous contribution',
                                )}
                            </p>
                            {peerReview.reviewable_contributions.map(
                                (contribution) => (
                                    <label
                                        className="rounded-md border border-slate-200 p-3 text-sm leading-6 dark:border-white/10"
                                        key={contribution.id}
                                    >
                                        <input
                                            checked={
                                                selectedContribution ===
                                                contribution.id
                                            }
                                            className="mr-2 accent-violet-600"
                                            name="review-contribution"
                                            onChange={() =>
                                                setSelectedContribution(
                                                    contribution.id,
                                                )
                                            }
                                            type="radio"
                                        />
                                        {contribution.body}
                                        {contribution.truncated ? '…' : ''}
                                    </label>
                                ),
                            )}
                            <textarea
                                className="min-h-28 rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-white/15 dark:bg-slate-950"
                                maxLength={2000}
                                onChange={(event) =>
                                    setReviewBody(event.target.value)
                                }
                                placeholder={t(
                                    'activities.shared_task.peer_review_response_placeholder',
                                    'Name a useful connection, question, or extension.',
                                )}
                                value={reviewBody}
                            />
                            {steps.length ? (
                                <StepSelect
                                    emptyLabel={t(
                                        'activities.shared_task.peer_review_project_step_any',
                                        'No specific step',
                                    )}
                                    label={t(
                                        'activities.shared_task.peer_review_project_step',
                                        'What project step does this response address? (optional)',
                                    )}
                                    onChange={setReviewStep}
                                    steps={steps}
                                    value={reviewStep}
                                />
                            ) : null}
                            <label className="grid gap-1 text-sm">
                                {t(
                                    'activities.shared_task.peer_review_response_type',
                                    'What kind of response is this? (optional)',
                                )}
                                <select
                                    className="rounded-md border border-slate-300 bg-white p-2 dark:border-white/15 dark:bg-slate-950"
                                    onChange={(event) =>
                                        setReviewType(
                                            (event.target.value ||
                                                null) as ReviewType | null,
                                        )
                                    }
                                    value={reviewType ?? ''}
                                >
                                    <option value="">
                                        {t(
                                            'activities.shared_task.peer_review_response_type_clear',
                                            'Clear response type',
                                        )}
                                    </option>
                                    <option value="explanation">
                                        {t(
                                            'activities.shared_task.peer_review_type.explanation',
                                            'Explanation',
                                        )}
                                    </option>
                                    <option value="example">
                                        {t(
                                            'activities.shared_task.peer_review_type.example',
                                            'Example',
                                        )}
                                    </option>
                                    <option value="question">
                                        {t(
                                            'activities.shared_task.peer_review_type.question',
                                            'Question',
                                        )}
                                    </option>
                                    <option value="counterexample">
                                        {t(
                                            'activities.shared_task.peer_review_type.counterexample',
                                            'Counterexample',
                                        )}
                                    </option>
                                </select>
                            </label>
                            <button
                                className="inline-flex w-fit items-center gap-2 rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                disabled={
                                    !selectedContribution ||
                                    reviewBody.trim().length < 10 ||
                                    Boolean(busy)
                                }
                                onClick={() => void submitReview()}
                                type="button"
                            >
                                <MessageSquareText className="size-4" />
                                {t(
                                    'activities.shared_task.peer_review_submit',
                                    'Save peer review',
                                )}
                            </button>
                        </div>
                    ) : null}
                    {state.is_complete ? (
                        <button
                            className="inline-flex w-fit items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            disabled={Boolean(busy)}
                            onClick={() => void onComplete()}
                            type="button"
                        >
                            <CheckCircle2 className="size-4" />
                            {t('common.continue', 'Continue')}
                        </button>
                    ) : null}
                </section>
            ) : null}
            {error ? (
                <p
                    aria-live="assertive"
                    className="text-sm font-medium text-red-600 dark:text-red-300"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function AreaButton({
    active,
    label,
    onClick,
}: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            aria-pressed={active}
            className={
                active
                    ? 'min-h-11 rounded-md border border-violet-500 bg-violet-100 px-3 py-2 text-sm font-medium text-violet-900 dark:border-violet-200/70 dark:bg-violet-100/15 dark:text-violet-100'
                    : 'min-h-11 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:bg-white dark:text-slate-300 dark:hover:border-white/15 dark:hover:bg-white/6'
            }
            onClick={onClick}
            type="button"
        >
            {label}
        </button>
    );
}

function StepSelect({
    emptyLabel,
    label,
    onChange,
    steps,
    value,
}: {
    emptyLabel: string;
    label: string;
    onChange: (value: number | null) => void;
    steps: string[];
    value: number | null;
}) {
    return (
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {label}
            <select
                className="rounded-md border border-slate-300 bg-white p-2 text-sm dark:border-white/15 dark:bg-slate-950"
                onChange={(event) =>
                    onChange(
                        event.target.value === ''
                            ? null
                            : Number(event.target.value),
                    )
                }
                value={value ?? ''}
            >
                <option value="">{emptyLabel}</option>
                {steps.map((item, index) => (
                    <option key={item} value={index}>
                        {item}
                    </option>
                ))}
            </select>
        </label>
    );
}

function Contributions({
    contributions,
    t,
}: {
    contributions: SharedTaskState['contributions'];
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t(
                    'activities.shared_task.recent_contributions',
                    'Recent anonymous contributions',
                )}
            </h4>
            {contributions.length ? (
                <div className="mt-3 grid gap-2">
                    {contributions.map((contribution, index) => (
                        <article
                            className="rounded-md border border-slate-200/80 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-200"
                            key={`${contribution.submitted_at ?? 'contribution'}-${index}`}
                        >
                            {contribution.project_step ? (
                                <p className="mb-1 text-xs font-medium text-cyan-700 dark:text-teal-200">
                                    {t(
                                        'activities.shared_task.project_step',
                                        'Project step',
                                    )}
                                    : {contribution.project_step}
                                </p>
                            ) : null}
                            <p>
                                {contribution.body}
                                {contribution.truncated ? '…' : ''}
                            </p>
                        </article>
                    ))}
                </div>
            ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {t(
                        'activities.shared_task.contributions_empty',
                        'No shared contributions are visible yet.',
                    )}
                </p>
            )}
        </section>
    );
}

function ActivityError({ message }: { message: string }) {
    return (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-950/30 dark:text-red-100">
            {message}
        </p>
    );
}
function strings(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter(
              (item): item is string =>
                  typeof item === 'string' && item.trim() !== '',
          )
        : [];
}
function string(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback;
}
function number(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
        ? value
        : fallback;
}
