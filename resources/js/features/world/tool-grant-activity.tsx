import { ArrowRight, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { addGrantedLearningTool } from '@/features/tools/tool-selection';
import { useAppearance } from '@/hooks/use-appearance';
import type {
    ActivityTransition,
    LearningActivity,
    LearningTool,
} from '@/types';
import {
    activityBubbleStyle,
    entranceTransform,
    numericConfig,
    stringValue,
    themedConfig,
    TypingText,
} from './activity-utils';
import { postJson } from './api';

export function ToolGrantActivity({
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
    const { resolvedAppearance } = useAppearance();
    const [isGranting, setIsGranting] = useState(false);
    const [isGranted, setIsGranted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isBubbleHidden, setIsBubbleHidden] = useState(false);
    const configuredTool = activity.configuredTool;
    const backgroundImage = themedConfig(
        activity.config.backgroundDark,
        activity.config.backgroundLight,
        resolvedAppearance,
    );
    const toolImage = themedConfig(
        configuredTool?.imageDark,
        configuredTool?.imageLight,
        resolvedAppearance,
    );
    const toolX = numericConfig(activity.config.toolX, 50);
    const toolY = numericConfig(activity.config.toolY, 50);
    const text = stringValue(
        activity.config.text,
        configuredTool
            ? `You found ${configuredTool.title}.`
            : 'A tool should be configured here.',
    );
    const typingSpeed = numericConfig(activity.config.typingSpeed, 24);

    const grantTool = async () => {
        if (isGranting || isGranted || !configuredTool) {
            return;
        }

        setIsGranting(true);
        setError(null);

        try {
            const response = await postJson<{ tool: LearningTool }>(
                `/learning/activities/${activity.id}/grant-tool`,
                {},
            );

            addGrantedLearningTool(response.tool);
            setIsGranted(true);
            await onComplete(activity);
            onMoveToActivity(transition?.toActivityId ?? null);
        } catch {
            setError('The tool could not be added right now.');
        } finally {
            setIsGranting(false);
        }
    };

    return (
        <div className="relative isolate flex min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6">
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    src={backgroundImage}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />

            <ToolGrantVisual
                activity={activity}
                imageUrl={toolImage}
                mode={resolvedAppearance}
                title={configuredTool?.title ?? 'Configured tool'}
                x={toolX}
                y={toolY}
            />

            <div className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4">
                {!isBubbleHidden ? (
                    <div
                        className="rounded-2xl border p-4 backdrop-blur-md"
                        style={activityBubbleStyle(
                            activity,
                            resolvedAppearance,
                        )}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <MessageCircle className="size-4" />
                                {configuredTool?.title ?? 'Tool'}
                            </div>
                            <Button
                                onClick={() => setIsBubbleHidden(true)}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                Hide
                            </Button>
                        </div>
                        <TypingText
                            key={text}
                            speed={typingSpeed}
                            text={text}
                        />
                    </div>
                ) : null}

                {error ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {error}
                    </p>
                ) : null}

                <Button
                    className="self-end"
                    disabled={!configuredTool || isGranting || isGranted}
                    onClick={() => void grantTool()}
                    type="button"
                >
                    {isGranted
                        ? 'Added'
                        : isGranting
                          ? 'Adding...'
                          : 'Take tool'}
                    <ArrowRight className="ml-2 size-4" />
                </Button>
            </div>
        </div>
    );
}

function ToolGrantVisual({
    activity,
    imageUrl,
    mode,
    title,
    x,
    y,
}: {
    activity: LearningActivity;
    imageUrl: string;
    mode: 'dark' | 'light';
    title: string;
    x: number;
    y: number;
}) {
    if (!imageUrl) {
        return (
            <div
                className="absolute z-10 grid min-h-32 min-w-44 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/10 p-6 text-sm font-semibold text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100"
                style={{ left: `${x}%`, top: `${y}%` }}
            >
                {title}
            </div>
        );
    }

    return (
        <AnimatedToolGrantImage
            fadeDuration={numericConfig(
                activity.config.fadeDurationSeconds,
                0.4,
            )}
            imageUrl={imageUrl}
            key={[
                imageUrl,
                mode,
                stringValue(activity.config.slideDirection, 'left'),
                activity.config.slideDurationSeconds,
                activity.config.fadeDurationSeconds,
                x,
                y,
            ].join(':')}
            slideDirection={activity.config.slideDirection}
            slideDuration={numericConfig(
                activity.config.slideDurationSeconds,
                0.6,
            )}
            x={x}
            y={y}
        />
    );
}

function AnimatedToolGrantImage({
    fadeDuration,
    imageUrl,
    slideDirection,
    slideDuration,
    x,
    y,
}: {
    fadeDuration: number;
    imageUrl: string;
    slideDirection: unknown;
    slideDuration: number;
    x: number;
    y: number;
}) {
    const startTransform = entranceTransform(slideDirection);
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
            className="absolute z-10 max-h-[52%] max-w-[48%] object-contain"
            draggable={false}
            src={imageUrl}
            style={{
                left: `${x}%`,
                opacity: isVisible ? 1 : 0,
                top: `${y}%`,
                transform: isVisible
                    ? 'translate(-50%, -50%) translate3d(0, 0, 0)'
                    : startTransform,
                transitionDuration: `${slideDurationMs}ms, ${fadeDurationMs}ms`,
                transitionProperty: 'transform, opacity',
                transitionTimingFunction:
                    'cubic-bezier(0.16, 1, 0.3, 1), ease-out',
            }}
        />
    );
}
