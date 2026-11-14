import { ArrowRight, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type LearnerTool = components['schemas']['LearnerTool'];

/**
 * Lifted from `resources/js/features/world/tool-grant-activity.tsx`.
 * Only Inertia state, the source tool store, and its Laravel endpoint are
 * replaced; the Rust API stays the authority for the active activity and its
 * configured tool.
 */
export function OriginalToolGrantActivity({
    activity,
    appearance,
    onComplete,
    playRunId,
}: {
    activity: LearnerPlaybackActivity;
    appearance: OriginalAppearance;
    onComplete: () => Promise<void>;
    playRunId: string;
}) {
    const [isGranting, setIsGranting] = useState(false);
    const [isGranted, setIsGranted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isBubbleHidden, setIsBubbleHidden] = useState(false);
    const skippedOwnedActivity = useRef<string | null>(null);
    const config = toolGrantConfig(activity.config);
    const t = usePlatformTranslation();
    const configuredTool = config.tool;
    const alreadyOwnsConfiguredTool = config.alreadyOwned;
    const backgroundImage = themedAsset(
        config.backgroundDark,
        config.backgroundLight,
        appearance,
    );
    const toolImage = configuredTool
        ? themedAsset(
              configuredTool.image_dark,
              configuredTool.image_light,
              appearance,
          )
        : '';
    const text =
        config.text ||
        (configuredTool
            ? t('activities.tool_grant.discovered', 'You found :tool.', {
                  tool: configuredTool.title,
              })
            : t(
                  'activities.tool_grant.missing_configuration',
                  'A tool should be configured here.',
              ));

    useEffect(() => {
        if (
            !alreadyOwnsConfiguredTool ||
            skippedOwnedActivity.current === activity.slug
        ) {
            return;
        }

        skippedOwnedActivity.current = activity.slug;
        void onComplete();
    }, [activity.slug, alreadyOwnsConfiguredTool, onComplete]);

    async function grantTool(): Promise<void> {
        if (isGranting || isGranted || !configuredTool) {
            return;
        }
        setIsGranting(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/grant-tool',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('Tool grant is unavailable.');
            }
            setIsGranted(true);
            await onComplete();
        } catch {
            setError(
                t(
                    'activities.tool_grant.error',
                    'The tool could not be added right now.',
                ),
            );
        } finally {
            setIsGranting(false);
        }
    }

    if (alreadyOwnsConfiguredTool) {
        return (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-300">
                {t(
                    'activities.tool_grant.already_available',
                    'This tool is already available. Continuing...',
                )}
            </div>
        );
    }

    return (
        <div className="relative isolate flex min-h-[28rem] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/6">
            {backgroundImage ? (
                <img
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                    decoding="async"
                    src={backgroundImage}
                    style={{
                        transform: config.backgroundMirrored
                            ? 'scaleX(-1)'
                            : undefined,
                    }}
                />
            ) : null}
            <div className="absolute inset-0 bg-white/72 dark:bg-slate-950/62" />
            <ToolGrantVisual
                config={config}
                imageUrl={toolImage}
                mirrored={config.toolMirrored}
                title={
                    configuredTool?.title ??
                    t(
                        'activities.tool_grant.configured_tool',
                        'Configured tool',
                    )
                }
                widthPercent={toolImageWidthPercent(configuredTool)}
            />
            <div className="relative z-20 mt-auto flex w-full flex-col gap-3 p-4">
                {!isBubbleHidden ? (
                    <div
                        className="rounded-2xl border p-4 backdrop-blur-md"
                        style={activityBubbleStyle(config, appearance)}
                    >
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <MessageCircle className="size-4" />
                                {configuredTool?.title ??
                                    t('activities.tool_grant.tool', 'Tool')}
                            </div>
                            <button
                                className="rounded-md px-2 py-1 text-sm hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:hover:bg-white/10 dark:focus-visible:ring-teal-200"
                                onClick={() => setIsBubbleHidden(true)}
                                type="button"
                            >
                                {t('activities.tool_grant.hide', 'Hide')}
                            </button>
                        </div>
                        <TypingText speed={config.typingSpeed} text={text} />
                    </div>
                ) : null}
                {error ? (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
                        {error}
                    </p>
                ) : null}
                <button
                    className="inline-flex h-10 items-center justify-center self-end rounded-md bg-cyan-700 px-4 text-sm font-medium text-white transition hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 dark:bg-teal-200 dark:text-slate-950 dark:hover:bg-teal-100 dark:focus-visible:ring-teal-200"
                    disabled={!configuredTool || isGranting || isGranted}
                    onClick={() => void grantTool()}
                    type="button"
                >
                    {isGranted
                        ? t('activities.tool_grant.added', 'Added')
                        : isGranting
                          ? t('activities.tool_grant.adding', 'Adding...')
                          : t('activities.tool_grant.take', 'Take tool')}
                    <ArrowRight className="ml-2 size-4" />
                </button>
            </div>
        </div>
    );
}

function ToolGrantVisual({
    config,
    imageUrl,
    mirrored,
    title,
    widthPercent,
}: {
    config: ToolGrantConfig;
    imageUrl: string;
    mirrored: boolean;
    title: string;
    widthPercent: number;
}) {
    if (!imageUrl) {
        return (
            <div
                className="absolute z-10 grid min-h-32 min-w-44 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-dashed border-cyan-500/40 bg-cyan-950/10 p-6 text-sm font-semibold text-cyan-800 dark:border-teal-200/30 dark:bg-teal-200/10 dark:text-teal-100"
                style={{
                    left: `${config.toolX}%`,
                    top: `${config.toolY}%`,
                    width: toolImageWidthStyle(widthPercent),
                }}
            >
                {title}
            </div>
        );
    }

    return (
        <AnimatedToolGrantImage
            config={config}
            imageUrl={imageUrl}
            mirrored={mirrored}
            widthPercent={widthPercent}
        />
    );
}

function AnimatedToolGrantImage({
    config,
    imageUrl,
    mirrored,
    widthPercent,
}: {
    config: ToolGrantConfig;
    imageUrl: string;
    mirrored: boolean;
    widthPercent: number;
}) {
    const startTransform = entranceTransform(config.slideDirection);
    const endTransform = imageTransform(
        'translate(-50%, -50%) translate3d(0, 0, 0)',
        mirrored,
    );
    const slideDurationMs = Math.max(0, config.slideDurationSeconds) * 1000;
    const fadeDurationMs = Math.max(0, config.fadeDurationSeconds) * 1000;
    const hasEntranceAnimation = slideDurationMs > 0 || fadeDurationMs > 0;
    const [isVisible, setIsVisible] = useState(!hasEntranceAnimation);

    useEffect(() => {
        if (!hasEntranceAnimation) return;
        const frame = window.requestAnimationFrame(() => setIsVisible(true));
        return () => window.cancelAnimationFrame(frame);
    }, [hasEntranceAnimation]);

    return (
        <img
            alt=""
            className="absolute z-10 max-h-[52%] object-contain"
            decoding="async"
            draggable={false}
            src={imageUrl}
            style={{
                left: `${config.toolX}%`,
                opacity: isVisible ? 1 : 0,
                top: `${config.toolY}%`,
                transform: isVisible
                    ? endTransform
                    : imageTransform(startTransform, mirrored),
                transitionDuration: `${slideDurationMs}ms, ${fadeDurationMs}ms`,
                transitionProperty: 'transform, opacity',
                transitionTimingFunction:
                    'cubic-bezier(0.16, 1, 0.3, 1), ease-out',
                width: toolImageWidthStyle(widthPercent),
            }}
        />
    );
}

type ToolGrantConfig = {
    alreadyOwned: boolean;
    backgroundDark: string | null;
    backgroundLight: string | null;
    backgroundMirrored: boolean;
    bubbleBorderColorDark: string;
    bubbleBorderColorLight: string;
    bubbleColorDark: string;
    bubbleColorLight: string;
    bubbleOpacityDark: number;
    bubbleOpacityLight: number;
    fadeDurationSeconds: number;
    slideDirection: string;
    slideDurationSeconds: number;
    text: string;
    tool: LearnerTool | null;
    toolMirrored: boolean;
    toolX: number;
    toolY: number;
    typingSpeed: number;
};

function toolGrantConfig(value: Record<string, unknown>): ToolGrantConfig {
    return {
        alreadyOwned: value.alreadyOwned === true,
        backgroundDark: stringOrNull(value.backgroundDark),
        backgroundLight: stringOrNull(value.backgroundLight),
        backgroundMirrored: value.backgroundMirrored === true,
        bubbleBorderColorDark: stringOr(value.bubbleBorderColorDark, '#2dd4bf'),
        bubbleBorderColorLight: stringOr(
            value.bubbleBorderColorLight,
            '#0891b2',
        ),
        bubbleColorDark: stringOr(value.bubbleColorDark, '#0f172a'),
        bubbleColorLight: stringOr(value.bubbleColorLight, '#ffffff'),
        bubbleOpacityDark: numberOr(value.bubbleOpacityDark, 92),
        bubbleOpacityLight: numberOr(value.bubbleOpacityLight, 94),
        fadeDurationSeconds: numberOr(value.fadeDurationSeconds, 0.4),
        slideDirection: stringOr(value.slideDirection, 'left'),
        slideDurationSeconds: numberOr(value.slideDurationSeconds, 0.6),
        text: stringOr(value.text, ''),
        tool: learnerTool(value.tool),
        toolMirrored: value.toolMirrored === true,
        toolX: numberOr(value.toolX, 50),
        toolY: numberOr(value.toolY, 50),
        typingSpeed: numberOr(value.typingSpeed, 24),
    };
}

function learnerTool(value: unknown): LearnerTool | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<LearnerTool>;
    return typeof candidate.slug === 'string' &&
        typeof candidate.title === 'string'
        ? (candidate as LearnerTool)
        : null;
}

function activityBubbleStyle(
    config: ToolGrantConfig,
    appearance: OriginalAppearance,
): CSSProperties {
    const isLight = appearance === 'light';
    const opacity = isLight
        ? config.bubbleOpacityLight
        : config.bubbleOpacityDark;
    return {
        backgroundColor: colorWithOpacity(
            isLight ? config.bubbleColorLight : config.bubbleColorDark,
            opacity,
        ),
        borderColor: isLight
            ? config.bubbleBorderColorLight
            : config.bubbleBorderColorDark,
    };
}

function TypingText({ speed, text }: { speed: number; text: string }) {
    const [visibleText, setVisibleText] = useState('');
    useEffect(() => {
        if (!text) {
            setVisibleText('');
            return;
        }
        let index = 0;
        const timer = window.setInterval(
            () => {
                index += 1;
                setVisibleText(text.slice(0, index));
                if (index >= text.length) window.clearInterval(timer);
            },
            Math.max(1, speed),
        );
        return () => window.clearInterval(timer);
    }, [speed, text]);
    return <p className="min-h-12 text-sm leading-6">{visibleText}</p>;
}

function themedAsset(
    dark: string | null,
    light: string | null,
    appearance: OriginalAppearance,
): string {
    return appearance === 'light' ? light || dark || '' : dark || light || '';
}

function toolImageWidthPercent(tool: LearnerTool | null): number {
    const value = tool?.config.imageWidthPercent;
    return Math.min(100, Math.max(1, numberOr(value, 16)));
}

function toolImageWidthStyle(widthPercent: number): string {
    return `clamp(2rem, ${widthPercent}vw, 90vw)`;
}

function entranceTransform(direction: string): string {
    const transforms: Record<string, string> = {
        bottom: 'translate(-50%, calc(-50% + 5rem))',
        left: 'translate(calc(-50% - 5rem), -50%)',
        none: 'translate(-50%, -50%)',
        right: 'translate(calc(-50% + 5rem), -50%)',
        top: 'translate(-50%, calc(-50% - 5rem))',
    };
    return transforms[direction] ?? transforms.left;
}

function imageTransform(baseTransform: string, mirrored: boolean): string {
    return mirrored ? `${baseTransform} scaleX(-1)` : baseTransform;
}

function colorWithOpacity(color: string, opacity: number): string {
    const normalized = Math.min(100, Math.max(0, opacity)) / 100;
    return `${color}${Math.round(normalized * 255)
        .toString(16)
        .padStart(2, '0')}`;
}

function stringOr(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : fallback;
}
