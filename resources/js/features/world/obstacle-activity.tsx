import { ArrowRight, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSelectedLearningTool } from '@/features/tools/tool-selection';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type { ActivityTransition, LearningActivity } from '@/types';
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
    transition,
}: {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
}) {
    const { resolvedAppearance } = useAppearance();
    const selectedTool = useSelectedLearningTool();
    const [isPromptHidden, setIsPromptHidden] = useState(false);
    const [isSuccessHidden, setIsSuccessHidden] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [isResolved, setIsResolved] = useState(false);
    const [hint, setHint] = useState<string | null>(null);
    const backgroundImage = themedConfig(
        activity.config.backgroundDark,
        activity.config.backgroundLight,
        resolvedAppearance,
    );
    const obstacleImage = themedConfig(
        activity.config.obstacleImageDark,
        activity.config.obstacleImageLight,
        resolvedAppearance,
    );
    const promptText = stringValue(
        activity.config.promptText,
        'Something blocks the way. Equip a suitable tool, then use it here.',
    );
    const successText = stringValue(
        activity.config.successText,
        'The obstacle gives way.',
    );
    const typingSpeed = numericConfig(activity.config.typingSpeed, 24);
    const successAnimation = stringValue(
        activity.config.successAnimation,
        'zoom',
    );

    const handleUseTool = async () => {
        if (!selectedTool || isResolving || isResolved) {
            setHint('Equip a tool from the tool belt first.');

            return;
        }

        setIsResolving(true);
        setHint(null);

        try {
            const response = await postJson<{
                result: { isUseful: boolean; toolId: number };
            }>(`/learning/activities/${activity.id}/obstacle-tool`, {
                tool_id: selectedTool.id,
            });

            if (!response.result.isUseful) {
                setHint('That tool does not seem useful here.');

                return;
            }

            setIsResolved(true);
            await onComplete(activity);
        } finally {
            setIsResolving(false);
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

            <button
                className={cn(
                    'absolute top-1/2 left-1/2 z-10 grid min-h-40 min-w-52 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/10 p-6 text-cyan-800 transition hover:-translate-y-[52%] focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100 dark:focus-visible:ring-teal-200',
                    isResolved && successAnimationClass(successAnimation),
                )}
                disabled={isResolving || isResolved}
                onClick={() => void handleUseTool()}
                type="button"
            >
                {obstacleImage ? (
                    <img
                        alt=""
                        className="max-h-64 max-w-72 object-contain"
                        draggable={false}
                        src={obstacleImage}
                    />
                ) : (
                    <span className="text-sm font-semibold">
                        Use an equipped tool here
                    </span>
                )}
            </button>

            <div className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4">
                {!isPromptHidden && !isResolved ? (
                    <ObstacleSpeechBubble
                        activity={activity}
                        mode={resolvedAppearance}
                        onHide={() => setIsPromptHidden(true)}
                        text={promptText}
                        typingSpeed={typingSpeed}
                    />
                ) : null}

                {!isSuccessHidden && isResolved ? (
                    <ObstacleSpeechBubble
                        activity={activity}
                        mode={resolvedAppearance}
                        onHide={() => setIsSuccessHidden(true)}
                        text={successText}
                        typingSpeed={typingSpeed}
                    />
                ) : null}

                {hint ? (
                    <p className="rounded-lg border border-slate-200 bg-white/88 p-3 text-sm text-slate-600 backdrop-blur dark:border-white/10 dark:bg-slate-950/72 dark:text-slate-300">
                        {hint}
                    </p>
                ) : null}

                {isResolved ? (
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
