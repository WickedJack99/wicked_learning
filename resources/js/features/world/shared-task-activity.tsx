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
    const [shareWithPeers, setShareWithPeers] = useState(false);
    const taskKind = sharedTaskKind(activity.config.taskKind);
    const kindCopy = sharedTaskKindCopy(taskKind, t);
    const minimumLength = numericConfig(activity.config.minimumLength, 20);
    const prompt = stringValue(
        activity.config.prompt,
        'Add a useful contribution.',
    );
    const instructions = stringValue(activity.config.instructions);
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

            if (response.state.isComplete) {
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
        threshold,
    };
}
