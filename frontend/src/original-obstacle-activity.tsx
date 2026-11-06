import { ArrowRight, MessageCircle } from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type LearnerTool = components['schemas']['LearnerTool'];

type ToolUseAnimation = {
    durationMs: number;
    id: number;
    imageUrl: string;
    widthPercent: number;
    x: number;
    y: number;
};

/**
 * Source-adapted from `features/world/obstacle-activity.tsx`. React retains
 * the original selection, target and animation experience; Rust resolves
 * owned-tool eligibility, useful-tool evaluation and persistent clearing.
 */
export function OriginalObstacleActivity({
    activity,
    appearance,
    onComplete,
    onSelectTool,
    playRunId,
    selectedTool,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    onComplete: () => Promise<void>;
    onSelectTool: (tool: LearnerTool | null) => void;
    playRunId: string;
    selectedTool: LearnerTool | null;
}) {
    const config = activity.config as Record<string, unknown>;
    const [isPromptHidden, setIsPromptHidden] = useState(false);
    const [isSuccessHidden, setIsSuccessHidden] = useState(false);
    const [isRevisitHidden, setIsRevisitHidden] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [isPersistedResolution] = useState(
        config.isResolved === true && config.persistAfterSolved !== false,
    );
    const [isResolved, setIsResolved] = useState(isPersistedResolution);
    const [hint, setHint] = useState<string | null>(null);
    const [toolAnimation, setToolAnimation] = useState<ToolUseAnimation | null>(
        null,
    );
    const persistsAfterSolved = config.persistAfterSolved !== false;
    // The source differentiates a pre-existing durable clear (its revisit
    // visual) from the success animation of the tool use happening now.
    const isClearedRevisit = persistsAfterSolved && isPersistedResolution;
    const activeBackgroundImage = themedConfig(
        stringConfig(config.backgroundDark),
        stringConfig(config.backgroundLight),
        appearance,
    );
    const activeObstacleImage = themedConfig(
        stringConfig(config.obstacleImageDark),
        stringConfig(config.obstacleImageLight),
        appearance,
    );
    const revisitBackgroundImage = themedConfig(
        stringConfig(config.revisitBackgroundDark),
        stringConfig(config.revisitBackgroundLight),
        appearance,
    );
    const revisitObstacleImage = themedConfig(
        stringConfig(config.revisitImageDark),
        stringConfig(config.revisitImageLight),
        appearance,
    );
    const isShowingClearedVisual = isResolved || isClearedRevisit;
    const backgroundImage = isShowingClearedVisual
        ? revisitBackgroundImage || activeBackgroundImage
        : activeBackgroundImage;
    const backgroundMirrored =
        isShowingClearedVisual && revisitBackgroundImage
            ? config.revisitBackgroundMirrored === true
            : config.backgroundMirrored === true;
    const obstacleImage = isShowingClearedVisual
        ? revisitObstacleImage
        : activeObstacleImage;
    const obstacleMirrored = isShowingClearedVisual
        ? config.revisitImageMirrored === true
        : config.obstacleImageMirrored === true;
    const promptText =
        stringConfig(config.promptText) ??
        'Something blocks the way. Equip a suitable tool, then use it here.';
    const toolHint = selectedTool
        ? `Selected tool: ${selectedTool.title}. Click the gate above.`
        : 'Choose a tool with the hammer button, then click the gate above.';
    const successText =
        stringConfig(config.successText) ?? 'The obstacle gives way.';
    const revisitText =
        stringConfig(config.revisitText) ??
        'This obstacle has already been cleared.';
    const typingSpeed = numberConfig(config.typingSpeed, 24);
    const successAnimation = stringConfig(config.successAnimation) ?? 'zoom';
    const isToolAnimating = Boolean(toolAnimation);
    const obstaclePlacement = obstaclePlacementStyle(
        config,
        selectedTool,
        isToolAnimating,
    );
    const toolCursorStyle = cursorStyle(selectedTool, isToolAnimating);

    async function handleSceneClick(
        event: MouseEvent<HTMLDivElement>,
    ): Promise<void> {
        const target = event.target as HTMLElement;
        if (target.closest('[data-obstacle-ui="true"]') || isClearedRevisit) {
            return;
        }
        const clickedObstacle = Boolean(
            target.closest('[data-obstacle-target="true"]'),
        );
        if (!selectedTool) {
            if (clickedObstacle) setHint('Equip a tool from the tool belt first.');
            return;
        }
        if (isResolving || isResolved) return;

        const tool = selectedTool;
        const animation = toolUseAnimationFor(tool, appearance, event);
        onSelectTool(null);
        setHint(null);
        showToolAnimation(animation, setToolAnimation);
        if (!clickedObstacle) return;

        setIsResolving(true);
        try {
            const token = await getCsrfToken();
            const responsePromise = apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/use-obstacle-tool',
                {
                    body: { tool_slug: tool.slug },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            await wait(animation.durationMs);
            const { data, response } = await responsePromise;
            if (!response.ok || !data || !data.is_useful) {
                setHint('That tool does not seem useful here.');
                return;
            }

            setIsResolved(data.is_resolved);
            await wait(successAnimationDurationMs(successAnimation));
            await onComplete();
        } catch {
            setHint('That tool cannot be used here.');
        } finally {
            setIsResolving(false);
        }
    }

    return (
        <div
            className="relative isolate flex min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6"
            data-wl-id="learner.activity.obstacle.scene"
            onClick={(event) => void handleSceneClick(event)}
            style={toolCursorStyle}
        >
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    decoding="async"
                    src={backgroundImage}
                    style={{
                        transform: backgroundMirrored ? 'scaleX(-1)' : undefined,
                    }}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />

            {isClearedRevisit ? (
                <ObstacleClearedVisual
                    imageUrl={obstacleImage}
                    mirrored={obstacleMirrored}
                    style={obstaclePlacement}
                />
            ) : (
                <ObstacleTargetVisual
                    imageUrl={obstacleImage}
                    isResolved={isResolved}
                    isResolving={isResolving}
                    mirrored={obstacleMirrored}
                    style={obstaclePlacement}
                    successAnimation={successAnimation}
                />
            )}
            {toolAnimation ? <ToolUseAnimation animation={toolAnimation} /> : null}

            <div
                className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4"
                data-obstacle-ui="true"
            >
                {!isPromptHidden && !isResolved && !isClearedRevisit ? (
                    <ObstacleSpeechBubble
                        config={config}
                        hint={toolHint}
                        onHide={() => setIsPromptHidden(true)}
                        text={promptText}
                        typingSpeed={typingSpeed}
                        appearance={appearance}
                    />
                ) : null}
                {!isSuccessHidden && isResolved && !isClearedRevisit ? (
                    <ObstacleSpeechBubble
                        config={config}
                        onHide={() => setIsSuccessHidden(true)}
                        text={successText}
                        typingSpeed={typingSpeed}
                        appearance={appearance}
                    />
                ) : null}
                {!isRevisitHidden && isClearedRevisit ? (
                    <ObstacleSpeechBubble
                        config={config}
                        onHide={() => setIsRevisitHidden(true)}
                        text={revisitText}
                        typingSpeed={typingSpeed}
                        appearance={appearance}
                    />
                ) : null}
                {hint && !isClearedRevisit ? (
                    <p className="rounded-lg border border-slate-200 bg-white/88 p-3 text-sm text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300">
                        {hint}
                    </p>
                ) : null}
                {isResolved || isClearedRevisit ? (
                    <button
                        className="inline-flex h-9 items-center justify-center self-end rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-medium text-slate-950 transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none"
                        onClick={() => void onComplete()}
                        type="button"
                    >
                        {activity.completion.label?.trim() || 'Continue'}
                        <ArrowRight className="ml-2 size-4" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function ObstacleTargetVisual({
    imageUrl,
    isResolved,
    isResolving,
    mirrored,
    style,
    successAnimation,
}: {
    imageUrl: string | null;
    isResolved: boolean;
    isResolving: boolean;
    mirrored: boolean;
    style: CSSProperties;
    successAnimation: string;
}) {
    const [imageFailed, setImageFailed] = useState(false);
    if (isResolved && (!imageUrl || imageFailed)) return null;
    const canShowImage = Boolean(imageUrl) && !imageFailed;
    return (
        <div
            className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={style}
        >
            <button
                aria-label="Use an equipped tool on the gate"
                className={`cursor-inherit grid w-full place-items-center rounded-xl transition focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:focus-visible:ring-teal-200 ${canShowImage ? 'bg-transparent p-0' : 'min-h-40 min-w-52 border border-dashed border-cyan-500/40 bg-cyan-950/10 p-6 text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100'} ${isResolved ? successAnimationClass(successAnimation) : ''}`}
                data-obstacle-target="true"
                disabled={isResolving || isResolved}
                type="button"
            >
                {canShowImage ? (
                    <img
                        alt=""
                        className="w-full object-contain"
                        decoding="async"
                        draggable={false}
                        onError={() => setImageFailed(true)}
                        src={imageUrl ?? undefined}
                        style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
                    />
                ) : (
                    <span className="text-sm font-semibold">
                        Equip a tool, then click the gate
                    </span>
                )}
            </button>
        </div>
    );
}

function ObstacleClearedVisual({
    imageUrl,
    mirrored,
    style,
}: {
    imageUrl: string | null;
    mirrored: boolean;
    style: CSSProperties;
}) {
    if (!imageUrl) return null;

    return (
        <div
            className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={style}
        >
            <img
                alt=""
                className="w-full object-contain"
                decoding="async"
                draggable={false}
                src={imageUrl}
                style={{ transform: mirrored ? 'scaleX(-1)' : undefined }}
            />
        </div>
    );
}

function ToolUseAnimation({ animation }: { animation: ToolUseAnimation }) {
    if (!animation.imageUrl) return null;

    return (
        <img
            alt=""
            className="pointer-events-none absolute z-30 h-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
            decoding="async"
            draggable={false}
            key={animation.id}
            src={cacheBustedUrl(animation.imageUrl, animation.id)}
            style={{
                left: animation.x,
                top: animation.y,
                width: `${animation.widthPercent}%`,
            }}
        />
    );
}

function ObstacleSpeechBubble({
    appearance,
    config,
    hint,
    onHide,
    text,
    typingSpeed,
}: {
    appearance: OriginalAppearance;
    config: Record<string, unknown>;
    hint?: string;
    onHide: () => void;
    text: string;
    typingSpeed: number;
}) {
    const style = {
        backgroundColor:
            appearance === 'dark'
                ? (stringConfig(config.bubbleColorDark) ?? '#0f172a')
                : (stringConfig(config.bubbleColorLight) ?? '#ffffff'),
        borderColor:
            appearance === 'dark'
                ? (stringConfig(config.bubbleBorderColorDark) ?? '#2dd4bf')
                : (stringConfig(config.bubbleBorderColorLight) ?? '#0891b2'),
        opacity:
            (appearance === 'dark'
                ? numberConfig(config.bubbleOpacityDark, 92)
                : numberConfig(config.bubbleOpacityLight, 94)) / 100,
    };
    return (
        <div className="rounded-2xl border p-4 backdrop-blur-md" style={style}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="size-4" />
                    Obstacle
                </div>
                <button
                    className="rounded-md px-2 py-1 text-sm hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={onHide}
                    type="button"
                >
                    Hide
                </button>
            </div>
            <TypingText speed={typingSpeed} text={text} />
            {hint ? <p className="mt-3 text-xs opacity-80">{hint}</p> : null}
        </div>
    );
}

function TypingText({ speed, text }: { speed: number; text: string }) {
    const [visibleText, setVisibleText] = useState('');
    useEffect(() => {
        if (!text) {
            const timer = window.setTimeout(() => setVisibleText(''), 0);
            return () => window.clearTimeout(timer);
        }
        let index = 0;
        const timer = window.setInterval(() => {
            index += 1;
            setVisibleText(text.slice(0, index));
            if (index >= text.length) window.clearInterval(timer);
        }, Math.max(1, speed));
        return () => window.clearInterval(timer);
    }, [speed, text]);
    return <p className="min-h-12 text-sm leading-6">{visibleText}</p>;
}

function obstaclePlacementStyle(
    config: Record<string, unknown>,
    selectedTool: LearnerTool | null,
    isToolAnimating: boolean,
): CSSProperties {
    return {
        ...cursorStyle(selectedTool, isToolAnimating),
        left: `${numberConfig(config.obstacleX, 50)}%`,
        top: `${numberConfig(config.obstacleY, 50)}%`,
        width: `${numberConfig(config.obstacleWidth, 28)}%`,
    };
}

function cursorStyle(
    selectedTool: LearnerTool | null,
    isToolAnimating: boolean,
): CSSProperties | undefined {
    if (isToolAnimating) return { cursor: 'none' };
    return selectedTool ? { cursor: 'var(--platform-cursor)' } : undefined;
}

function toolUseAnimationFor(
    tool: LearnerTool,
    appearance: OriginalAppearance,
    event: MouseEvent<HTMLDivElement>,
): ToolUseAnimation {
    const bounds = event.currentTarget.getBoundingClientRect();
    const imageUrl =
        themedConfig(tool.animation_dark, tool.animation_light, appearance) ?? '';
    const toolConfig = tool.config as Record<string, unknown>;
    return {
        durationMs: Math.max(
            0,
            numberConfig(
                toolConfig.animationDurationSeconds,
                imageUrl ? 0.75 : 0,
            ) * 1000,
        ),
        id: Date.now(),
        imageUrl,
        widthPercent: numberConfig(toolConfig.imageWidthPercent, 18),
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
    return `${url}${url.includes('?') ? '&' : '?'}tool_use=${id}`;
}

function successAnimationDurationMs(animation: string): number {
    if (animation === 'none') return 0;
    if (animation === 'shake') return 760;
    if (animation === 'rotate') return 900;
    return 820;
}

function successAnimationClass(animation: string): string {
    if (animation === 'none') return '';
    if (animation === 'shake') return 'animate-[shake_760ms_ease-in-out]';
    if (animation === 'rotate') return 'animate-[spin_900ms_ease-in-out]';
    return 'animate-[pulse_820ms_ease-in-out]';
}

function stringConfig(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
}

function numberConfig(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(100, Math.max(0, value))
        : fallback;
}

function themedConfig(
    dark: string | null,
    light: string | null,
    appearance: OriginalAppearance,
): string | null {
    return appearance === 'light' ? light ?? dark : dark ?? light;
}
