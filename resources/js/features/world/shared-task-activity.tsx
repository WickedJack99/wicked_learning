import { ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type {
    ActivityTransition,
    LearningActivity,
    SharedTaskState,
} from '@/types';
import { numericConfig, stringValue } from './activity-utils';
import { postJson } from './api';

export function SharedTaskActivity({
    activity,
    onComplete,
    onMoveToActivity,
    playRunId,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    playRunId: string | null;
    transition: ActivityTransition | null;
}) {
    const [body, setBody] = useState('');
    const [state, setState] = useState<SharedTaskState>(
        activity.sharedTaskState ?? fallbackState(activity),
    );
    const t = usePlatformTranslation();
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [peerReviewBody, setPeerReviewBody] = useState('');
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
    const [peerReviewError, setPeerReviewError] = useState('');
    const [shareWithPeers, setShareWithPeers] = useState(false);
    const taskKind = sharedTaskKind(activity.config.taskKind);
    const kindCopy = sharedTaskKindCopy(taskKind, t);
    const minimumLength = numericConfig(activity.config.minimumLength, 20);
    const prompt = stringValue(
        activity.config.prompt,
        'Add a useful contribution.',
    );
    const instructions = stringValue(activity.config.instructions);
    const projectGoal = stringValue(activity.config.projectGoal);
    const projectDeliverable = stringValue(activity.config.projectDeliverable);
    const projectSteps = Array.isArray(activity.config.projectSteps)
        ? activity.config.projectSteps.filter(
              (step): step is string => typeof step === 'string',
          )
        : [];
    const inputLabel = stringValue(
        activity.config.inputLabel,
        kindCopy.inputLabel,
    );
    const canSubmit =
        Boolean(playRunId) &&
        !state.isComplete &&
        !isSubmitting &&
        body.trim().length >= minimumLength;

    async function submitContribution() {
        if (!playRunId || !canSubmit) {
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await postJson<{ state: SharedTaskState }>(
                `/learning/activities/${activity.id}/shared-task-submissions`,
                {
                    body,
                    play_run_id: playRunId,
                    share_with_peers: shareWithPeers,
                },
            );

            setBody('');
            setState(response.state);

            if (response.state.isComplete && !response.state.peerReview?.enabled) {
                await complete();
            }
        } catch {
            setError(
                t(
                    'activities.shared_task.submit_error',
                    'This contribution could not be accepted.',
                ),
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function submitPeerReview() {
        if (
            !playRunId ||
            !state.peerReview?.enabled ||
            state.peerReview.hasReviewed ||
            selectedSubmissionId === null ||
            peerReviewBody.trim().length < 10 ||
            isSubmittingReview
        ) {
            return;
        }

        setIsSubmittingReview(true);
        setPeerReviewError('');

        try {
            const response = await postJson<{ state: SharedTaskState }>(
                `/learning/activities/${activity.id}/shared-task-reviews`,
                {
                    body: peerReviewBody,
                    play_run_id: playRunId,
                    submission_id: selectedSubmissionId,
                },
            );

            setPeerReviewBody('');
            setSelectedSubmissionId(null);
            setState(response.state);
        } catch {
            setPeerReviewError(
                t(
                    'activities.shared_task.peer_review_submit_error',
                    'This peer review could not be saved.',
                ),
            );
        } finally {
            setIsSubmittingReview(false);
        }
    }

    async function complete() {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    }

    return (
        <div className="flex flex-1 flex-col gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
                <p className="text-xs font-semibold tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200">
                    {kindCopy.label}
                </p>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-100">
                    {prompt}
                </p>
                {instructions ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {instructions}
                    </p>
                ) : null}
            </div>

            {projectGoal || projectDeliverable || projectSteps.length > 0 ? (
                <SharedTaskProjectBrief
                    deliverable={projectDeliverable}
                    goal={projectGoal}
                    steps={projectSteps}
                    t={t}
                />
            ) : null}

            <SharedTaskProgress state={state} t={t} />

            {state.hasSubmitted ? (
                <p
                    aria-live="polite"
                    className="text-sm text-slate-600 dark:text-slate-300"
                >
                    {t(
                        'activities.shared_task.contribution_recorded',
                        'Your contribution has been recorded.',
                    )}
                </p>
            ) : null}

            {state.contributions.length > 0 ? (
                <SharedTaskContributions
                    contributions={state.contributions}
                    t={t}
                />
            ) : null}

            {state.peerReview?.enabled ? (
                <SharedTaskPeerReview
                    body={peerReviewBody}
                    error={peerReviewError}
                    isSubmitting={isSubmittingReview}
                    onBodyChange={setPeerReviewBody}
                    onSelect={setSelectedSubmissionId}
                    onSubmit={() => void submitPeerReview()}
                    selectedSubmissionId={selectedSubmissionId}
                    state={state}
                    t={t}
                />
            ) : null}

            {state.isComplete ? (
                <Button className="mt-auto" onClick={() => void complete()}>
                    {t('common.continue', 'Continue')}
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            ) : (
                <div className="grid gap-2">
                    <label
                        className="text-sm font-medium text-slate-700 dark:text-slate-200"
                        htmlFor={`shared-task-${activity.id}`}
                    >
                        {inputLabel}
                    </label>
                    <textarea
                        className="min-h-32 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                        id={`shared-task-${activity.id}`}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder={t(
                            kindCopy.placeholderKey,
                            kindCopy.placeholder,
                        )}
                        value={body}
                    />
                    {state.canShareContributions ? (
                        <label className="flex items-start gap-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                            <input
                                checked={shareWithPeers}
                                className="mt-0.5 size-4 accent-cyan-600 dark:accent-teal-300"
                                onChange={(event) =>
                                    setShareWithPeers(event.target.checked)
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
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                            {t(
                                'activities.shared_task.character_count',
                                ':current / :minimum characters',
                                {
                                    current: body.trim().length,
                                    minimum: minimumLength,
                                },
                            )}
                        </span>
                        {error ? (
                            <span
                                aria-live="assertive"
                                className="font-medium text-red-600 dark:text-red-300"
                                role="alert"
                            >
                                {error}
                            </span>
                        ) : null}
                    </div>
                    <Button
                        className="mt-2"
                        disabled={!canSubmit}
                        onClick={() => void submitContribution()}
                        type="button"
                    >
                        <Send className="size-4" />
                        {t(
                            'activities.shared_task.submit',
                            'Submit contribution',
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}

function SharedTaskProjectBrief({
    deliverable,
    goal,
    steps,
    t,
}: {
    deliverable: string;
    goal: string;
    steps: string[];
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    return (
        <section
            aria-labelledby="shared-task-project-brief-heading"
            className="rounded-lg border border-cyan-200/70 bg-cyan-50/60 p-4 dark:border-teal-200/20 dark:bg-teal-100/6"
        >
            <h3
                className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                id="shared-task-project-brief-heading"
            >
                {t('activities.shared_task.project_brief', 'Project brief')}
            </h3>
            <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200 sm:grid-cols-2">
                {goal ? (
                    <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200">
                            {t('activities.shared_task.project_goal', 'Shared goal')}
                        </p>
                        <p>{goal}</p>
                    </div>
                ) : null}
                {deliverable ? (
                    <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200">
                            {t('activities.shared_task.project_deliverable', 'Useful outcome')}
                        </p>
                        <p>{deliverable}</p>
                    </div>
                ) : null}
            </div>
            {steps.length > 0 ? (
                <div className="mt-3">
                    <p className="text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200">
                        {t('activities.shared_task.project_steps', 'Suggested steps')}
                    </p>
                    <ol className="mt-1 list-inside list-decimal text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {steps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                </div>
            ) : null}
        </section>
    );
}

type SharedTaskKind = 'text' | 'question' | 'reflection';

function SharedTaskContributions({
    contributions,
    t,
}: {
    contributions: SharedTaskState['contributions'];
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    return (
        <section
            aria-labelledby="shared-task-contributions-heading"
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6"
        >
            <h3
                className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                id="shared-task-contributions-heading"
            >
                {t(
                    'activities.shared_task.recent_contributions',
                    'Recent anonymous contributions',
                )}
            </h3>
            <div className="mt-3 grid gap-2">
                {contributions.map((contribution, index) => (
                    <article
                        className="rounded-md border border-slate-200/80 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-200"
                        key={`${contribution.submittedAt ?? 'contribution'}-${index}`}
                    >
                        <p>
                            {contribution.body}
                            {contribution.truncated ? '…' : ''}
                        </p>
                    </article>
                ))}
            </div>
        </section>
    );
}

function SharedTaskPeerReview({
    body,
    error,
    isSubmitting,
    onBodyChange,
    onSelect,
    onSubmit,
    selectedSubmissionId,
    state,
    t,
}: {
    body: string;
    error: string;
    isSubmitting: boolean;
    onBodyChange: (value: string) => void;
    onSelect: (value: number | null) => void;
    onSubmit: () => void;
    selectedSubmissionId: number | null;
    state: SharedTaskState;
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const peerReview = state.peerReview;

    if (!peerReview) {
        return null;
    }

    return (
        <section
            aria-labelledby="shared-task-peer-review-heading"
            className="rounded-lg border border-violet-200/70 bg-violet-50/60 p-4 dark:border-violet-200/20 dark:bg-violet-100/6"
        >
            <h3
                className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                id="shared-task-peer-review-heading"
            >
                {t('activities.shared_task.peer_review', 'Peer review')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {peerReview.prompt}
            </p>
            {peerReview.receivedReviews.length > 0 ? (
                <div className="mt-3 rounded-md border border-violet-200/80 bg-white/70 p-3 dark:border-violet-200/15 dark:bg-slate-950/30">
                    <p className="text-xs font-semibold tracking-[0.12em] text-violet-700 uppercase dark:text-violet-200">
                        {t(
                            'activities.shared_task.peer_review_received',
                            'Responses to your contribution',
                        )}
                    </p>
                    <div className="mt-2 grid gap-2">
                        {peerReview.receivedReviews.map((review) => (
                            <p
                                className="text-sm leading-6 text-slate-700 dark:text-slate-200"
                                key={review.id}
                            >
                                {review.body}
                            </p>
                        ))}
                    </div>
                </div>
            ) : null}
            {peerReview.hasReviewed ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {t(
                        'activities.shared_task.peer_review_recorded',
                        'Your anonymous peer review has been recorded.',
                    )}
                </p>
            ) : !state.hasSubmitted ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {t(
                        'activities.shared_task.peer_review_contribute_first',
                        'Contribute first, then you can respond to one shared contribution.',
                    )}
                </p>
            ) : peerReview.reviewableContributions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {t(
                        'activities.shared_task.peer_review_waiting',
                        'There is no other shared contribution available yet.',
                    )}
                </p>
            ) : (
                <div className="mt-3 grid gap-3">
                    <fieldset className="grid gap-2">
                        <legend className="text-xs font-semibold tracking-[0.12em] text-violet-700 uppercase dark:text-violet-200">
                            {t(
                                'activities.shared_task.peer_review_choose',
                                'Choose one anonymous contribution',
                            )}
                        </legend>
                        {peerReview.reviewableContributions.map((contribution) => (
                            <label
                                className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200/80 bg-white p-3 text-sm leading-6 text-slate-700 has-[:checked]:border-violet-500 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-200 dark:has-[:checked]:border-violet-200"
                                key={contribution.id}
                            >
                                <input
                                    checked={selectedSubmissionId === contribution.id}
                                    className="mt-1 size-4 accent-violet-600 dark:accent-violet-200"
                                    name="shared-task-peer-review-submission"
                                    onChange={() => onSelect(contribution.id)}
                                    type="radio"
                                />
                                <span>
                                    {contribution.body}
                                    {contribution.truncated ? '…' : ''}
                                </span>
                            </label>
                        ))}
                    </fieldset>
                    <label
                        className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                        htmlFor="shared-task-peer-review-body"
                    >
                        {t(
                            'activities.shared_task.peer_review_response_label',
                            'Your response',
                        )}
                        <textarea
                            className="min-h-24 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-violet-200/70"
                            id="shared-task-peer-review-body"
                            onChange={(event) => onBodyChange(event.target.value)}
                            placeholder={t(
                                'activities.shared_task.peer_review_response_placeholder',
                                'Name a useful connection, question, or extension.',
                            )}
                            value={body}
                        />
                    </label>
                    {error ? (
                        <p aria-live="assertive" className="text-sm font-medium text-red-600 dark:text-red-300" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <Button
                        disabled={
                            selectedSubmissionId === null ||
                            body.trim().length < 10 ||
                            isSubmitting
                        }
                        onClick={onSubmit}
                        type="button"
                    >
                        {isSubmitting
                            ? t('common.saving', 'Saving…')
                            : t(
                                  'activities.shared_task.peer_review_submit',
                                  'Save peer review',
                              )}
                    </Button>
                </div>
            )}
        </section>
    );
}

function sharedTaskKind(value: unknown): SharedTaskKind {
    return value === 'question' || value === 'reflection' ? value : 'text';
}

function sharedTaskKindCopy(
    kind: SharedTaskKind,
    t: ReturnType<typeof usePlatformTranslation>,
): {
    inputLabel: string;
    label: string;
    placeholder: string;
    placeholderKey: string;
} {
    if (kind === 'question') {
        return {
            inputLabel: t(
                'activities.shared_task.kind.question.input_label',
                'Your question',
            ),
            label: t(
                'activities.shared_task.kind.question.label',
                'Question for the group',
            ),
            placeholder: t(
                'activities.shared_task.kind.question.placeholder',
                'Ask a question that would help the group think further.',
            ),
            placeholderKey: 'activities.shared_task.kind.question.placeholder',
        };
    }

    if (kind === 'reflection') {
        return {
            inputLabel: t(
                'activities.shared_task.kind.reflection.input_label',
                'Your reflection',
            ),
            label: t(
                'activities.shared_task.kind.reflection.label',
                'Reflection for the group',
            ),
            placeholder: t(
                'activities.shared_task.kind.reflection.placeholder',
                'Share what changed, surprised you, or remains open.',
            ),
            placeholderKey:
                'activities.shared_task.kind.reflection.placeholder',
        };
    }

    return {
        inputLabel: t(
            'activities.shared_task.kind.text.input_label',
            'Your contribution',
        ),
        label: t(
            'activities.shared_task.kind.text.label',
            'Contribution for the group',
        ),
        placeholder: t(
            'activities.shared_task.placeholder',
            'Write a contribution for the shared task.',
        ),
        placeholderKey: 'activities.shared_task.placeholder',
    };
}

function SharedTaskProgress({
    state,
    t,
}: {
    state: SharedTaskState;
    t: ReturnType<typeof usePlatformTranslation>;
}) {
    const percent =
        state.threshold > 0
            ? Math.min(100, (state.acceptedCount / state.threshold) * 100)
            : 100;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t('activities.shared_task.progress', 'Shared progress')}
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-cyan-700 dark:text-teal-200">
                    {state.isComplete ? (
                        <CheckCircle2 className="size-4" />
                    ) : null}
                    {state.acceptedCount} / {state.threshold}
                </span>
            </div>
            <div
                aria-label={t(
                    'activities.shared_task.progress_label',
                    'Shared task progress',
                )}
                aria-valuemax={state.threshold}
                aria-valuemin={0}
                aria-valuenow={state.acceptedCount}
                className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10"
                role="progressbar"
            >
                <div
                    className="h-full rounded-full bg-cyan-600 dark:bg-teal-300"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p
                aria-live="polite"
                className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400"
            >
                {state.isComplete
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
    );
}

function fallbackState(activity: LearningActivity): SharedTaskState {
    const threshold = numericConfig(activity.config.threshold, 3);

    return {
        canShareContributions: false,
        contributions: [],
        hasSubmitted: false,
        acceptedCount: 0,
        isComplete: false,
        latestSubmissionAt: null,
        remaining: threshold,
        peerReview: null,
        threshold,
    };
}
