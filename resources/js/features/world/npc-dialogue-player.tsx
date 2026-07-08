import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    MessageCircle,
    RotateCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type { LearningActivity, NpcDialogueNode } from '@/types';
import { postJson } from './api';

type NpcDialogueActivityProps = {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
};

type NpcDialogueAnswerProgress = {
    answerKey: string;
    feedback: string | null;
    isCorrect: boolean;
};

type NpcAnswerOption = {
    body: string;
    feedback: string | null;
    isCorrect: boolean;
    key: string;
    label: string;
};

export function NpcDialogueActivity({
    activity,
    onComplete,
    onMoveToActivity,
}: NpcDialogueActivityProps) {
    const { resolvedAppearance } = useAppearance();
    const [history, setHistory] = useState<number[]>([]);
    const [currentNodeId, setCurrentNodeId] = useState<number | null>(() =>
        firstNpcDialogueNodeId(activity),
    );
    const [selectedAnswerKey, setSelectedAnswerKey] = useState<string | null>(
        null,
    );
    const [answerProgress, setAnswerProgress] =
        useState<NpcDialogueAnswerProgress | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const currentNode = currentNodeId
        ? npcDialogueNodeById(activity, currentNodeId)
        : null;
    const isQuestion = currentNode?.config.interactionMode === 'question';
    const answers = currentNode && isQuestion ? answerOptions(currentNode) : [];
    const canGoBack = history.length > 0 && !answerProgress;
    const displayedText = currentNode?.body ?? '';
    const typingSpeed = numericConfig(currentNode?.config.typingSpeed, 28);

    const moveToNode = useCallback(
        async (nextNodeId: number | null) => {
            if (!currentNode) {
                return;
            }

            if (!nextNodeId) {
                await onComplete(activity);
                onMoveToActivity(nextActivityForNpcExit(activity, null));

                return;
            }

            const nextNode = npcDialogueNodeById(activity, nextNodeId);

            if (nextNode?.type === 'end') {
                await onComplete(activity);
                onMoveToActivity(nextActivityForNpcExit(activity, nextNode.id));

                return;
            }

            setHistory((current) => [...current, currentNode.id]);
            setCurrentNodeId(nextNodeId);
            setSelectedAnswerKey(null);
            setAnswerProgress(null);
        },
        [activity, currentNode, onComplete, onMoveToActivity],
    );

    const moveForward = useCallback(() => {
        if (!currentNode || isQuestion) {
            return;
        }

        void moveToNode(nextDialogueNodeId(activity, currentNode.id));
    }, [activity, currentNode, isQuestion, moveToNode]);

    const moveBack = useCallback(() => {
        if (!canGoBack) {
            return;
        }

        setHistory((current) => {
            const nextHistory = [...current];
            const previous = nextHistory.pop() ?? null;
            setCurrentNodeId(previous);

            return nextHistory;
        });
    }, [canGoBack]);

    const submitAnswer = useCallback(async () => {
        if (!currentNode || !selectedAnswerKey || isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await postJson<{
                answer: NpcDialogueAnswerProgress;
            }>(`/learning/npc-dialogue-nodes/${currentNode.id}/answer`, {
                answer_key: selectedAnswerKey,
            });

            setAnswerProgress(response.answer);
        } finally {
            setIsSubmitting(false);
        }
    }, [currentNode, isSubmitting, selectedAnswerKey]);

    const continueAfterAnswer = useCallback(() => {
        if (!answerProgress) {
            return;
        }

        void moveToNode(
            nextDialogueNodeId(
                activity,
                currentNode?.id ?? null,
                answerProgress.answerKey,
            ),
        );
    }, [activity, answerProgress, currentNode?.id, moveToNode]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (isEditableTarget(event.target)) {
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveBack();
            }

            if (event.key === 'ArrowRight' || event.key === ' ') {
                event.preventDefault();

                if (answerProgress) {
                    continueAfterAnswer();

                    return;
                }

                moveForward();
            }

            if (event.key === 'Enter' && isQuestion) {
                event.preventDefault();

                if (answerProgress) {
                    continueAfterAnswer();

                    return;
                }

                void submitAnswer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        answerProgress,
        continueAfterAnswer,
        isQuestion,
        moveBack,
        moveForward,
        submitAnswer,
    ]);

    if (!currentNode) {
        return (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-white/15 dark:bg-white/6 dark:text-slate-300">
                This NPC dialogue has no start path yet.
            </div>
        );
    }

    return (
        <NpcDialogueScene
            answerProgress={answerProgress}
            answers={answers}
            canGoBack={canGoBack}
            currentNode={currentNode}
            isQuestion={isQuestion}
            isSubmitting={isSubmitting}
            mode={resolvedAppearance}
            onBack={moveBack}
            onContinue={answerProgress ? continueAfterAnswer : moveForward}
            onSelectAnswer={setSelectedAnswerKey}
            onSubmitAnswer={submitAnswer}
            selectedAnswerKey={selectedAnswerKey}
            text={displayedText}
            typingSpeed={typingSpeed}
        />
    );
}

function NpcDialogueScene({
    answerProgress,
    answers,
    canGoBack,
    currentNode,
    isQuestion,
    isSubmitting,
    mode,
    onBack,
    onContinue,
    onSelectAnswer,
    onSubmitAnswer,
    selectedAnswerKey,
    text,
    typingSpeed,
}: {
    answerProgress: NpcDialogueAnswerProgress | null;
    answers: NpcAnswerOption[];
    canGoBack: boolean;
    currentNode: NpcDialogueNode;
    isQuestion: boolean;
    isSubmitting: boolean;
    mode: 'dark' | 'light';
    onBack: () => void;
    onContinue: () => void;
    onSelectAnswer: (key: string | null) => void;
    onSubmitAnswer: () => void;
    selectedAnswerKey: string | null;
    text: string;
    typingSpeed: number;
}) {
    const backgroundImage = themedImage(
        currentNode.config.backgroundDark,
        currentNode.config.backgroundLight,
        mode,
    );
    const npcImage = themedImage(
        currentNode.config.npcImageDark,
        currentNode.config.npcImageLight,
        mode,
    );
    const npcX = numericConfig(currentNode.config.npcX, 50);
    const npcY = numericConfig(currentNode.config.npcY, 50);

    return (
        <div className="relative isolate flex min-h-[32rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6">
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    src={backgroundImage}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />
            {npcImage ? (
                <img
                    alt=""
                    className={cn(
                        'absolute z-10 max-h-[70%] max-w-[55%] -translate-x-1/2 -translate-y-1/2 animate-in object-contain duration-500 fade-in',
                        slideClass(currentNode.config.slideDirection),
                    )}
                    src={npcImage}
                    style={{ left: `${npcX}%`, top: `${npcY}%` }}
                />
            ) : null}
            <div className="relative z-20 mt-auto flex w-full flex-col gap-4 p-4">
                <div
                    className="rounded-2xl border p-4 backdrop-blur-md"
                    style={speechBubbleStyle(currentNode, mode)}
                >
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <MessageCircle className="size-4" />
                        {currentNode.title}
                    </div>
                    <TypingText
                        key={currentNode.id}
                        speed={typingSpeed}
                        text={text}
                    />
                    {isQuestion ? (
                        <NpcAnswerOptions
                            answerProgress={answerProgress}
                            answers={answers}
                            isSubmitting={isSubmitting}
                            onSelect={onSelectAnswer}
                            onSubmit={onSubmitAnswer}
                            selectedAnswerKey={selectedAnswerKey}
                        />
                    ) : null}
                    {answerProgress ? (
                        <NpcAnswerFeedback answerProgress={answerProgress} />
                    ) : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                    <Button
                        disabled={!canGoBack}
                        onClick={onBack}
                        size="icon"
                        type="button"
                        variant="secondary"
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                        {isQuestion && !answerProgress
                            ? 'Choose an answer, then confirm.'
                            : 'Use Space or arrows to move.'}
                    </p>
                    <Button
                        disabled={isQuestion && !answerProgress}
                        onClick={onContinue}
                        size="icon"
                        type="button"
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function NpcAnswerOptions({
    answerProgress,
    answers,
    isSubmitting,
    onSelect,
    onSubmit,
    selectedAnswerKey,
}: {
    answerProgress: NpcDialogueAnswerProgress | null;
    answers: NpcAnswerOption[];
    isSubmitting: boolean;
    onSelect: (key: string | null) => void;
    onSubmit: () => void;
    selectedAnswerKey: string | null;
}) {
    if (answers.length === 0) {
        return (
            <p className="mt-4 rounded-lg border border-dashed border-white/20 p-3 text-sm opacity-80">
                This question has no answers configured yet.
            </p>
        );
    }

    return (
        <div className="mt-4 grid gap-2">
            {answers.map((answer) => (
                <button
                    className={cn(
                        'rounded-lg border border-white/20 bg-white/70 p-3 text-left text-sm leading-6 text-slate-800 transition hover:-translate-y-0.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none dark:bg-slate-950/50 dark:text-slate-100 dark:hover:bg-slate-950/70 dark:focus-visible:ring-teal-200',
                        selectedAnswerKey === answer.key &&
                            'border-cyan-600 bg-cyan-50 dark:border-teal-200 dark:bg-teal-200/10',
                    )}
                    disabled={Boolean(answerProgress) || isSubmitting}
                    key={answer.key}
                    onClick={() => onSelect(answer.key)}
                    type="button"
                >
                    <span className="mr-2 font-semibold">{answer.label}</span>
                    {answer.body}
                </button>
            ))}
            <Button
                disabled={
                    !selectedAnswerKey ||
                    isSubmitting ||
                    Boolean(answerProgress)
                }
                onClick={onSubmit}
                type="button"
            >
                Confirm answer
            </Button>
        </div>
    );
}

function TypingText({ speed, text }: { speed: number; text: string }) {
    const [visibleText, setVisibleText] = useState('');

    useEffect(() => {
        if (!text) {
            return;
        }

        let index = 0;
        const timer = window.setInterval(
            () => {
                index += 1;
                setVisibleText(text.slice(0, index));

                if (index >= text.length) {
                    window.clearInterval(timer);
                }
            },
            Math.max(1, speed),
        );

        return () => window.clearInterval(timer);
    }, [speed, text]);

    return <p className="min-h-16 text-sm leading-6">{visibleText}</p>;
}

function NpcAnswerFeedback({
    answerProgress,
}: {
    answerProgress: NpcDialogueAnswerProgress;
}) {
    return (
        <div className="mt-4 rounded-lg border border-white/20 bg-white/70 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-950/45 dark:text-slate-100">
            <div className="mb-1 flex items-center gap-2 font-medium">
                {answerProgress.isCorrect ? (
                    <CheckCircle2 className="size-4" />
                ) : (
                    <RotateCcw className="size-4" />
                )}
                {answerProgress.isCorrect
                    ? 'Useful clue found'
                    : 'Adjust the hypothesis'}
            </div>
            {answerProgress.feedback}
        </div>
    );
}

function firstNpcDialogueNodeId(activity: LearningActivity): number | null {
    const startTransition = activity.npcDialogueTransitions.find(
        (transition) => transition.fromNodeId === null,
    );

    return (
        startTransition?.toNodeId ??
        activity.npcDialogueNodes.find((node) => node.type !== 'end')?.id ??
        null
    );
}

function npcDialogueNodeById(
    activity: LearningActivity,
    nodeId: number,
): NpcDialogueNode | null {
    return activity.npcDialogueNodes.find((node) => node.id === nodeId) ?? null;
}

function nextDialogueNodeId(
    activity: LearningActivity,
    fromNodeId: number | null,
    connector = 'out',
): number | null {
    return (
        activity.npcDialogueTransitions.find(
            (transition) =>
                transition.fromNodeId === fromNodeId &&
                transition.fromConnector === connector,
        )?.toNodeId ?? null
    );
}

function nextActivityForNpcExit(
    activity: LearningActivity,
    endNodeId: number | null,
): number | null {
    const connector = endNodeId ? `dialogue-end-${endNodeId}` : null;
    const exitTransition = connector
        ? activity.transitions.find(
              (transition) => transition.fromConnector === connector,
          )
        : null;

    return (
        exitTransition?.toActivityId ??
        activity.transitions.find(
            (transition) => transition.trigger === 'completed',
        )?.toActivityId ??
        null
    );
}

function answerOptions(node: NpcDialogueNode): NpcAnswerOption[] {
    const rawAnswers = node.config.answers;

    if (!Array.isArray(rawAnswers)) {
        return [];
    }

    return (rawAnswers as unknown[])
        .filter((answer): answer is Record<string, unknown> => isRecord(answer))
        .map((answer, index) => ({
            body: stringConfig(answer.body),
            feedback: nullableString(answer.feedback),
            isCorrect: Boolean(answer.isCorrect),
            key: stringConfig(answer.key, `answer-${index + 1}`),
            label: stringConfig(answer.label, String.fromCharCode(65 + index)),
        }));
}

function speechBubbleStyle(
    node: NpcDialogueNode,
    mode: 'dark' | 'light',
): CSSProperties {
    const isLight = mode === 'light';
    const backgroundColor = stringConfig(
        isLight ? node.config.bubbleColorLight : node.config.bubbleColorDark,
        isLight ? '#ffffff' : '#0f172a',
    );
    const borderColor = stringConfig(
        isLight
            ? node.config.bubbleBorderColorLight
            : node.config.bubbleBorderColorDark,
        isLight ? '#0891b2' : '#2dd4bf',
    );
    const opacity = numericConfig(
        isLight
            ? node.config.bubbleOpacityLight
            : node.config.bubbleOpacityDark,
        isLight ? 94 : 92,
    );

    return {
        backgroundColor: colorWithOpacity(backgroundColor, opacity),
        borderColor,
    };
}

function themedImage(
    darkValue: unknown,
    lightValue: unknown,
    mode: 'dark' | 'light',
): string | null {
    const darkImage = nullableString(darkValue);
    const lightImage = nullableString(lightValue);

    return mode === 'light' ? (lightImage ?? darkImage) : darkImage;
}

function slideClass(value: unknown): string {
    const direction = stringConfig(value, 'left');

    if (direction === 'right') {
        return 'slide-in-from-right-8';
    }

    if (direction === 'top') {
        return 'slide-in-from-top-8';
    }

    if (direction === 'bottom') {
        return 'slide-in-from-bottom-8';
    }

    if (direction === 'none') {
        return '';
    }

    return 'slide-in-from-left-8';
}

function numericConfig(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

function stringConfig(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function nullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function colorWithOpacity(color: string, opacity: number): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return color;
    }

    const alpha = Math.round((Math.min(100, Math.max(0, opacity)) / 100) * 255)
        .toString(16)
        .padStart(2, '0');

    return `${color}${alpha}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        Boolean(
            target.closest('input, textarea, select, [contenteditable="true"]'),
        )
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
