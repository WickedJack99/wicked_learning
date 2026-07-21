import { ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const minimumLength = numericConfig(activity.config.minimumLength, 20);
    const prompt = stringValue(
        activity.config.prompt,
        'Add a useful contribution.',
    );
    const instructions = stringValue(activity.config.instructions);
    const inputLabel = stringValue(
        activity.config.inputLabel,
        'Your contribution',
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
                },
            );

            setBody('');
            setState(response.state);

            if (response.state.isComplete) {
                await complete();
            }
        } catch {
            setError('This contribution could not be accepted.');
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
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-100">
                    {prompt}
                </p>
                {instructions ? (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {instructions}
                    </p>
                ) : null}
            </div>

            <SharedTaskProgress state={state} />

            {state.isComplete ? (
                <Button className="mt-auto" onClick={() => void complete()}>
                    Continue
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
                        placeholder="Write a contribution for the shared task."
                        value={body}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                            {body.trim().length} / {minimumLength} characters
                        </span>
                        {error ? (
                            <span className="font-medium text-red-600 dark:text-red-300">
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
                        Submit contribution
                    </Button>
                </div>
            )}
        </div>
    );
}

function SharedTaskProgress({ state }: { state: SharedTaskState }) {
    const percent =
        state.threshold > 0
            ? Math.min(100, (state.acceptedCount / state.threshold) * 100)
            : 100;

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Shared progress
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-cyan-700 dark:text-teal-200">
                    {state.isComplete ? (
                        <CheckCircle2 className="size-4" />
                    ) : null}
                    {state.acceptedCount} / {state.threshold}
                </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div
                    className="h-full rounded-full bg-cyan-600 dark:bg-teal-300"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {state.isComplete
                    ? 'Threshold reached.'
                    : `${state.remaining} more accepted contribution${state.remaining === 1 ? '' : 's'} needed.`}
            </p>
        </div>
    );
}

function fallbackState(activity: LearningActivity): SharedTaskState {
    const threshold = numericConfig(activity.config.threshold, 3);

    return {
        acceptedCount: 0,
        isComplete: false,
        latestSubmissionAt: null,
        remaining: threshold,
        threshold,
    };
}
