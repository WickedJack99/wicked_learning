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
import { patchJson, postJson } from './api';

export function SharedTaskActivity({
    activity,
    initialState,
    onComplete,
    onMoveToActivity,
    playRunId,
    transition,
}: {
    activity: LearningActivity;
    initialState?: unknown;
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
    const [peerReviewResponseType, setPeerReviewResponseType] =
        useState<PeerReviewResponseType | null>(null);
    const [peerReviewProjectStepIndex, setPeerReviewProjectStepIndex] =
        useState<number | null>(null);
    const [selectedSubmissionId, setSelectedSubmissionId] = useState<
        number | null
    >(null);
    const [peerReviewError, setPeerReviewError] = useState('');
    const [updatingReviewId, setUpdatingReviewId] = useState<number | null>(
        null,
    );
    const [followUpReviewId, setFollowUpReviewId] = useState<number | null>(
        null,
    );
    const [followUpBody, setFollowUpBody] = useState('');
    const [followUpError, setFollowUpError] = useState('');
    const [savingFollowUpId, setSavingFollowUpId] = useState<number | null>(
        null,
    );
    const [shareWithPeers, setShareWithPeers] = useState(false);
    const [selectedProjectStepIndex, setSelectedProjectStepIndex] = useState<
        number | null
    >(null);
    const projectSteps = Array.isArray(activity.config.projectSteps)
        ? activity.config.projectSteps.filter(
              (step): step is string =>
                  typeof step === 'string' && step.trim() !== '',
          )
        : [];
    const [completedProjectStepIndexes, setCompletedProjectStepIndexes] =
        useState(() =>
            sharedTaskChecklistFromState(initialState, projectSteps.length),
        );
    const [updatingProjectStepIndex, setUpdatingProjectStepIndex] = useState<
        number | null
    >(null);
    const [projectChecklistError, setProjectChecklistError] = useState('');
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
                    project_step_index: selectedProjectStepIndex,
                    share_with_peers: shareWithPeers,
                },
            );

            setBody('');
            setSelectedProjectStepIndex(null);
            setState(response.state);

            if (
                response.state.isComplete &&
                !response.state.peerReview?.enabled
            ) {
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
                    response_type: peerReviewResponseType,
                    project_step_index: peerReviewProjectStepIndex,
                },
            );

            setPeerReviewBody('');
            setPeerReviewResponseType(null);
            setPeerReviewProjectStepIndex(null);
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

    async function updatePeerReviewHelpfulness(
        reviewId: number,
        helpful: boolean,
    ) {
        if (!playRunId || updatingReviewId !== null) {
            return;
        }

        setUpdatingReviewId(reviewId);
        setPeerReviewError('');

        try {
            const response = await patchJson<{ state: SharedTaskState }>(
                `/learning/activities/${activity.id}/shared-task-reviews/${reviewId}/helpfulness`,
                {
                    helpful,
                    play_run_id: playRunId,
                },
            );

            setState(response.state);
        } catch {
            setPeerReviewError(
                t(
                    'activities.shared_task.peer_review_helpful_error',
                    'The helpful response mark could not be saved yet.',
                ),
            );
        } finally {
            setUpdatingReviewId(null);
        }
    }

    async function updatePeerReviewFollowUp(reviewId: number, body: string) {
        if (!playRunId || savingFollowUpId !== null) {
            return;
        }

        setSavingFollowUpId(reviewId);
        setFollowUpError('');

        try {
            const response = await patchJson<{ state: SharedTaskState }>(
                `/learning/activities/${activity.id}/shared-task-reviews/${reviewId}/follow-up`,
                {
                    body: body.trim() || null,
                    play_run_id: playRunId,
                },
            );

            setState(response.state);
            setFollowUpReviewId(null);
            setFollowUpBody('');
        } catch {
            setFollowUpError(
                t(
                    'activities.shared_task.peer_review_follow_up_error',
                    'The private note could not be saved yet.',
                ),
            );
        } finally {
            setSavingFollowUpId(null);
        }
    }

    async function toggleProjectStep(index: number) {
        if (updatingProjectStepIndex !== null) {
            return;
        }

        const previousIndexes = completedProjectStepIndexes;
        const nextIndexes = previousIndexes.includes(index)
            ? previousIndexes.filter((stepIndex) => stepIndex !== index)
            : [...previousIndexes, index].sort((left, right) => left - right);

        setCompletedProjectStepIndexes(nextIndexes);
        setProjectChecklistError('');

        if (!playRunId) {
            return;
        }

        setUpdatingProjectStepIndex(index);

        try {
            const response = await postJson<{
                state: { completedStepIndexes: number[] };
            }>(`/learning/activities/${activity.id}/shared-task-checklist`, {
                completed_step_indexes: nextIndexes,
                play_run_id: playRunId,
            });

            setCompletedProjectStepIndexes(response.state.completedStepIndexes);
        } catch {
            setCompletedProjectStepIndexes(previousIndexes);
            setProjectChecklistError(
                t(
                    'activities.shared_task.project_checklist_error',
                    'The project step could not be saved yet.',
                ),
            );
        } finally {
            setUpdatingProjectStepIndex(null);
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
                    completedStepIndexes={completedProjectStepIndexes}
                    deliverable={projectDeliverable}
                    goal={projectGoal}
                    isUpdating={updatingProjectStepIndex !== null}
                    onToggleStep={(index) => void toggleProjectStep(index)}
                    error={projectChecklistError}
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
                    onHelpfulnessChange={(reviewId, helpful) =>
                        void updatePeerReviewHelpfulness(reviewId, helpful)
                    }
                    activeFollowUpId={followUpReviewId}
                    followUpBody={followUpBody}
                    followUpError={followUpError}
                    onFollowUpBodyChange={setFollowUpBody}
                    onFollowUpClose={() => {
                        setFollowUpReviewId(null);
                        setFollowUpBody('');
                    }}
                    onFollowUpOpen={(reviewId, body) => {
                        setFollowUpReviewId(reviewId);
                        setFollowUpBody(body);
                        setFollowUpError('');
                    }}
                    onFollowUpSave={(reviewId, body) =>
                        updatePeerReviewFollowUp(reviewId, body)
                    }
                    onSelect={setSelectedSubmissionId}
                    onProjectStepChange={setPeerReviewProjectStepIndex}
                    onResponseTypeChange={setPeerReviewResponseType}
                    onSubmit={() => void submitPeerReview()}
                    responseType={peerReviewResponseType}
                    projectStepIndex={peerReviewProjectStepIndex}
                    projectSteps={projectSteps}
                    selectedSubmissionId={selectedSubmissionId}
                    state={state}
                    t={t}
                    savingFollowUpId={savingFollowUpId}
                    updatingReviewId={updatingReviewId}
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
                    {projectSteps.length > 0 ? (
                        <label
                            className="grid gap-1 text-xs leading-5 text-slate-600 dark:text-slate-300"
                            htmlFor={`shared-task-step-${activity.id}`}
                        >
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                {t(
                                    'activities.shared_task.project_step_label',
                                    'Where would this contribution help? (optional)',
                                )}
                            </span>
                            <select
                                className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:focus:border-teal-200/70"
                                id={`shared-task-step-${activity.id}`}
                                onChange={(event) =>
                                    setSelectedProjectStepIndex(
                                        event.target.value === ''
                                            ? null
                                            : Number(event.target.value),
                                    )
                                }
                                value={selectedProjectStepIndex ?? ''}
                            >
                                <option value="">
                                    {t(
                                        'activities.shared_task.project_step_any',
                                        'Any project step',
                                    )}
                                </option>
                                {projectSteps.map((step, index) => (
                                    <option
                                        key={`${index}-${step}`}
                                        value={index}
                                    >
                                        {step}
                                    </option>
                                ))}
                            </select>
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
    completedStepIndexes,
    deliverable,
    error,
    goal,
    isUpdating,
    onToggleStep,
    steps,
    t,
}: {
    completedStepIndexes: number[];
    deliverable: string;
    error: string;
    goal: string;
    isUpdating: boolean;
    onToggleStep: (index: number) => void;
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
            <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2 dark:text-slate-200">
                {goal ? (
                    <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200">
                            {t(
                                'activities.shared_task.project_goal',
                                'Shared goal',
                            )}
                        </p>
                        <p>{goal}</p>
                    </div>
                ) : null}
                {deliverable ? (
                    <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200">
                            {t(
                                'activities.shared_task.project_deliverable',
                                'Useful outcome',
                            )}
                        </p>
                        <p>{deliverable}</p>
                    </div>
                ) : null}
            </div>
            {steps.length > 0 ? (
                <div className="mt-3">
                    <p className="text-xs font-semibold tracking-[0.12em] text-cyan-700 uppercase dark:text-teal-200">
                        {t(
                            'activities.shared_task.project_steps',
                            'Suggested steps',
                        )}
                    </p>
                    <ol className="mt-2 grid gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {steps.map((step, index) => (
                            <li key={`${index}-${step}`}>
                                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-cyan-200/70 bg-white/65 px-3 py-2 transition hover:border-cyan-400 dark:border-teal-200/15 dark:bg-slate-950/30 dark:hover:border-teal-200/40">
                                    <input
                                        aria-label={step}
                                        checked={completedStepIndexes.includes(
                                            index,
                                        )}
                                        className="mt-1 size-4 accent-cyan-600 dark:accent-teal-300"
                                        disabled={isUpdating}
                                        onChange={() => onToggleStep(index)}
                                        type="checkbox"
                                    />
                                    <span
                                        className={
                                            completedStepIndexes.includes(index)
                                                ? 'text-slate-500 line-through dark:text-slate-400'
                                                : undefined
                                        }
                                    >
                                        {step}
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {t(
                            'activities.shared_task.project_checklist_hint',
                            'Optional private planning notes for this run. They do not affect completion.',
                        )}
                    </p>
                    {error ? (
                        <p
                            aria-live="assertive"
                            className="text-xs font-medium text-red-600 dark:text-red-300"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

type SharedTaskKind = 'text' | 'question' | 'reflection';
type PeerReviewResponseType =
    | 'explanation'
    | 'example'
    | 'question'
    | 'counterexample';

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
                            {contribution.projectStep ? (
                                <span className="mb-1 block text-xs font-medium text-cyan-700 dark:text-teal-200">
                                    {t(
                                        'activities.shared_task.project_step',
                                        'Project step',
                                    )}
                                    : {contribution.projectStep}
                                </span>
                            ) : null}
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
    activeFollowUpId,
    body,
    error,
    followUpBody,
    followUpError,
    isSubmitting,
    onBodyChange,
    onFollowUpBodyChange,
    onFollowUpClose,
    onFollowUpOpen,
    onFollowUpSave,
    onHelpfulnessChange,
    onSelect,
    onProjectStepChange,
    onResponseTypeChange,
    onSubmit,
    responseType,
    projectStepIndex,
    projectSteps,
    savingFollowUpId,
    selectedSubmissionId,
    state,
    t,
    updatingReviewId,
}: {
    activeFollowUpId: number | null;
    body: string;
    error: string;
    followUpBody: string;
    followUpError: string;
    isSubmitting: boolean;
    onBodyChange: (value: string) => void;
    onFollowUpBodyChange: (value: string) => void;
    onFollowUpClose: () => void;
    onFollowUpOpen: (reviewId: number, body: string) => void;
    onFollowUpSave: (reviewId: number, body: string) => Promise<void>;
    onHelpfulnessChange: (reviewId: number, helpful: boolean) => void;
    onSelect: (value: number | null) => void;
    onProjectStepChange: (value: number | null) => void;
    onResponseTypeChange: (value: PeerReviewResponseType | null) => void;
    onSubmit: () => void;
    responseType: PeerReviewResponseType | null;
    projectStepIndex: number | null;
    projectSteps: string[];
    savingFollowUpId: number | null;
    selectedSubmissionId: number | null;
    state: SharedTaskState;
    t: ReturnType<typeof usePlatformTranslation>;
    updatingReviewId: number | null;
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
                            <article
                                className="grid gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200"
                                key={review.id}
                            >
                                <p>
                                    {review.responseType ? (
                                        <span className="mr-2 inline-flex rounded border border-violet-300/70 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-violet-700 uppercase dark:border-violet-200/30 dark:text-violet-200">
                                            {peerReviewResponseTypeLabel(
                                                review.responseType,
                                                t,
                                            )}
                                        </span>
                                    ) : null}
                                    {review.projectStep ? (
                                        <span className="mr-2 inline-flex rounded border border-cyan-300/70 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-cyan-700 uppercase dark:border-teal-200/30 dark:text-teal-200">
                                            {t(
                                                'activities.shared_task.project_step',
                                                'Project step',
                                            )}
                                            : {review.projectStep}
                                        </span>
                                    ) : null}
                                    {review.body}
                                    {review.canMarkHelpful ? (
                                        <button
                                            aria-pressed={review.isHelpful}
                                            className="ml-2 inline-flex min-h-11 items-center rounded border border-violet-300/70 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60 dark:border-violet-200/30 dark:text-violet-200 dark:hover:bg-violet-100/10"
                                            disabled={
                                                updatingReviewId === review.id
                                            }
                                            onClick={() =>
                                                onHelpfulnessChange(
                                                    review.id,
                                                    !review.isHelpful,
                                                )
                                            }
                                            type="button"
                                        >
                                            {review.isHelpful
                                                ? t(
                                                      'activities.shared_task.peer_review_helpful_clear',
                                                      'Clear helpful mark',
                                                  )
                                                : t(
                                                      'activities.shared_task.peer_review_helpful',
                                                      'This helped',
                                                  )}
                                        </button>
                                    ) : null}
                                </p>
                                {review.followUp ? (
                                    <p className="rounded-md border border-slate-200/80 bg-slate-50/70 p-2 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-300">
                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                            {t(
                                                'activities.shared_task.peer_review_follow_up_saved',
                                                'Private note:',
                                            )}
                                        </span>{' '}
                                        {review.followUp}
                                    </p>
                                ) : null}
                                {activeFollowUpId === review.id ? (
                                    <div className="grid gap-2 rounded-md border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-slate-950/35">
                                        <label
                                            className="grid gap-2 text-xs font-medium text-slate-700 dark:text-slate-200"
                                            htmlFor={`shared-task-follow-up-${review.id}`}
                                        >
                                            {t(
                                                'activities.shared_task.peer_review_follow_up_label',
                                                'What will you carry forward? (private)',
                                            )}
                                            <textarea
                                                className="min-h-20 resize-none rounded-md border border-slate-300/80 bg-white/80 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 dark:border-white/15 dark:bg-slate-950/50 dark:text-slate-100"
                                                id={`shared-task-follow-up-${review.id}`}
                                                onChange={(event) =>
                                                    onFollowUpBodyChange(
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder={t(
                                                    'activities.shared_task.peer_review_follow_up_placeholder',
                                                    'Note one idea, question, or next step for yourself.',
                                                )}
                                                value={followUpBody}
                                            />
                                        </label>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                disabled={
                                                    savingFollowUpId ===
                                                        review.id ||
                                                    (!followUpBody.trim() &&
                                                        !review.followUp)
                                                }
                                                onClick={() =>
                                                    void onFollowUpSave(
                                                        review.id,
                                                        followUpBody,
                                                    )
                                                }
                                                size="sm"
                                                type="button"
                                            >
                                                {savingFollowUpId === review.id
                                                    ? t(
                                                          'common.saving',
                                                          'Saving…',
                                                      )
                                                    : t(
                                                          'activities.shared_task.peer_review_follow_up_save',
                                                          'Save private note',
                                                      )}
                                            </Button>
                                            {review.followUp ? (
                                                <Button
                                                    disabled={
                                                        savingFollowUpId ===
                                                        review.id
                                                    }
                                                    onClick={() =>
                                                        void onFollowUpSave(
                                                            review.id,
                                                            '',
                                                        )
                                                    }
                                                    size="sm"
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {t(
                                                        'activities.shared_task.peer_review_follow_up_clear',
                                                        'Clear note',
                                                    )}
                                                </Button>
                                            ) : null}
                                            <button
                                                className="min-h-11 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/70 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-white/10"
                                                disabled={
                                                    savingFollowUpId ===
                                                    review.id
                                                }
                                                onClick={onFollowUpClose}
                                                type="button"
                                            >
                                                {t('common.cancel', 'Cancel')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="min-h-11 justify-self-start rounded px-2 py-1 text-left text-xs font-medium text-violet-700 hover:bg-violet-100/70 dark:text-violet-200 dark:hover:bg-violet-100/10"
                                        onClick={() =>
                                            onFollowUpOpen(
                                                review.id,
                                                review.followUp ?? '',
                                            )
                                        }
                                        type="button"
                                    >
                                        {review.followUp
                                            ? t(
                                                  'activities.shared_task.peer_review_follow_up_edit',
                                                  'Edit private note',
                                              )
                                            : t(
                                                  'activities.shared_task.peer_review_follow_up_add',
                                                  'Add private note',
                                              )}
                                    </button>
                                )}
                            </article>
                        ))}
                    </div>
                    {followUpError ? (
                        <p
                            aria-live="assertive"
                            className="mt-2 text-sm font-medium text-red-600 dark:text-red-300"
                            role="alert"
                        >
                            {followUpError}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {error ? (
                <p
                    aria-live="assertive"
                    className="mt-3 text-sm font-medium text-red-600 dark:text-red-300"
                    role="alert"
                >
                    {error}
                </p>
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
                        {peerReview.reviewableContributions.map(
                            (contribution) => (
                                <label
                                    className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200/80 bg-white p-3 text-sm leading-6 text-slate-700 has-[:checked]:border-violet-500 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-200 dark:has-[:checked]:border-violet-200"
                                    key={contribution.id}
                                >
                                    <input
                                        checked={
                                            selectedSubmissionId ===
                                            contribution.id
                                        }
                                        className="mt-1 size-4 accent-violet-600 dark:accent-violet-200"
                                        name="shared-task-peer-review-submission"
                                        onChange={() =>
                                            onSelect(contribution.id)
                                        }
                                        type="radio"
                                    />
                                    <span>
                                        {contribution.projectStep ? (
                                            <span className="mb-1 block text-xs font-medium text-cyan-700 dark:text-teal-200">
                                                {t(
                                                    'activities.shared_task.project_step',
                                                    'Project step',
                                                )}
                                                : {contribution.projectStep}
                                            </span>
                                        ) : null}
                                        {contribution.body}
                                        {contribution.truncated ? '…' : ''}
                                    </span>
                                </label>
                            ),
                        )}
                    </fieldset>
                    <fieldset className="grid gap-2">
                        <legend className="text-xs font-semibold tracking-[0.12em] text-violet-700 uppercase dark:text-violet-200">
                            {t(
                                'activities.shared_task.peer_review_response_type',
                                'What kind of response is this? (optional)',
                            )}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {peerReviewResponseTypes(t).map((option) => (
                                <label
                                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 has-[:checked]:border-violet-500 dark:border-white/10 dark:bg-slate-950/35 dark:text-slate-200 dark:has-[:checked]:border-violet-200"
                                    key={option.value}
                                >
                                    <input
                                        checked={responseType === option.value}
                                        className="size-4 accent-violet-600 dark:accent-violet-200"
                                        name="shared-task-peer-review-response-type"
                                        onChange={() =>
                                            onResponseTypeChange(option.value)
                                        }
                                        type="radio"
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                        {responseType ? (
                            <button
                                className="justify-self-start text-xs text-slate-600 underline underline-offset-2 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-200"
                                onClick={() => onResponseTypeChange(null)}
                                type="button"
                            >
                                {t(
                                    'activities.shared_task.peer_review_response_type_clear',
                                    'Clear response type',
                                )}
                            </button>
                        ) : null}
                    </fieldset>
                    {projectSteps.length > 0 ? (
                        <label
                            className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                            htmlFor="shared-task-peer-review-project-step"
                        >
                            {t(
                                'activities.shared_task.peer_review_project_step',
                                'What project step does this response address? (optional)',
                            )}
                            <select
                                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:focus:border-violet-200/70"
                                id="shared-task-peer-review-project-step"
                                onChange={(event) =>
                                    onProjectStepChange(
                                        event.target.value === ''
                                            ? null
                                            : Number(event.target.value),
                                    )
                                }
                                value={projectStepIndex ?? ''}
                            >
                                <option value="">
                                    {t(
                                        'activities.shared_task.peer_review_project_step_any',
                                        'No specific step',
                                    )}
                                </option>
                                {projectSteps.map((step, index) => (
                                    <option
                                        key={`${index}-${step}`}
                                        value={index}
                                    >
                                        {step}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
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
                            onChange={(event) =>
                                onBodyChange(event.target.value)
                            }
                            placeholder={t(
                                'activities.shared_task.peer_review_response_placeholder',
                                'Name a useful connection, question, or extension.',
                            )}
                            value={body}
                        />
                    </label>
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

function peerReviewResponseTypes(
    t: ReturnType<typeof usePlatformTranslation>,
): Array<{ value: PeerReviewResponseType; label: string }> {
    return [
        {
            value: 'explanation',
            label: t(
                'activities.shared_task.peer_review_type.explanation',
                'Explanation',
            ),
        },
        {
            value: 'example',
            label: t(
                'activities.shared_task.peer_review_type.example',
                'Example',
            ),
        },
        {
            value: 'question',
            label: t(
                'activities.shared_task.peer_review_type.question',
                'Question',
            ),
        },
        {
            value: 'counterexample',
            label: t(
                'activities.shared_task.peer_review_type.counterexample',
                'Counterexample',
            ),
        },
    ];
}

function peerReviewResponseTypeLabel(
    value: string,
    t: ReturnType<typeof usePlatformTranslation>,
): string {
    return (
        peerReviewResponseTypes(t).find((option) => option.value === value)
            ?.label ?? value
    );
}

function sharedTaskKind(value: unknown): SharedTaskKind {
    return value === 'question' || value === 'reflection' ? value : 'text';
}

function sharedTaskChecklistFromState(
    value: unknown,
    stepCount: number,
): number[] {
    if (!value || typeof value !== 'object') {
        return [];
    }

    const sharedTaskState = (value as { sharedTask?: unknown }).sharedTask;

    if (!sharedTaskState || typeof sharedTaskState !== 'object') {
        return [];
    }

    const indexes = (sharedTaskState as { completedStepIndexes?: unknown })
        .completedStepIndexes;

    if (!Array.isArray(indexes)) {
        return [];
    }

    return Array.from(
        new Set(
            indexes.filter(
                (index): index is number =>
                    Number.isInteger(index) && index >= 0 && index < stepCount,
            ),
        ),
    ).sort((left, right) => left - right);
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
