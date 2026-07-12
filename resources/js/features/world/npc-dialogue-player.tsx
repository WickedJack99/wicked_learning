import { usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import {
    addGrantedLearningTool,
    learningToolIsAvailable,
    useAvailableLearningTools,
} from '@/features/tools/tool-selection';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type { LearningActivity, LearningTool, NpcDialogueNode } from '@/types';
import { postJson } from './api';

type NpcDialogueActivityProps = {
    activity: LearningActivity;
    initialState: unknown;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    playRunId: string | null;
};

type NpcDialogueAnswerProgress = {
    answerKey: string;
    answerNodeId: number;
    feedback: string | null;
    isCorrect: boolean;
};

type NpcAnswerOption = {
    answerNodeId: number;
    body: string;
    isCorrect: boolean;
    key: string;
    label: string;
};

type NpcDialogueSavedState = {
    currentNodeId: number | null;
    history: number[];
};

type DialogueSceneAsset = {
    id: string;
    imageUrl: string | null;
    label: string;
    layer: DialogueSceneAssetLayer;
    mirrored: boolean;
    width: number;
    x: number;
    y: number;
};

type DialogueSceneAssetLayer = 'behind_npc' | 'front' | 'bubble' | 'overlay';

export function NpcDialogueActivity({
    activity,
    initialState,
    onComplete,
    onMoveToActivity,
    playRunId,
}: NpcDialogueActivityProps) {
    const { props } = usePage();
    const { resolvedAppearance } = useAppearance();
    const savedState = normalizeNpcDialogueState(activity, initialState);
    const [history, setHistory] = useState<number[]>(savedState.history);
    const [currentNodeId, setCurrentNodeId] = useState<number | null>(
        () => savedState.currentNodeId ?? firstNpcDialogueNodeId(activity),
    );
    const [selectedAnswerKey, setSelectedAnswerKey] = useState<string | null>(
        null,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const grantedNodeIds = useRef(new Set<number>());
    const [grantedTool, setGrantedTool] = useState<{
        nodeId: number;
        title: string;
    } | null>(null);
    const availableTools = useAvailableLearningTools(props.auth.tools);
    const currentNode = currentNodeId
        ? npcDialogueNodeById(activity, currentNodeId)
        : null;
    const isQuestion = currentNode ? isQuestionNode(currentNode) : false;
    const answers =
        currentNode && isQuestion ? answerOptions(activity, currentNode) : [];
    const canGoBack = history.length > 0;
    const displayedText = currentNode?.body ?? '';
    const typingSpeed = numericConfig(currentNode?.config.typingSpeed, 28);
    const persistDialogueState = useCallback(
        (nextNodeId: number | null, nextHistory: number[]) => {
            if (!playRunId) {
                return;
            }

            void postJson(
                `/learning/activities/${activity.id}/npc-dialogue-state`,
                {
                    current_node_id: nextNodeId,
                    history: nextHistory,
                    play_run_id: playRunId,
                },
            ).catch(() => undefined);
        },
        [activity.id, playRunId],
    );

    const moveToNode = useCallback(
        async (
            nextNodeId: number | null,
            rememberCurrent = true,
            historyOverride: number[] | null = null,
        ) => {
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

            const nextHistory =
                historyOverride ??
                (rememberCurrent ? [...history, currentNode.id] : history);

            if (rememberCurrent) {
                setHistory(nextHistory);
            }

            setCurrentNodeId(nextNodeId);
            setSelectedAnswerKey(null);
            persistDialogueState(nextNodeId, nextHistory);
        },
        [
            activity,
            currentNode,
            history,
            onComplete,
            onMoveToActivity,
            persistDialogueState,
        ],
    );

    useEffect(() => {
        if (!currentNode) {
            return;
        }

        const toolId = numericConfig(currentNode.config.toolId, 0);

        if (toolId <= 0) {
            return;
        }

        if (grantedNodeIds.current.has(currentNode.id)) {
            return;
        }

        grantedNodeIds.current.add(currentNode.id);

        if (learningToolIsAvailable(availableTools, toolId)) {
            const nextNodeId = nextDialogueNodeId(activity, currentNode.id);
            const frame = window.requestAnimationFrame(() => {
                void moveToNode(nextNodeId, false);
            });

            return () => window.cancelAnimationFrame(frame);
        }

        const grant = async () => {
            try {
                const response = await postJson<{ tool: LearningTool }>(
                    `/learning/npc-dialogue-nodes/${currentNode.id}/grant-tool`,
                    {},
                );

                addGrantedLearningTool(response.tool);
                setGrantedTool({
                    nodeId: currentNode.id,
                    title: response.tool.title,
                });
            } catch {
                setGrantedTool(null);
            }
        };

        void grant();
    }, [activity, availableTools, currentNode, moveToNode]);

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
            persistDialogueState(previous, nextHistory);

            return nextHistory;
        });
    }, [canGoBack, persistDialogueState]);

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

            setHistory([]);
            await moveToNode(
                nextDialogueNodeId(activity, response.answer.answerNodeId),
                false,
                [],
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [activity, currentNode, isSubmitting, moveToNode, selectedAnswerKey]);

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

                moveForward();
            }

            if (event.key === 'Enter' && isQuestion) {
                event.preventDefault();

                void submitAnswer();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isQuestion, moveBack, moveForward, submitAnswer]);

    if (!currentNode) {
        return (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-white/15 dark:bg-white/6 dark:text-slate-300">
                This NPC dialogue has no start path yet.
            </div>
        );
    }

    return (
        <NpcDialogueScene
            answers={answers}
            canGoBack={canGoBack}
            currentNode={currentNode}
            isQuestion={isQuestion}
            isSubmitting={isSubmitting}
            mode={resolvedAppearance}
            onBack={moveBack}
            onContinue={moveForward}
            onSelectAnswer={setSelectedAnswerKey}
            onSubmitAnswer={submitAnswer}
            grantedToolName={
                grantedTool?.nodeId === currentNode.id
                    ? grantedTool.title
                    : null
            }
            selectedAnswerKey={selectedAnswerKey}
            text={displayedText}
            typingSpeed={typingSpeed}
        />
    );
}

function normalizeNpcDialogueState(
    activity: LearningActivity,
    value: unknown,
): NpcDialogueSavedState {
    const state =
        isRecord(value) && isRecord(value.npcDialogue)
            ? value.npcDialogue
            : null;

    if (!state) {
        return {
            currentNodeId: null,
            history: [],
        };
    }

    const nodeIds = new Set(activity.npcDialogueNodes.map((node) => node.id));
    const currentNodeId = numericConfig(state.currentNodeId, 0);
    const history = Array.isArray(state.history)
        ? state.history
              .map((nodeId) => numericConfig(nodeId, 0))
              .filter((nodeId) => nodeIds.has(nodeId))
        : [];

    return {
        currentNodeId: nodeIds.has(currentNodeId) ? currentNodeId : null,
        history,
    };
}

function NpcDialogueScene({
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
    grantedToolName,
    selectedAnswerKey,
    text,
    typingSpeed,
}: {
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
    grantedToolName: string | null;
    selectedAnswerKey: string | null;
    text: string;
    typingSpeed: number;
}) {
    const backgroundImage = themedImage(
        currentNode.config.backgroundDark,
        currentNode.config.backgroundLight,
        mode,
    );
    const backgroundMirrored = booleanConfig(
        currentNode.config.backgroundMirrored,
        false,
    );
    const npcImage = themedImage(
        currentNode.config.npcImageDark,
        currentNode.config.npcImageLight,
        mode,
    );
    const npcImageMirrored = booleanConfig(
        currentNode.config.npcImageMirrored,
        false,
    );
    const sceneAssets = dialogueSceneAssets(
        currentNode.config.sceneAssets,
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
                    style={{
                        transform: backgroundMirrored
                            ? 'scaleX(-1)'
                            : undefined,
                    }}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />
            <DialogueSceneAssetLayers assets={sceneAssets} layer="behind_npc" />
            {npcImage ? (
                <NpcCharacterImage
                    imageUrl={npcImage}
                    mirrored={npcImageMirrored}
                    nodeId={currentNode.id}
                    slideDirection={currentNode.config.slideDirection}
                    slideDuration={numericConfig(
                        currentNode.config.slideDurationSeconds,
                        0.6,
                    )}
                    fadeDuration={numericConfig(
                        currentNode.config.fadeDurationSeconds,
                        0.4,
                    )}
                    x={npcX}
                    y={npcY}
                />
            ) : null}
            <DialogueSceneAssetLayers assets={sceneAssets} layer="front" />
            <div className="relative z-20 mt-auto flex w-full flex-col gap-4 p-4">
                <DialogueSceneAssetLayers assets={sceneAssets} layer="bubble" />
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
                    {grantedToolName ? (
                        <p className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100">
                            Added tool: {grantedToolName}
                        </p>
                    ) : null}
                    {isQuestion ? (
                        <NpcAnswerOptions
                            answers={answers}
                            isSubmitting={isSubmitting}
                            onSelect={onSelectAnswer}
                            onSubmit={onSubmitAnswer}
                            selectedAnswerKey={selectedAnswerKey}
                        />
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
                        {isQuestion
                            ? 'Choose an answer, then confirm.'
                            : 'Use Space or arrows to move.'}
                    </p>
                    <Button
                        disabled={isQuestion}
                        onClick={onContinue}
                        size="icon"
                        type="button"
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                </div>
            </div>
            <DialogueSceneAssetLayers assets={sceneAssets} layer="overlay" />
        </div>
    );
}

function DialogueSceneAssetLayers({
    assets,
    layer,
}: {
    assets: DialogueSceneAsset[];
    layer: DialogueSceneAssetLayer;
}) {
    return (
        <>
            {assets
                .filter((asset) => asset.layer === layer)
                .map((asset) => (
                    <DialogueSceneAssetImage asset={asset} key={asset.id} />
                ))}
        </>
    );
}

function DialogueSceneAssetImage({ asset }: { asset: DialogueSceneAsset }) {
    if (!asset.imageUrl) {
        return null;
    }

    return (
        <img
            alt={asset.label}
            className="pointer-events-none absolute z-[18] max-h-[95%] object-contain"
            draggable={false}
            src={asset.imageUrl}
            style={{
                left: `${asset.x}%`,
                top: `${asset.y}%`,
                transform: imageTransform(
                    'translate(-50%, -50%)',
                    asset.mirrored,
                ),
                width: `${asset.width}%`,
                zIndex: dialogueSceneAssetZIndex(asset.layer),
            }}
        />
    );
}

function NpcCharacterImage({
    fadeDuration,
    imageUrl,
    mirrored,
    nodeId,
    slideDirection,
    slideDuration,
    x,
    y,
}: {
    fadeDuration: number;
    imageUrl: string;
    mirrored: boolean;
    nodeId: number;
    slideDirection: unknown;
    slideDuration: number;
    x: number;
    y: number;
}) {
    return (
        <AnimatedNpcCharacterImage
            fadeDuration={fadeDuration}
            imageUrl={imageUrl}
            key={[
                nodeId,
                imageUrl,
                stringConfig(slideDirection, 'left'),
                slideDuration,
                fadeDuration,
                mirrored,
                x,
                y,
            ].join(':')}
            mirrored={mirrored}
            slideDirection={slideDirection}
            slideDuration={slideDuration}
            x={x}
            y={y}
        />
    );
}

function AnimatedNpcCharacterImage({
    fadeDuration,
    imageUrl,
    mirrored,
    slideDirection,
    slideDuration,
    x,
    y,
}: {
    fadeDuration: number;
    imageUrl: string;
    mirrored: boolean;
    slideDirection: unknown;
    slideDuration: number;
    x: number;
    y: number;
}) {
    const startTransform = npcEntranceTransform(slideDirection);
    const endTransform = imageTransform(
        'translate(-50%, -50%) translate3d(0, 0, 0)',
        mirrored,
    );
    const slideDurationMs = Math.max(0, slideDuration) * 1000;
    const fadeDurationMs = Math.max(0, fadeDuration) * 1000;
    const hasEntranceAnimation = slideDurationMs > 0 || fadeDurationMs > 0;
    const [isVisible, setIsVisible] = useState(!hasEntranceAnimation);

    useEffect(() => {
        if (!hasEntranceAnimation) {
            return;
        }

        const frame = window.requestAnimationFrame(() => setIsVisible(true));

        return () => window.cancelAnimationFrame(frame);
    }, [hasEntranceAnimation]);

    return (
        <img
            alt=""
            className="absolute z-10 max-h-[70%] max-w-[55%] object-contain"
            draggable={false}
            src={imageUrl}
            style={{
                left: `${x}%`,
                opacity: isVisible ? 1 : 0,
                top: `${y}%`,
                transform: isVisible
                    ? endTransform
                    : imageTransform(startTransform, mirrored),
                transitionDuration: `${slideDurationMs}ms, ${fadeDurationMs}ms`,
                transitionProperty: 'transform, opacity',
                transitionTimingFunction:
                    'cubic-bezier(0.16, 1, 0.3, 1), ease-out',
            }}
        />
    );
}

function NpcAnswerOptions({
    answers,
    isSubmitting,
    onSelect,
    onSubmit,
    selectedAnswerKey,
}: {
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
                    disabled={isSubmitting}
                    key={answer.key}
                    onClick={() => onSelect(answer.key)}
                    type="button"
                >
                    <span className="mr-2 font-semibold">{answer.label}</span>
                    {answer.body}
                </button>
            ))}
            <Button
                disabled={!selectedAnswerKey || isSubmitting}
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

function firstNpcDialogueNodeId(activity: LearningActivity): number | null {
    const startTransition = activity.npcDialogueTransitions.find(
        (transition) => transition.fromNodeId === null,
    );

    return (
        startTransition?.toNodeId ??
        activity.npcDialogueNodes.find(
            (node) => node.type !== 'answer' && node.type !== 'end',
        )?.id ??
        null
    );
}

function isQuestionNode(node: NpcDialogueNode): boolean {
    return node.type === 'npc_question';
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

function answerOptions(
    activity: LearningActivity,
    node: NpcDialogueNode,
): NpcAnswerOption[] {
    return activity.npcDialogueTransitions
        .filter(
            (transition) =>
                transition.fromNodeId === node.id &&
                transition.fromConnector.startsWith('answer-'),
        )
        .sort(
            (first, second) =>
                connectorIndex(first.fromConnector) -
                connectorIndex(second.fromConnector),
        )
        .map((transition, index) => {
            const answerNode = npcDialogueNodeById(
                activity,
                transition.toNodeId,
            );
            const label = stringConfig(
                answerNode?.config.answerLabel,
                String.fromCharCode(65 + index),
            );

            return answerNode && answerNode.type === 'answer'
                ? {
                      answerNodeId: answerNode.id,
                      body: answerNode.body ?? answerNode.title,
                      isCorrect: Boolean(answerNode.config.isCorrect),
                      key: answerNode.id.toString(),
                      label,
                  }
                : null;
        })
        .filter((answer): answer is NpcAnswerOption => Boolean(answer));
}

function connectorIndex(connector: string): number {
    const parsed = Number(connector.replace('answer-', ''));

    return Number.isFinite(parsed) ? parsed : 999;
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

function dialogueSceneAssets(
    value: unknown,
    mode: 'dark' | 'light',
): DialogueSceneAsset[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isRecord).map((asset, index) => ({
        id: stringConfig(asset.id, `asset-${index + 1}`),
        imageUrl: themedAssetImage(asset.imageDark, asset.imageLight, mode),
        label: stringConfig(asset.label, `Scene asset ${index + 1}`),
        layer: dialogueSceneAssetLayer(asset.layer),
        mirrored: booleanConfig(asset.mirrored, false),
        width: clampNumber(numericConfig(asset.width, 24), 1, 100),
        x: clampNumber(numericConfig(asset.x, 50), 0, 100),
        y: clampNumber(numericConfig(asset.y, 50), 0, 100),
    }));
}

function themedAssetImage(
    darkValue: unknown,
    lightValue: unknown,
    mode: 'dark' | 'light',
): string | null {
    const darkImage = nullableString(darkValue);
    const lightImage = nullableString(lightValue);

    return mode === 'light'
        ? (lightImage ?? darkImage)
        : (darkImage ?? lightImage);
}

function dialogueSceneAssetLayer(value: unknown): DialogueSceneAssetLayer {
    if (
        value === 'behind_npc' ||
        value === 'front' ||
        value === 'bubble' ||
        value === 'overlay'
    ) {
        return value;
    }

    return 'front';
}

function dialogueSceneAssetZIndex(layer: DialogueSceneAssetLayer): number {
    if (layer === 'behind_npc') {
        return 8;
    }

    if (layer === 'front') {
        return 18;
    }

    if (layer === 'bubble') {
        return 22;
    }

    return 30;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function npcEntranceTransform(value: unknown): string {
    const direction = stringConfig(value, 'left');
    const offset = 48;

    if (direction === 'right') {
        return `translate(-50%, -50%) translate3d(${offset}px, 0, 0)`;
    }

    if (direction === 'top') {
        return `translate(-50%, -50%) translate3d(0, -${offset}px, 0)`;
    }

    if (direction === 'bottom') {
        return `translate(-50%, -50%) translate3d(0, ${offset}px, 0)`;
    }

    if (direction === 'none') {
        return 'translate(-50%, -50%) translate3d(0, 0, 0)';
    }

    return `translate(-50%, -50%) translate3d(-${offset}px, 0, 0)`;
}

function imageTransform(baseTransform: string, mirrored: boolean): string {
    return mirrored ? `${baseTransform} scaleX(-1)` : baseTransform;
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

function booleanConfig(value: unknown, fallback = false): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    }

    return fallback;
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
