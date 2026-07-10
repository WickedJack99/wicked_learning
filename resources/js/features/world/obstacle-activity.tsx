import { ArrowRight, MessageCircle } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    selectLearningTool,
    useSelectedLearningTool,
} from '@/features/tools/tool-selection';
import {
    toolAnimationUrl,
    toolAnimationWidthPercent,
    toolAnimationWidthStyle,
} from '@/features/tools/tool-visuals';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type {
    ActivityTransition,
    LearningActivity,
    LearningProgress,
    LearningTool,
} from '@/types';
import {
    activityBubbleStyle,
    numericConfig,
    stringValue,
    successAnimationClass,
    themedConfig,
    TypingText,
} from './activity-utils';
import { postJson } from './api';

export function ObstacleActivity({
    activity,
    onComplete,
    onMoveToActivity,
    progress,
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    progress?: LearningProgress['activities'][number];
    transition: ActivityTransition | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const selectedTool = useSelectedLearningTool();
    const [isPromptHidden, setIsPromptHidden] = useState(false);
    const [isSuccessHidden, setIsSuccessHidden] = useState(false);
    const [isRevisitHidden, setIsRevisitHidden] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [isResolved, setIsResolved] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const [toolAnimation, setToolAnimation] = useState<ToolUseAnimation | null>(
        null,
    );
    const persistAfterSolved = booleanConfig(
        activity.config.persistAfterSolved,
        true,
    );
    const isClearedRevisit =
        persistAfterSolved && Boolean(obstacleDestroyedAt(progress));
    const activeBackgroundImage = obstacleThemedImage(
        activity,
        [
            'backgroundDark',
            'obstacleBackgroundDark',
            'obstacle_background_dark',
        ],
        [
            'backgroundLight',
            'obstacleBackgroundLight',
            'obstacle_background_light',
        ],
        resolvedAppearance,
    );
    const activeObstacleImage = obstacleThemedImage(
        activity,
        ['obstacleImageDark', 'imageDark', 'obstacle_image_dark'],
        ['obstacleImageLight', 'imageLight', 'obstacle_image_light'],
        resolvedAppearance,
    );
    const revisitBackgroundImage = obstacleThemedImage(
        activity,
        ['revisitBackgroundDark', 'obstacle_revisit_background_dark'],
        ['revisitBackgroundLight', 'obstacle_revisit_background_light'],
        resolvedAppearance,
    );
    const revisitObstacleImage = obstacleThemedImage(
        activity,
        ['revisitImageDark', 'obstacle_revisit_image_dark'],
        ['revisitImageLight', 'obstacle_revisit_image_light'],
        resolvedAppearance,
    );
    const isShowingClearedVisual = isResolved || isClearedRevisit;
    const backgroundImage = isShowingClearedVisual
        ? revisitBackgroundImage || activeBackgroundImage
        : activeBackgroundImage;
    const obstacleImage = isShowingClearedVisual
        ? revisitObstacleImage
        : activeObstacleImage;
    const promptText = stringValue(
        activity.config.promptText,
        'Something blocks the way. Equip a suitable tool, then use it here.',
    );
    const successText = stringValue(
        activity.config.successText,
        'The obstacle gives way.',
    );
    const revisitText = stringValue(
        activity.config.revisitText,
        'This obstacle has already been cleared.',
    );
    const typingSpeed = numericConfig(activity.config.typingSpeed, 24);
    const successAnimation = stringValue(
        activity.config.successAnimation,
        'zoom',
    );
    const isToolAnimating = Boolean(toolAnimation);
    const obstaclePlacement = obstaclePlacementStyle(
        activity,
        selectedTool,
        isToolAnimating,
    );
    const toolCursorStyle = cursorStyle(selectedTool, isToolAnimating);

    const handleSceneClick = async (event: MouseEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;

        if (target.closest('[data-obstacle-ui="true"]') || isClearedRevisit) {
            return;
        }

        const clickedObstacle = Boolean(
            target.closest('[data-obstacle-target="true"]'),
        );

        if (!selectedTool) {
            if (clickedObstacle) {
                setHint('Equip a tool from the tool belt first.');
            }

            return;
        }

        if (isResolving || isResolved) {
            return;
        }

        const tool = selectedTool;
        const animation = toolUseAnimationFor(tool, resolvedAppearance, event);

        selectLearningTool(null);
        setHint(null);
        showToolAnimation(animation, setToolAnimation);

        if (!clickedObstacle) {
            return;
        }

        setIsResolving(true);

        try {
            const responsePromise = postJson<{
                result: { isUseful: boolean; toolId: number };
            }>(`/learning/activities/${activity.id}/obstacle-tool`, {
                tool_id: tool.id,
            });
            await wait(animation.durationMs);
            const response = await responsePromise;

            if (!response.result.isUseful) {
                setHint('That tool does not seem useful here.');

                return;
            }

            setIsResolved(true);
            await wait(obstacleSuccessAnimationDurationMs(successAnimation));
            await onComplete(activity);
        } finally {
            setIsResolving(false);
        }
    };

    return (
        <div
            className="relative isolate flex min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6"
            onClick={(event) => void handleSceneClick(event)}
            style={toolCursorStyle}
        >
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    src={backgroundImage}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />

            {isClearedRevisit ? (
                <ObstacleClearedVisual
                    imageUrl={obstacleImage}
                    style={obstaclePlacement}
                />
            ) : (
                <ObstacleTargetVisual
                    imageUrl={obstacleImage}
                    isResolved={isResolved}
                    isResolving={isResolving}
                    successAnimation={successAnimation}
                    style={obstaclePlacement}
                />
            )}

            {toolAnimation ? (
                <ToolUseAnimation animation={toolAnimation} />
            ) : null}

            <div
                className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4"
                data-obstacle-ui="true"
            >
                {!isPromptHidden && !isResolved && !isClearedRevisit ? (
                    <ObstacleSpeechBubble
                        activity={activity}
                        mode={resolvedAppearance}
                        onHide={() => setIsPromptHidden(true)}
                        text={promptText}
                        typingSpeed={typingSpeed}
                    />
                ) : null}

                {!isSuccessHidden && isResolved && !isClearedRevisit ? (
                    <ObstacleSpeechBubble
                        activity={activity}
                        mode={resolvedAppearance}
                        onHide={() => setIsSuccessHidden(true)}
                        text={successText}
                        typingSpeed={typingSpeed}
                    />
                ) : null}

                {!isRevisitHidden && isClearedRevisit ? (
                    <ObstacleSpeechBubble
                        activity={activity}
                        mode={resolvedAppearance}
                        onHide={() => setIsRevisitHidden(true)}
                        text={revisitText}
                        typingSpeed={typingSpeed}
                    />
                ) : null}

                {hint && !isClearedRevisit ? (
                    <p className="rounded-lg border border-slate-200 bg-white/88 p-3 text-sm text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300">
                        {hint}
                    </p>
                ) : null}

                {isResolved || isClearedRevisit ? (
                    <Button
                        className="self-end"
                        onClick={() =>
                            onMoveToActivity(transition?.toActivityId ?? null)
                        }
                        type="button"
                    >
                        Continue
                        <ArrowRight className="ml-2 size-4" />
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

type ToolUseAnimation = {
    durationMs: number;
    id: number;
    imageUrl: string;
    widthPercent: number;
    x: number;
    y: number;
};

function ObstacleTargetVisual({
    imageUrl,
    isResolved,
    isResolving,
    style,
    successAnimation,
}: {
    imageUrl: string;
    isResolved: boolean;
    isResolving: boolean;
    style: CSSProperties;
    successAnimation: string;
}) {
    if (isResolved && !imageUrl) {
        return null;
    }

    return (
        <div
            className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={style}
        >
            <button
                className={cn(
                    'cursor-inherit disabled:cursor-inherit grid w-full place-items-center rounded-xl transition focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:focus-visible:ring-teal-200',
                    imageUrl
                        ? 'bg-transparent p-0'
                        : 'min-h-40 min-w-52 border border-dashed border-cyan-500/40 bg-cyan-950/10 p-6 text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100',
                    isResolved && successAnimationClass(successAnimation),
                )}
                data-obstacle-target="true"
                disabled={isResolving || isResolved}
                type="button"
            >
                {imageUrl ? (
                    <img
                        alt=""
                        className="w-full object-contain"
                        draggable={false}
                        src={imageUrl}
                    />
                ) : (
                    <span className="text-sm font-semibold">
                        Use an equipped tool here
                    </span>
                )}
            </button>
        </div>
    );
}

function ObstacleClearedVisual({
    imageUrl,
    style,
}: {
    imageUrl: string;
    style: CSSProperties;
}) {
    if (!imageUrl) {
        return null;
    }

    return (
        <div
            className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={style}
        >
            <img
                alt=""
                className="w-full object-contain"
                draggable={false}
                src={imageUrl}
            />
        </div>
    );
}

function ToolUseAnimation({ animation }: { animation: ToolUseAnimation }) {
    if (!animation.imageUrl) {
        return null;
    }

    return (
        <img
            alt=""
            className="pointer-events-none absolute z-30 h-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            draggable={false}
            key={animation.id}
            src={cacheBustedUrl(animation.imageUrl, animation.id)}
            style={{
                left: animation.x,
                top: animation.y,
                width: toolAnimationWidthStyle(animation.widthPercent),
            }}
        />
    );
}

function obstaclePlacementStyle(
    activity: LearningActivity,
    selectedTool: LearningTool | null,
    isToolAnimating: boolean,
): CSSProperties {
    return {
        ...cursorStyle(selectedTool, isToolAnimating),
        left: `${clamp(numericConfig(activity.config.obstacleX, 50), 0, 100)}%`,
        top: `${clamp(numericConfig(activity.config.obstacleY, 50), 0, 100)}%`,
        width: `${clamp(numericConfig(activity.config.obstacleWidth, 28), 1, 100)}%`,
    };
}

function cursorStyle(
    selectedTool: LearningTool | null,
    isToolAnimating: boolean,
): CSSProperties | undefined {
    if (isToolAnimating) {
        return { cursor: 'none' };
    }

    return selectedTool ? { cursor: 'var(--platform-cursor)' } : undefined;
}

function toolUseAnimationFor(
    tool: LearningTool,
    mode: 'dark' | 'light',
    event: MouseEvent<HTMLDivElement>,
): ToolUseAnimation {
    const bounds = event.currentTarget.getBoundingClientRect();
    const imageUrl = toolAnimationUrl(tool, mode);
    const durationSeconds = numericConfig(
        tool.config.animationDurationSeconds,
        imageUrl ? 0.75 : 0,
    );

    return {
        durationMs: Math.max(0, durationSeconds * 1000),
        id: Date.now(),
        imageUrl,
        widthPercent: toolAnimationWidthPercent(tool),
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
    };
}

function showToolAnimation(
    animation: ToolUseAnimation,
    setToolAnimation: (animation: ToolUseAnimation | null) => void,
) {
    setToolAnimation(animation);

    window.setTimeout(
        () => setToolAnimation(null),
        Math.max(animation.durationMs, 120),
    );
}

function wait(durationMs: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

function cacheBustedUrl(url: string, id: number): string {
    const separator = url.includes('?') ? '&' : '?';

    return `${url}${separator}tool_use=${id}`;
}

function obstacleSuccessAnimationDurationMs(animation: string): number {
    if (animation === 'none') {
        return 0;
    }

    if (animation === 'shake') {
        return 760;
    }

    if (animation === 'rotate') {
        return 900;
    }

    return 820;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function obstacleThemedImage(
    activity: LearningActivity,
    darkKeys: string[],
    lightKeys: string[],
    mode: 'dark' | 'light',
): string {
    return themedConfig(
        firstConfigValue(activity, darkKeys),
        firstConfigValue(activity, lightKeys),
        mode,
    );
}

function firstConfigValue(activity: LearningActivity, keys: string[]): unknown {
    for (const key of keys) {
        const value = activity.config[key];

        if (stringValue(value)) {
            return value;
        }
    }

    return '';
}

function obstacleDestroyedAt(
    progress: LearningProgress['activities'][number] | undefined,
): string | null {
    const metadata = progress?.metadata;
    const obstacle =
        metadata && typeof metadata === 'object' && !Array.isArray(metadata)
            ? metadata.obstacle
            : null;

    if (!obstacle || typeof obstacle !== 'object' || Array.isArray(obstacle)) {
        return null;
    }

    const obstacleMetadata = obstacle as Record<string, unknown>;

    return typeof obstacleMetadata.destroyedAt === 'string'
        ? obstacleMetadata.destroyedAt
        : null;
}

function booleanConfig(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();

        if (['false', '0', 'no', 'off'].includes(normalized)) {
            return false;
        }

        if (['true', '1', 'yes', 'on'].includes(normalized)) {
            return true;
        }
    }

    return fallback;
}

function ObstacleSpeechBubble({
    activity,
    mode,
    onHide,
    text,
    typingSpeed,
}: {
    activity: LearningActivity;
    mode: 'dark' | 'light';
    onHide: () => void;
    text: string;
    typingSpeed: number;
}) {
    return (
        <div
            className="rounded-2xl border p-4 backdrop-blur-md"
            style={activityBubbleStyle(activity, mode)}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="size-4" />
                    Obstacle
                </div>
                <Button
                    onClick={onHide}
                    size="sm"
                    type="button"
                    variant="ghost"
                >
                    Hide
                </Button>
            </div>
            <TypingText key={text} speed={typingSpeed} text={text} />
        </div>
    );
}
