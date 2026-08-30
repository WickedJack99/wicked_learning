import {
    ArrowRight,
    Bookmark,
    CheckCircle2,
    Map as MapIcon,
    RotateCcw,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    queueRecallQuestion,
    removeRecallQuestion,
    saveRecallFeedback,
} from '@/features/learning/recall-items';
import {
    reviewOutcomeDescription,
    reviewOutcomeOptions,
} from '@/features/learning/review-outcomes';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import type {
    ActivityCompletionOutcome,
    ActivityTransition,
    LearningActivity,
    LearningNode,
    LearningPortalLink,
    QuestionCalibration,
    QuestionConfidence,
    QuestionAnswerProgress,
    ReviewOutcome,
} from '@/types';
import {
    booleanConfig,
    numericConfig,
    stringConfig,
    TypingText,
} from './activity-utils';
import { postJson } from './api';
import { PortalScene } from './portal-scene';
import type { PortalSceneAsset } from './portal-scene';

const DEFAULT_OPEN_PRACTICE_STEP =
    'Choose a useful next step, then continue when you are ready.';

export function OpenPracticeActivity({
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
            : DEFAULT_OPEN_PRACTICE_STEP;
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
    const foregroundX = numericConfig(activity.config.portalForegroundX, 50);
    const foregroundY = numericConfig(activity.config.portalForegroundY, 50);
    const foregroundWidth = numericConfig(
        activity.config.portalForegroundWidth,
        28,
    );
    const backgroundMirrored = booleanConfig(
        activity.config.portalBackgroundMirrored,
        false,
    );
    const foregroundMirrored = booleanConfig(
        activity.config.portalForegroundMirrored,
        false,
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
    const sceneAssets = portalSceneAssets(
        activity.config.portalAssets,
        resolvedAppearance,
    );
    const swirlEnabled = activity.config.portalSwirlEnabled !== false;
    const showOnArrival = activity.config.portalShowOnArrival !== false;
    const bubbleText = stringConfig(activity.config.portalBubbleText).trim();
    const bubbleTypingSpeed = numericConfig(
        activity.config.portalBubbleTypingSpeed,
        24,
    );

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
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <PortalScene
                assets={sceneAssets}
                backgroundImage={backgroundImage}
                backgroundMirrored={backgroundMirrored}
                className="max-h-full"
                foregroundImage={foregroundImage}
                foregroundMirrored={foregroundMirrored}
                foregroundWidth={foregroundWidth}
                foregroundX={foregroundX}
                foregroundY={foregroundY}
                swirlEnabled={swirlEnabled}
            >
                <div className="relative z-20 mt-auto grid w-full gap-3 bg-white/82 p-4 backdrop-blur dark:bg-slate-950/72">
                    {bubbleText ? (
                        <div
                            className="rounded-lg border p-4 text-sm leading-6"
                            style={portalBubbleStyle(
                                activity,
                                resolvedAppearance,
                            )}
                        >
                            <TypingText
                                speed={bubbleTypingSpeed}
                                text={bubbleText}
                            />
                        </div>
                    ) : null}
                    <div className="flex items-start gap-3">
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
                            <Button
                                className="mt-4"
                                disabled={
                                    isTravelling || (!isInputPortal && !link)
                                }
                                onClick={() => void enterPortal()}
                                type="button"
                            >
                                {isInputPortal ? 'Continue' : 'Traverse'}
                                <ArrowRight className="ml-2 size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </PortalScene>
        </div>
    );
}

function portalBubbleStyle(
    activity: LearningActivity,
    appearance: 'dark' | 'light',
): CSSProperties {
    const isLight = appearance === 'light';

    return {
        backgroundColor:
            stringConfig(
                isLight
                    ? activity.config.portalBubbleColorLight
                    : activity.config.portalBubbleColorDark,
            ) || (isLight ? '#ffffff' : '#0f172a'),
        borderColor:
            stringConfig(
                isLight
                    ? activity.config.portalBubbleBorderColorLight
                    : activity.config.portalBubbleBorderColorDark,
            ) || (isLight ? '#0891b2' : '#2dd4bf'),
        color:
            stringConfig(
                isLight
                    ? activity.config.portalBubbleTextColorLight
                    : activity.config.portalBubbleTextColorDark,
            ) || (isLight ? '#0f172a' : '#f8fafc'),
    };
}

function portalSceneAssets(
    value: unknown,
    appearance: 'dark' | 'light',
): PortalSceneAsset[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(isRecord)
        .map((asset, index): PortalSceneAsset => {
            const imageDark = stringConfig(asset.imageDark);
            const imageLight = stringConfig(asset.imageLight);
            const image =
                appearance === 'light'
                    ? imageLight || imageDark
                    : imageDark || imageLight;

            return {
                id: stringConfig(asset.id) || `portal-asset-${index + 1}`,
                image,
                layer: portalAssetLayer(stringConfig(asset.layer)),
                mirrored: booleanConfig(asset.mirrored, false),
                opacity: numericConfig(asset.opacity, 100),
                width: numericConfig(asset.width, 28),
                x: numericConfig(asset.x, 50),
                y: numericConfig(asset.y, 50),
            };
        })
        .filter((asset) => asset.image);
}

function portalAssetLayer(value: string): PortalSceneAsset['layer'] {
    if (
        value === 'behind-background' ||
        value === 'above-background' ||
        value === 'above-foreground' ||
        value === 'front'
    ) {
        return value;
    }

    return 'above-background';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function QuestionActivity({
    activity,
    answer,
    canRecall,
    isCompleted,
    onAnswer,
    onComplete,
    onRecallChange,
    isRecall,
    isRevisit,
    onMoveToActivity,
    playRunId,
    recallQueued,
}: {
    activity: LearningActivity;
    answer: QuestionAnswerProgress | undefined;
    onAnswer: (questionId: number, answer: QuestionAnswerProgress) => void;
    canRecall: boolean;
    isCompleted: boolean;
    onRecallChange: (questionId: number, queued: boolean) => void;
    onComplete: (
        activity: LearningActivity,
        options?: {
            confidence?: QuestionConfidence;
            confidenceAfterFeedback?: QuestionConfidence;
            calibration?: QuestionCalibration;
            attemptNumber?: number;
            assistanceLevel?: string;
            outcome?: ActivityCompletionOutcome;
        },
    ) => Promise<void>;
    isRecall: boolean;
    isRevisit: boolean;
    onMoveToActivity: (activityId: number | null) => void;
    playRunId: string | null;
    recallQueued: boolean;
}) {
    const question = activity.question;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confidence, setConfidence] = useState<QuestionConfidence | null>(
        null,
    );
    const [confidenceAfterFeedback, setConfidenceAfterFeedback] =
        useState<QuestionConfidence | null>(null);
    const [isCompleting, setIsCompleting] = useState(false);
    const [isRecallUpdating, setIsRecallUpdating] = useState(false);
    const [recallError, setRecallError] = useState(false);
    const continueButtonRef = useRef<HTMLButtonElement>(null);
    const t = usePlatformTranslation();

    useEffect(() => {
        if (answer) {
            continueButtonRef.current?.focus();
        }
    }, [answer]);

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
                    confidence,
                    defer_completion: true,
                    is_recall: isRecall,
                    is_revisit: isRevisit,
                    play_run_id: playRunId,
                },
            );

            onAnswer(question.id, response.answer);
        } finally {
            setIsSubmitting(false);
        }
    };

    const completeQuestion = async () => {
        if (isCompleting || !answer) {
            return;
        }

        if (isCompleted) {
            if (isRecall && confidenceAfterFeedback) {
                setIsCompleting(true);

                try {
                    await saveRecallFeedback(
                        question.id,
                        confidenceAfterFeedback,
                    );
                } catch {
                    setRecallError(true);

                    return;
                } finally {
                    setIsCompleting(false);
                }
            }

            onMoveToActivity(answer.nextActivityId ?? null);

            return;
        }

        setIsCompleting(true);

        try {
            if (isRecall && confidenceAfterFeedback) {
                await saveRecallFeedback(question.id, confidenceAfterFeedback);
            }

            await onComplete(activity, {
                confidence: answer.confidence ?? undefined,
                confidenceAfterFeedback: confidenceAfterFeedback ?? undefined,
                calibration: answer.calibration ?? undefined,
                attemptNumber: answer.attemptNumber,
                assistanceLevel: 'independent',
                outcome: answer.isCorrect ? 'correct' : 'incorrect',
            });
            onMoveToActivity(answer.nextActivityId ?? null);
        } catch (error) {
            if (isRecall && confidenceAfterFeedback) {
                setRecallError(true);
            }

            throw error;
        } finally {
            setIsCompleting(false);
        }
    };

    const toggleRecall = async () => {
        setIsRecallUpdating(true);
        setRecallError(false);

        try {
            if (recallQueued) {
                await removeRecallQuestion(question.id);
            } else {
                await queueRecallQuestion(question.id);
            }

            onRecallChange(question.id, !recallQueued);
        } catch {
            setRecallError(true);
        } finally {
            setIsRecallUpdating(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-5">
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/6 dark:text-slate-100">
                {question.prompt}
            </p>

            {!answer ? (
                <div>
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        Optional starting sense
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        Choose a phrase for how settled your answer feels before
                        you check it.
                    </p>
                    <div
                        aria-label="How settled your answer feels"
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                    >
                        {questionConfidenceOptions.map((option) => (
                            <button
                                aria-pressed={confidence === option.value}
                                className={cn(
                                    'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200',
                                    confidence === option.value &&
                                        'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100',
                                )}
                                key={option.value}
                                onClick={() => setConfidence(option.value)}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}

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
                    {answer.calibration ? (
                        <p className="mt-3 rounded-md border border-cyan-500/15 bg-cyan-50/60 p-3 text-xs leading-5 text-cyan-950 dark:border-teal-100/15 dark:bg-teal-100/6 dark:text-teal-50">
                            <span className="font-medium">
                                {t(
                                    'learning.question.confidence_reflection',
                                    'Confidence reflection',
                                )}
                                :{' '}
                            </span>
                            {questionCalibrationMessage(t, answer.calibration)}
                        </p>
                    ) : null}
                    <fieldset className="mt-4 rounded-md border border-slate-200 p-3 dark:border-white/10">
                        <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                            {t(
                                'learning.question.confidence_after_feedback_prompt',
                                'After comparing, how settled does this feel now? (optional)',
                            )}
                        </legend>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {t(
                                'learning.question.confidence_after_feedback_helper',
                                'This is a reflection on your understanding, not a grade.',
                            )}
                        </p>
                        <div
                            aria-label={t(
                                'learning.question.confidence_after_feedback_prompt',
                                'After comparing, how settled does this feel now? (optional)',
                            )}
                            className="mt-2 flex flex-wrap gap-2"
                            role="group"
                        >
                            {questionConfidenceOptions.map((option) => (
                                <button
                                    aria-pressed={
                                        confidenceAfterFeedback === option.value
                                    }
                                    className={cn(
                                        'min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200',
                                        confidenceAfterFeedback ===
                                            option.value &&
                                            'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100',
                                    )}
                                    key={option.value}
                                    onClick={() =>
                                        setConfidenceAfterFeedback(option.value)
                                    }
                                    type="button"
                                >
                                    {t(
                                        `learning.review.confidence_${option.value}`,
                                        option.label,
                                    )}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    {isRecall && answer.recall ? (
                        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {t(
                                'learning.recall.next_review',
                                'Next recall in :days days.',
                                { days: answer.recall.intervalDays },
                            )}
                        </p>
                    ) : null}
                    {canRecall ? (
                        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
                            <Button
                                className="min-h-11"
                                disabled={isRecallUpdating}
                                onClick={() => void toggleRecall()}
                                type="button"
                                variant="outline"
                            >
                                <Bookmark
                                    aria-hidden="true"
                                    className="mr-2 size-4"
                                />
                                {recallQueued
                                    ? 'Remove from recall queue'
                                    : 'Keep for later recall'}
                            </Button>
                            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                {recallQueued
                                    ? 'This question is waiting on your Learning Desk until you remove it.'
                                    : 'Save this question when you want to return to it without changing your route.'}
                            </p>
                            {recallError ? (
                                <p
                                    aria-live="polite"
                                    className="mt-2 text-xs text-red-600 dark:text-red-300"
                                    role="status"
                                >
                                    This recall choice could not be saved. Try
                                    again.
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                    {answer.confidence ? (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                            Starting sense:{' '}
                            {questionConfidenceLabel(answer.confidence)}
                            {answer.attemptNumber && answer.attemptNumber > 1
                                ? ` · Attempt ${answer.attemptNumber}`
                                : ''}
                        </p>
                    ) : null}
                    {answer.earlierAttempts?.length ? (
                        <details className="mt-4 rounded-md border border-slate-200 px-3 py-2 dark:border-white/10">
                            <summary className="cursor-pointer text-xs font-medium text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:focus-visible:ring-teal-200">
                                Earlier tries ({answer.earlierAttempts.length})
                            </summary>
                            <div className="mt-2 grid gap-2">
                                {answer.earlierAttempts.map(
                                    (attempt, index) => (
                                        <div
                                            className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-white/5"
                                            key={`${attempt.answeredAt ?? 'earlier'}-${index}`}
                                        >
                                            <div className="flex items-center justify-between gap-2 text-xs">
                                                <span className="font-medium text-slate-700 dark:text-slate-200">
                                                    {attempt.optionLabel
                                                        ? `Chose ${attempt.optionLabel}`
                                                        : 'Earlier answer'}
                                                </span>
                                                <span className="shrink-0 text-slate-500 dark:text-slate-400">
                                                    {formatReviewDate(
                                                        attempt.answeredAt,
                                                    )}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                {attempt.isCorrect
                                                    ? 'Useful clue found'
                                                    : 'Adjust the hypothesis'}
                                                {attempt.confidence
                                                    ? ` · Starting sense: ${questionConfidenceLabel(attempt.confidence)}`
                                                    : ''}
                                            </p>
                                        </div>
                                    ),
                                )}
                            </div>
                        </details>
                    ) : null}
                    {answer ? (
                        <Button
                            aria-busy={isCompleting}
                            className="mt-4"
                            disabled={isCompleting}
                            onClick={() => void completeQuestion()}
                            ref={continueButtonRef}
                        >
                            {isCompleting
                                ? t(
                                      'learning.question.saving_feedback',
                                      'Saving...',
                                  )
                                : answer.nextActivityId
                                  ? 'Continue'
                                  : 'Finish'}
                            <ArrowRight className="ml-2 size-4" />
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

const questionConfidenceOptions: Array<{
    label: string;
    value: QuestionConfidence;
}> = [
    { label: 'Exploring', value: 'exploring' },
    { label: 'I have a hunch', value: 'leaning' },
    { label: 'Settled', value: 'settled' },
];

function questionConfidenceLabel(value: QuestionConfidence): string {
    return (
        questionConfidenceOptions.find((option) => option.value === value)
            ?.label ?? value
    );
}

function questionCalibrationMessage(
    t: ReturnType<typeof usePlatformTranslation>,
    calibration: QuestionCalibration,
): string {
    return t(
        `learning.question.calibration.${calibration}`,
        {
            aligned: 'Your confidence matched this result.',
            stronger_than_expected:
                'This result was stronger than your starting sense.',
            higher_than_result:
                'Your starting confidence was higher than this result. Compare the explanation with your reasoning.',
            uncertainty_made_gap_visible:
                'Your uncertainty helped make this gap visible. Use the explanation to adjust your reasoning.',
        }[calibration],
    );
}

export function ReflectionActivity({
    activity,
    onComplete,
    onMoveToActivity,
    playRunId,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (
        activity: LearningActivity,
        options?: {
            confidence?: QuestionConfidence;
            confidenceAfterFeedback?: QuestionConfidence;
            observedCues?: string[];
            outcome?: ReviewOutcome;
        },
    ) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    playRunId: string | null;
    transition: ActivityTransition | null;
}) {
    const [reflection, setReflection] = useState('');
    const [responseContext, setResponseContext] = useState('');
    const [observedCues, setObservedCues] = useState<string[]>([]);
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const postResponseContinueRef = useRef<HTMLButtonElement>(null);
    const [confidence, setConfidence] = useState<QuestionConfidence | null>(
        null,
    );
    const [confidenceAfterFeedback, setConfidenceAfterFeedback] =
        useState<QuestionConfidence | null>(null);
    const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const t = usePlatformTranslation();
    const prompt =
        typeof activity.config.prompt === 'string'
            ? activity.config.prompt
            : 'What feels clearer now?';
    const note =
        typeof activity.config.note === 'string' ? activity.config.note : null;
    const isReview =
        activity.type === 'review' ||
        activity.config.learningIntent === 'review';
    const responseType =
        (activity.type === 'reflection' || activity.type === 'review') &&
        (activity.config.learningIntent === 'explain' ||
            activity.config.learningIntent === 'transfer')
            ? activity.config.learningIntent
            : null;
    const isTransfer = responseType === 'transfer';
    const isExplanation = responseType === 'explain';
    const hasPostResponseGuidance = Boolean(
        (responseType || isReview) &&
        activity.feedbackGuidance &&
        (activity.feedbackGuidance.purpose ||
            activity.feedbackGuidance.evidence ||
            activity.feedbackGuidance.nextAction ||
            activity.feedbackGuidance.rubric?.length),
    );

    useEffect(() => {
        if (reflectionSaved) {
            postResponseContinueRef.current?.focus();
        }
    }, [reflectionSaved]);

    if (reflectionSaved) {
        return (
            <div className="flex flex-1 flex-col gap-4 rounded-lg border border-cyan-500/25 bg-cyan-50/60 p-4 dark:border-teal-200/20 dark:bg-teal-100/6">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-cyan-700 dark:text-teal-200" />
                    <div>
                        <p className="text-xs font-medium tracking-[0.14em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'learning.reflection.response_saved',
                                'Response saved privately',
                            )}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {t(
                                'learning.reflection.feedback_pause',
                                'Take a moment to compare your response with the observation guidance before you continue.',
                            )}
                        </p>
                    </div>
                </div>
                {activity.feedbackGuidance?.purpose ? (
                    <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'learning.reflection.feedback_purpose_label',
                                'Purpose',
                            )}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {activity.feedbackGuidance.purpose}
                        </p>
                    </div>
                ) : null}
                {activity.feedbackGuidance?.evidence ? (
                    <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'learning.reflection.feedback_evidence_label',
                                'What to notice',
                            )}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {activity.feedbackGuidance.evidence}
                        </p>
                    </div>
                ) : null}
                {activity.feedbackGuidance?.nextAction ? (
                    <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'learning.reflection.feedback_next_action_label',
                                'A possible next action',
                            )}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {activity.feedbackGuidance.nextAction}
                        </p>
                    </div>
                ) : null}
                {activity.feedbackGuidance?.rubric?.length ? (
                    <div className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <p className="text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'learning.reflection.feedback_rubric_label',
                                'Observable cues',
                            )}
                        </p>
                        <ul className="mt-1 grid gap-1 text-sm leading-6 text-cyan-950/80 dark:text-teal-50/80">
                            {activity.feedbackGuidance.rubric.map((cue) => (
                                <li
                                    className="pl-4 before:mr-2 before:text-cyan-700 before:content-['•'] dark:before:text-teal-200"
                                    key={cue}
                                >
                                    {cue}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                {(responseType || isReview) && hasPostResponseGuidance ? (
                    <fieldset className="rounded-md border border-cyan-500/20 bg-white/60 p-3 dark:border-teal-100/15 dark:bg-slate-950/20">
                        <legend className="px-1 text-xs font-medium tracking-[0.12em] text-cyan-800 uppercase dark:text-teal-100">
                            {t(
                                'learning.reflection.confidence_after_feedback_prompt',
                                'After comparing, how settled does this feel now? (optional)',
                            )}
                        </legend>
                        <p className="mt-1 text-xs leading-5 text-cyan-950/70 dark:text-teal-50/70">
                            {t(
                                'learning.reflection.confidence_after_feedback_helper',
                                'This is a reflection on your understanding, not a grade.',
                            )}
                        </p>
                        <div
                            aria-label={t(
                                'learning.reflection.confidence_after_feedback_prompt',
                                'After comparing, how settled does this feel now? (optional)',
                            )}
                            className="mt-2 flex flex-wrap gap-2"
                            role="group"
                        >
                            {questionConfidenceOptions.map((option) => (
                                <button
                                    aria-pressed={
                                        confidenceAfterFeedback === option.value
                                    }
                                    className={cn(
                                        'min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200',
                                        confidenceAfterFeedback ===
                                            option.value &&
                                            'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100',
                                    )}
                                    key={option.value}
                                    onClick={() =>
                                        setConfidenceAfterFeedback(option.value)
                                    }
                                    type="button"
                                >
                                    {t(
                                        `learning.review.confidence_${option.value}`,
                                        option.label,
                                    )}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                ) : null}
                <p className="text-xs leading-5 text-cyan-900/70 dark:text-teal-100/70">
                    {t(
                        'learning.reflection.private_response_hint',
                        'This response stays in your private journal.',
                    )}
                </p>
                <Button
                    className="mt-auto"
                    disabled={isSaving || !playRunId}
                    onClick={() => void completeReflection()}
                    ref={postResponseContinueRef}
                >
                    {t(
                        'learning.reflection.continue_after_feedback',
                        'Continue',
                    )}
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-cyan-700 uppercase dark:text-teal-200">
                <RotateCcw className="size-3.5" />
                {isReview ? 'Review / revisit' : 'Reflection'}
            </div>
            {isReview ? (
                <p className="rounded-lg border border-cyan-500/20 bg-cyan-50 p-3 text-xs leading-5 text-cyan-900 dark:border-teal-200/20 dark:bg-teal-100/8 dark:text-teal-100">
                    Return to the idea and notice what feels clearer, more
                    connected, or still open.
                </p>
            ) : null}
            {isReview && activity.reviewContext?.length ? (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-50/60 p-3 dark:border-teal-200/20 dark:bg-teal-100/6">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-900 uppercase dark:text-teal-100">
                        Earlier notes from you
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-900/75 dark:text-teal-100/75">
                        Look back if it helps. You can also write without
                        comparing.
                    </p>
                    <div className="mt-2 grid gap-2">
                        {activity.reviewContext.map((entry) => (
                            <details
                                className="rounded-md border border-cyan-500/15 bg-white/60 px-2.5 py-2 dark:border-teal-100/15 dark:bg-black/10"
                                key={entry.id}
                            >
                                <summary className="cursor-pointer text-xs font-medium text-cyan-900 dark:text-teal-100">
                                    {formatReviewDate(entry.createdAt)} ·{' '}
                                    {entry.question}
                                </summary>
                                <p className="mt-2 text-xs leading-5 whitespace-pre-wrap text-cyan-950/80 dark:text-teal-50/80">
                                    {entry.reflection}
                                </p>
                            </details>
                        ))}
                    </div>
                </div>
            ) : null}
            {responseType ? (
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-50/60 p-3 dark:border-teal-200/20 dark:bg-teal-100/6">
                    <p className="text-xs font-medium tracking-[0.14em] text-cyan-900 uppercase dark:text-teal-100">
                        {t(
                            'learning.reflection.response_focus',
                            'Response focus',
                        )}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-cyan-900/75 dark:text-teal-100/75">
                        {isTransfer
                            ? t(
                                  'learning.reflection.transfer_helper',
                                  'Name the changed context and explain how the idea worked there.',
                              )
                            : t(
                                  'learning.reflection.explanation_helper',
                                  'Explain the idea in your own words and connect it to a reason or example.',
                              )}
                    </p>
                </div>
            ) : null}
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                {prompt}
            </p>
            {responseType ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        {t(
                            'learning.reflection.confidence_prompt',
                            'How settled does your starting understanding feel? (optional)',
                        )}
                    </legend>
                    <div
                        aria-label={t(
                            'learning.reflection.confidence_prompt',
                            'How settled does your starting understanding feel? (optional)',
                        )}
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                    >
                        {questionConfidenceOptions.map((option) => (
                            <button
                                aria-pressed={confidence === option.value}
                                className={cn(
                                    'min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200',
                                    confidence === option.value &&
                                        'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100',
                                )}
                                key={option.value}
                                onClick={() => setConfidence(option.value)}
                                type="button"
                            >
                                {t(
                                    `learning.review.confidence_${option.value}`,
                                    option.label,
                                )}
                            </button>
                        ))}
                    </div>
                </fieldset>
            ) : null}
            {responseType ? (
                <label
                    className="text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200"
                    htmlFor="activity-reflection-response"
                >
                    {isExplanation || isTransfer
                        ? t(
                              'learning.reflection.explanation_label',
                              'Your explanation',
                          )
                        : t(
                              'learning.reflection.response_label',
                              'Your response',
                          )}
                </label>
            ) : null}
            <textarea
                aria-describedby={
                    responseType ? 'activity-response-help' : undefined
                }
                className="min-h-32 resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                id="activity-reflection-response"
                onChange={(event) => setReflection(event.target.value)}
                placeholder={
                    isTransfer
                        ? t(
                              'learning.reflection.transfer_placeholder',
                              'Explain how the idea worked in the changed context.',
                          )
                        : isExplanation
                          ? t(
                                'learning.reflection.explanation_placeholder',
                                'Write the idea in your own words.',
                            )
                          : isReview
                            ? 'Write what feels clearer or still open.'
                            : 'Write a short note for yourself.'
                }
                value={reflection}
            />
            {isTransfer ? (
                <div>
                    <label
                        className="text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200"
                        htmlFor="activity-reflection-context"
                    >
                        {t(
                            'learning.reflection.context_label',
                            'Changed context',
                        )}
                    </label>
                    <textarea
                        aria-describedby="activity-response-help"
                        className="mt-2 min-h-20 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 transition outline-none placeholder:text-slate-400 focus:border-cyan-500 dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-teal-200/70"
                        id="activity-reflection-context"
                        onChange={(event) =>
                            setResponseContext(event.target.value)
                        }
                        placeholder={t(
                            'learning.reflection.context_placeholder',
                            'Where did you try the idea?',
                        )}
                        required
                        value={responseContext}
                    />
                </div>
            ) : null}
            {(responseType || isReview) &&
            activity.feedbackGuidance?.rubric?.length ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        {t(
                            'learning.reflection.observed_cues_prompt',
                            'What did you notice in your response? (optional)',
                        )}
                    </legend>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {t(
                            isReview
                                ? 'learning.reflection.observed_cues_review_helper'
                                : 'learning.reflection.observed_cues_helper',
                            isReview
                                ? 'Select any cues that feel visible in your response. This records your observation, not a grade.'
                                : 'Select any cues that feel visible in your explanation. This records your observation, not a grade.',
                        )}
                    </p>
                    <div className="mt-2 grid gap-2">
                        {activity.feedbackGuidance.rubric.map((cue) => {
                            const checked = observedCues.includes(cue);

                            return (
                                <label
                                    className="flex min-h-11 items-start gap-2 rounded-md border border-slate-200 bg-white/60 px-2.5 py-2 text-xs leading-5 text-slate-600 dark:border-white/10 dark:bg-slate-950/20 dark:text-slate-300"
                                    key={cue}
                                >
                                    <input
                                        checked={checked}
                                        className="mt-1 size-4 accent-cyan-600 dark:accent-teal-200"
                                        onChange={() =>
                                            setObservedCues((current) =>
                                                checked
                                                    ? current.filter(
                                                          (value) =>
                                                              value !== cue,
                                                      )
                                                    : [...current, cue],
                                            )
                                        }
                                        type="checkbox"
                                    />
                                    <span>{cue}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
            ) : null}
            {isReview && !responseType ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        {t(
                            'learning.review.confidence_prompt',
                            'After your response, how settled does this feel before comparing with the guidance? (optional)',
                        )}
                    </legend>
                    <div
                        aria-label={t(
                            'learning.review.confidence_prompt',
                            'After your response, how settled does this feel before comparing with the guidance? (optional)',
                        )}
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                    >
                        {questionConfidenceOptions.map((option) => (
                            <button
                                aria-pressed={confidence === option.value}
                                className={cn(
                                    'min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200',
                                    confidence === option.value &&
                                        'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100',
                                )}
                                key={option.value}
                                onClick={() => setConfidence(option.value)}
                                type="button"
                            >
                                {t(
                                    `learning.review.confidence_${option.value}`,
                                    option.label,
                                )}
                            </button>
                        ))}
                    </div>
                </fieldset>
            ) : null}
            {isReview ? (
                <fieldset className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
                    <legend className="px-1 text-xs font-medium tracking-[0.14em] text-cyan-700 uppercase dark:text-teal-200">
                        {t(
                            'learning.review.outcome_prompt',
                            'What changed for you? (optional)',
                        )}
                    </legend>
                    <div
                        aria-label={t(
                            'learning.review.outcome_prompt',
                            'What changed for you? (optional)',
                        )}
                        aria-describedby="activity-review-outcome-help"
                        className="mt-2 flex flex-wrap gap-2"
                        role="group"
                    >
                        {reviewOutcomeOptions.map((option) => (
                            <button
                                aria-pressed={outcome === option.value}
                                className={cn(
                                    'min-h-11 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-500/60 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/32 dark:text-slate-300 dark:hover:border-teal-200/60 dark:hover:text-teal-100 dark:focus-visible:ring-teal-200',
                                    outcome === option.value &&
                                        'border-cyan-500/80 bg-cyan-50 text-cyan-700 dark:border-teal-200/80 dark:bg-teal-100/12 dark:text-teal-100',
                                )}
                                key={option.value}
                                onClick={() => setOutcome(option.value)}
                                type="button"
                            >
                                {t(option.labelKey, option.label)}
                            </button>
                        ))}
                    </div>
                    <p
                        className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400"
                        id="activity-review-outcome-help"
                    >
                        {outcome
                            ? reviewOutcomeDescription(outcome, t)
                            : t(
                                  'learning.review.outcome_helper',
                                  'Choose only if one of these descriptions fits. No choice is required, and none is a grade.',
                              )}
                    </p>
                </fieldset>
            ) : null}
            {responseType ? (
                <p
                    className="text-xs leading-5 text-slate-500 dark:text-slate-400"
                    id="activity-response-help"
                >
                    {t(
                        'learning.reflection.private_response_hint',
                        'This response stays in your private journal.',
                    )}
                </p>
            ) : null}
            {note ? (
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {note}
                </p>
            ) : null}
            <Button
                className="mt-auto"
                disabled={
                    reflection.trim().length === 0 ||
                    (isTransfer && responseContext.trim().length === 0) ||
                    isSaving ||
                    !playRunId
                }
                onClick={() => void saveReflection()}
            >
                {isReview ? 'Save review note' : 'Keep reflection'}
            </Button>
        </div>
    );

    async function saveReflection() {
        if (!playRunId || isSaving) {
            return;
        }

        setIsSaving(true);

        try {
            await postJson(`/learning/activities/${activity.id}/reflection`, {
                play_run_id: playRunId,
                reflection,
                ...(isTransfer ? { response_context: responseContext } : {}),
                ...(observedCues.length > 0
                    ? { observed_cues: observedCues }
                    : {}),
                subtopic:
                    typeof activity.config.subtopic === 'string'
                        ? activity.config.subtopic
                        : '',
                topic:
                    typeof activity.config.topic === 'string'
                        ? activity.config.topic
                        : '',
            });

            if (hasPostResponseGuidance) {
                setReflectionSaved(true);
            } else {
                await completeReflection();
            }
        } finally {
            setIsSaving(false);
        }
    }

    async function completeReflection() {
        if (!playRunId) {
            return;
        }

        setIsSaving(true);

        try {
            await onComplete(activity, {
                confidence: confidence ?? undefined,
                confidenceAfterFeedback: confidenceAfterFeedback ?? undefined,
                observedCues,
                outcome: outcome ?? undefined,
            });
            onMoveToActivity(transition?.toActivityId ?? null);
        } finally {
            setIsSaving(false);
        }
    }
}

function formatReviewDate(value: string | null): string {
    if (!value) {
        return 'Earlier';
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? 'Earlier'
        : date.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          });
}
