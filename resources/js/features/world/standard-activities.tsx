import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Map as MapIcon,
    MessageCircle,
    RotateCcw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type {
    ActivityTransition,
    LearningActivity,
    LearningNode,
    LearningPortalLink,
    QuestionAnswerProgress,
} from '@/types';
import { numericConfig, stringConfig } from './activity-utils';
import { postJson } from './api';
import { PortalScene } from './portal-scene';

export function PlaceholderActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const nextStep =
        typeof activity.config.nextStep === 'string'
            ? activity.config.nextStep
            : 'A concrete interaction can be attached here next.';
    const complete = async () => {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    };

    return (
        <div className="flex flex-1 flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {nextStep}
            </p>
            <Button className="mt-auto" onClick={() => void complete()}>
                Continue
                <ArrowRight className="ml-2 size-4" />
            </Button>
        </div>
    );
}

export function PortalActivity({
    activity,
    node,
    onComplete,
    onMoveToActivity,
    onTravel,
    transition,
}: {
    activity: LearningActivity;
    node: LearningNode;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    onTravel: (portalLink: LearningPortalLink) => void;
    transition: ActivityTransition | null;
}) {
    const [isTravelling, setIsTravelling] = useState(false);
    const skippedExitActivityId = useRef<number | null>(null);
    const { resolvedAppearance } = useAppearance();
    const portalMode = activity.config.portalMode;
    const link =
        node.outgoingPortalLinks.find(
            (candidate) => candidate.sourceActivityId === activity.id,
        ) ??
        node.outgoingPortalLinks[0] ??
        null;
    const isInputPortal = portalMode === 'input';
    const durationSeconds = numericConfig(
        activity.config.portalDurationSeconds,
        1.5,
    );
    const foregroundX = numericConfig(activity.config.portalForegroundX, 50);
    const foregroundY = numericConfig(activity.config.portalForegroundY, 50);
    const foregroundWidth = numericConfig(
        activity.config.portalForegroundWidth,
        28,
    );
    const backgroundImage =
        resolvedAppearance === 'light'
            ? stringConfig(activity.config.portalBackgroundLight) ||
              stringConfig(activity.config.portalBackgroundDark)
            : stringConfig(activity.config.portalBackgroundDark) ||
              stringConfig(activity.config.portalBackgroundLight);
    const foregroundImage =
        resolvedAppearance === 'light'
            ? stringConfig(activity.config.portalForegroundLight) ||
              stringConfig(activity.config.portalForegroundDark)
            : stringConfig(activity.config.portalForegroundDark) ||
              stringConfig(activity.config.portalForegroundLight);
    const swirlEnabled = activity.config.portalSwirlEnabled !== false;
    const showOnArrival = activity.config.portalShowOnArrival !== false;
    const waitForEnter = activity.config.portalWaitForEnter === true;

    const travel = useCallback(async () => {
        if (!link) {
            return;
        }

        setIsTravelling(true);

        try {
            await onComplete(activity);
            onTravel(link);
        } finally {
            setIsTravelling(false);
        }
    }, [activity, link, onComplete, onTravel]);

    useEffect(() => {
        if (
            !isInputPortal ||
            showOnArrival ||
            skippedExitActivityId.current === activity.id
        ) {
            return;
        }

        skippedExitActivityId.current = activity.id;

        void onComplete(activity)
            .then(() => onMoveToActivity(transition?.toActivityId ?? null))
            .catch(() => {
                skippedExitActivityId.current = null;
            });
    }, [
        activity,
        isInputPortal,
        onComplete,
        onMoveToActivity,
        showOnArrival,
        transition,
    ]);

    useEffect(() => {
        if ((isInputPortal && !showOnArrival) || waitForEnter) {
            return;
        }

        const timer = window.setTimeout(
            () => {
                if (isInputPortal) {
                    void onComplete(activity).then(() =>
                        onMoveToActivity(transition?.toActivityId ?? null),
                    );

                    return;
                }

                void travel();
            },
            Math.max(0.5, durationSeconds) * 1000,
        );

        return () => window.clearTimeout(timer);
    }, [
        activity,
        durationSeconds,
        isInputPortal,
        onComplete,
        onMoveToActivity,
        showOnArrival,
        transition,
        travel,
        waitForEnter,
    ]);

    const enterPortal = async () => {
        if (isTravelling) {
            return;
        }

        if (isInputPortal) {
            setIsTravelling(true);

            try {
                await onComplete(activity);
                onMoveToActivity(transition?.toActivityId ?? null);
            } finally {
                setIsTravelling(false);
            }

            return;
        }

        await travel();
    };

    if (isInputPortal && !showOnArrival) {
        return (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
                Continuing from this exit portal...
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 items-center">
            <PortalScene
                backgroundImage={backgroundImage}
                foregroundImage={foregroundImage}
                foregroundWidth={foregroundWidth}
                foregroundX={foregroundX}
                foregroundY={foregroundY}
                swirlEnabled={swirlEnabled}
            >
                <div className="relative z-20 mt-auto flex w-full items-start gap-3 bg-white/82 p-4 backdrop-blur dark:bg-slate-950/72">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-teal-300/14 dark:text-teal-200">
                        <MapIcon className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-950 dark:text-white">
                            {isInputPortal
                                ? 'Exit portal'
                                : link
                                  ? (link.label ?? 'Linked portal')
                                  : 'Portal not linked yet'}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {isInputPortal
                                ? 'This portal is configured as the exit point for paths that arrive here.'
                                : link
                                  ? `Travel to ${link.targetMapTitle} / ${link.targetNodeTitle}.`
                                  : 'An admin can choose a target exit portal in this portal activity.'}
                        </p>
                        {link?.description ? (
                            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                {link.description}
                            </p>
                        ) : null}
                        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {isTravelling
                                ? 'Travelling...'
                                : waitForEnter
                                  ? 'Waiting for the player to enter.'
                                  : `Continuing in ${durationSeconds.toFixed(1)} seconds.`}
                        </p>
                        {waitForEnter ? (
                            <Button
                                className="mt-4"
                                disabled={!isInputPortal && !link}
                                onClick={() => void enterPortal()}
                                type="button"
                            >
                                {isInputPortal ? 'Continue' : 'Enter portal'}
                                <ArrowRight className="ml-2 size-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>
            </PortalScene>
        </div>
    );
}

export function DialogueActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const [stageIndex, setStageIndex] = useState(0);
    const stages = activity.dialogueStages;
    const stage = stages[stageIndex];
    const canGoBack = stageIndex > 0;
    const canGoForward = stageIndex < stages.length - 1;

    if (!stage) {
        return null;
    }

    const completeDialogue = async () => {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/55">
                {stage.portraitUrl ? (
                    <img
                        alt={stage.imageAlt ?? stage.speakerName}
                        className="aspect-[4/3] w-full object-cover"
                        src={stage.portraitUrl}
                    />
                ) : null}
            </div>

            <div className="rounded-lg border border-cyan-500/20 bg-cyan-50 p-4 dark:border-teal-200/20 dark:bg-teal-100/8">
                <div className="mb-3 flex items-center gap-2 text-cyan-700 dark:text-teal-100">
                    <MessageCircle className="size-4" />
                    <span className="text-sm font-medium">
                        {stage.speakerName}
                    </span>
                    {stage.speakerRole ? (
                        <span className="text-xs text-cyan-600 dark:text-teal-100/60">
                            {stage.speakerRole}
                        </span>
                    ) : null}
                </div>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-100">
                    {stage.body}
                </p>
            </div>

            <div className="mt-auto flex items-center justify-between gap-3">
                <Button
                    disabled={!canGoBack}
                    onClick={() =>
                        setStageIndex((current) => Math.max(0, current - 1))
                    }
                    size="icon"
                    variant="secondary"
                >
                    <ArrowLeft className="size-4" />
                </Button>

                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {stageIndex + 1} / {stages.length}
                </span>

                {canGoForward ? (
                    <Button
                        onClick={() =>
                            setStageIndex((current) =>
                                Math.min(stages.length - 1, current + 1),
                            )
                        }
                        size="icon"
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                ) : (
                    <Button onClick={completeDialogue}>
                        {transition?.label ?? 'Continue'}
                        <ArrowRight className="ml-2 size-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}

export function QuestionActivity({
    activity,
    answer,
    onAnswer,
    onMoveToActivity,
}: {
    activity: LearningActivity;
    answer: QuestionAnswerProgress | undefined;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    onMoveToActivity: (activityId: number | null) => void;
}) {
    const question = activity.question;
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!question) {
        return null;
    }

    const submitAnswer = async (optionId: number) => {
        setIsSubmitting(true);

        try {
            const response = await postJson<{ answer: QuestionAnswerProgress }>(
                `/learning/questions/${question.id}/answer`,
                {
                    option_id: optionId,
                },
            );

            onAnswer(question.id, response.answer);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-100">
                {question.prompt}
            </p>

            <div className="grid gap-3">
                {question.options.map((option) => (
                    <button
                        className={cn(
                            'rounded-lg border border-slate-200 bg-white p-4 text-left text-sm leading-6 text-slate-700 transition hover:border-cyan-500/60 hover:bg-cyan-50 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-100 dark:hover:border-teal-200/60 dark:hover:bg-teal-100/8 dark:focus-visible:ring-teal-200',
                            answer?.optionId === option.id &&
                                'border-cyan-500/80 bg-cyan-50 dark:border-teal-200/80 dark:bg-teal-100/12',
                        )}
                        disabled={isSubmitting}
                        key={option.id}
                        onClick={() => void submitAnswer(option.id)}
                        type="button"
                    >
                        <span className="mr-2 font-semibold text-cyan-700 dark:text-teal-200">
                            {option.label}
                        </span>
                        {option.body}
                    </button>
                ))}
            </div>

            {answer ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/6">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-700 dark:text-teal-100">
                        {answer.isCorrect ? (
                            <CheckCircle2 className="size-4" />
                        ) : (
                            <RotateCcw className="size-4" />
                        )}
                        <span>
                            {answer.isCorrect
                                ? 'Useful clue found'
                                : 'Adjust the hypothesis'}
                        </span>
                    </div>
                    {answer.feedback ? (
                        <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                            {answer.feedback}
                        </p>
                    ) : null}
                    {answer.explanation ? (
                        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {answer.explanation}
                        </p>
                    ) : null}
                    {answer.nextActivityId ? (
                        <Button
                            className="mt-4"
                            onClick={() =>
                                onMoveToActivity(answer.nextActivityId ?? null)
                            }
                        >
                            Continue
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function ReflectionActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const [reflection, setReflection] = useState('');
    const prompt =
        typeof activity.config.prompt === 'string'
            ? activity.config.prompt
            : 'What feels clearer now?';
    const note =
        typeof activity.config.note === 'string' ? activity.config.note : null;

    return (
        <div className="flex flex-1 flex-col gap-4">
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                {prompt}
            </p>
            <textarea
                className="min-h-32 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                onChange={(event) => setReflection(event.target.value)}
                placeholder="Write a short note for yourself."
                value={reflection}
            />
            {note ? (
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {note}
                </p>
            ) : null}
            <Button
                className="mt-auto"
                disabled={reflection.trim().length === 0}
                onClick={() =>
                    void onComplete(activity).then(() =>
                        onMoveToActivity(transition?.toActivityId ?? null),
                    )
                }
            >
                Keep reflection
            </Button>
        </div>
    );
}
