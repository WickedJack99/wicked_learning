import { Check, MessageSquareText, Send, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import type { ActivityTransition, LearningActivity } from '@/types';
import { getJson, postJson } from './api';

type MessageResponse = {
    hasContributed: boolean;
    messages: Array<{ body: string; id: number }>;
    topic: { id: number; title: string };
};

type ActivityFlowProps = {
    activity: LearningActivity;
    onComplete: (activity: LearningActivity) => Promise<void>;
    onMoveToActivity: (activityId: number | null) => void;
    transition: ActivityTransition | null;
};

export function MessagePromptActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: ActivityFlowProps) {
    const t = usePlatformTranslation();
    const theme = useMessageTheme(activity);
    const isSupportRequest = activity.config.messageAudience === 'support';
    const [state, setState] = useState<MessageResponse | null>(null);
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        getJson<MessageResponse>(
            `/learning/activities/${activity.id}/messages`,
            controller.signal,
        )
            .then(setState)
            .catch(() => {
                if (!controller.signal.aborted) {
                    setError(
                        t(
                            'activities.messages.load_error',
                            'The message topic could not be loaded.',
                        ),
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [activity.id, t]);

    const continueRoute = useCallback(async () => {
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    }, [activity, onComplete, onMoveToActivity, transition?.toActivityId]);

    const submit = async () => {
        if (body.trim().length < 2) {
            setError(
                t(
                    'activities.messages.too_short',
                    'Write at least two characters.',
                ),
            );

            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await postJson<MessageResponse>(
                `/learning/activities/${activity.id}/messages`,
                { body: body.trim() },
            );
            setState(response);
            await continueRoute();
        } catch {
            setError(
                t(
                    'activities.messages.save_error',
                    'Your message could not be saved yet.',
                ),
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="grid min-h-0 flex-1 place-items-center rounded-lg border p-4 sm:p-8"
            style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
            }}
        >
            <div
                className="w-full max-w-2xl rounded-xl border p-5 shadow-xl sm:p-7"
                style={{
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                }}
            >
                <div className="flex items-start gap-3">
                    <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border"
                        style={{
                            borderColor: theme.border,
                            color: theme.accent,
                        }}
                    >
                        <MessageSquareText className="size-5" />
                    </span>
                    <div>
                        <p
                            className="text-xs font-semibold tracking-[0.16em] uppercase"
                            style={{ color: theme.accent }}
                        >
                            {state?.topic.title ??
                                t(
                                    'activities.messages.topic',
                                    'Learner messages',
                                )}
                        </p>
                        <p className="mt-2 text-lg leading-7 font-semibold">
                            {messageConfigString(
                                activity,
                                'messagePrompt',
                                t(
                                    'activities.messages.default_prompt',
                                    'Leave a helpful note or an encouraging thought for the next learner.',
                                ),
                            )}
                        </p>
                        <p className="mt-2 text-sm leading-6 opacity-75">
                            {isSupportRequest
                                ? t(
                                      'activities.messages.support_visibility',
                                      'This request is shared with learning support, not the peer message wall.',
                                  )
                                : t(
                                      'activities.messages.peer_visibility',
                                      'You can share this with the peer message wall, or continue without posting.',
                                  )}
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p className="mt-6 text-sm opacity-70">
                        {t(
                            'activities.messages.loading',
                            'Loading messages...',
                        )}
                    </p>
                ) : state?.hasContributed ? (
                    <div className="mt-6">
                        <p className="flex items-center gap-2 text-sm font-medium">
                            <Check
                                className="size-4"
                                style={{ color: theme.accent }}
                            />
                            {t(
                                'activities.messages.already_shared',
                                'You have already contributed to this topic.',
                            )}
                        </p>
                        <Button
                            className="mt-5"
                            onClick={() => void continueRoute()}
                        >
                            {t('activities.messages.continue', 'Continue')}
                        </Button>
                    </div>
                ) : (
                    <div className="mt-6 grid gap-3">
                        <label
                            className="text-sm font-semibold"
                            htmlFor={`learner-message-${activity.id}`}
                        >
                            {messageConfigString(
                                activity,
                                'messageInputLabel',
                                t(
                                    'activities.messages.input_label',
                                    'Your message',
                                ),
                            )}
                        </label>
                        <textarea
                            className="min-h-32 w-full rounded-lg border bg-transparent p-3 text-sm outline-none focus:ring-2"
                            id={`learner-message-${activity.id}`}
                            maxLength={280}
                            onChange={(event) => setBody(event.target.value)}
                            placeholder={t(
                                'activities.messages.placeholder',
                                'A small clue, observation or encouraging thought...',
                            )}
                            style={{ borderColor: theme.border }}
                            value={body}
                        />
                        <div className="flex items-center justify-between gap-3 text-xs opacity-70">
                            <span>{body.length}/280</span>
                            <span>
                                {t(
                                    'activities.messages.moderated',
                                    'Messages can be hidden by learning support.',
                                )}
                            </span>
                        </div>
                        <InputError message={error} />
                        <div className="flex flex-wrap gap-3">
                            <Button
                                disabled={submitting}
                                onClick={() => void submit()}
                                type="button"
                            >
                                <Send className="size-4" />
                                {t(
                                    isSupportRequest
                                        ? 'activities.messages.ask_support'
                                        : 'activities.messages.share',
                                    isSupportRequest
                                        ? 'Ask support and continue'
                                        : 'Share and continue',
                                )}
                            </Button>
                            <Button
                                disabled={submitting}
                                onClick={() => void continueRoute()}
                                type="button"
                                variant="outline"
                            >
                                {t('activities.messages.not_now', 'Not now')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function MessageWallActivity({
    activity,
    onComplete,
    onMoveToActivity,
    transition,
}: ActivityFlowProps) {
    const t = usePlatformTranslation();
    const theme = useMessageTheme(activity);
    const [state, setState] = useState<MessageResponse | null>(null);
    const [closing, setClosing] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        getJson<MessageResponse>(
            `/learning/activities/${activity.id}/messages`,
            controller.signal,
        )
            .then(setState)
            .catch(() => setState(null))
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [activity.id]);

    const close = async () => {
        setClosing(true);
        await onComplete(activity);
        onMoveToActivity(transition?.toActivityId ?? null);
    };
    const messages = state?.messages ?? [];

    return (
        <div
            className="relative min-h-[28rem] flex-1 overflow-hidden rounded-lg border"
            style={{
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text,
            }}
        >
            <div className="absolute top-4 left-4 z-20 max-w-[70%]">
                <p
                    className="text-xs font-semibold tracking-[0.16em] uppercase"
                    style={{ color: theme.accent }}
                >
                    {state?.topic.title ??
                        t('activities.messages.topic', 'Learner messages')}
                </p>
                <p className="mt-1 text-sm opacity-75">
                    {t(
                        'activities.messages.wall_description',
                        'Thoughts shared by learners who explored this topic.',
                    )}
                </p>
            </div>
            <button
                aria-label={t(
                    'activities.messages.close_wall',
                    'Close message wall',
                )}
                className="absolute top-4 right-4 z-30 flex size-10 items-center justify-center rounded-lg border transition hover:scale-105 disabled:opacity-50"
                disabled={closing}
                onClick={() => void close()}
                style={{
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    color: theme.text,
                }}
                type="button"
            >
                <X className="size-5" />
            </button>

            {loading ? (
                <div className="grid h-full min-h-[28rem] place-items-center p-8 text-center">
                    <p className="text-sm opacity-75">
                        {t(
                            'activities.messages.loading',
                            'Loading messages...',
                        )}
                    </p>
                </div>
            ) : messages.length === 0 ? (
                <div className="grid h-full min-h-[28rem] place-items-center p-8 text-center">
                    <p className="max-w-sm text-sm leading-6 opacity-75">
                        {t(
                            'activities.messages.empty_wall',
                            'No learner messages are visible for this topic yet.',
                        )}
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 px-4 pt-24 pb-5 sm:hidden">
                        {messages.slice(0, 6).map((message) => (
                            <MessageCard
                                key={message.id}
                                message={message}
                                theme={theme}
                            />
                        ))}
                    </div>
                    <div className="hidden h-full min-h-[28rem] sm:block">
                        {messages.slice(0, 10).map((message, index) => (
                            <div
                                className="absolute w-[min(17rem,32%)]"
                                key={message.id}
                                style={cardPosition(index)}
                            >
                                <MessageCard message={message} theme={theme} />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function MessageCard({
    message,
    theme,
}: {
    message: { body: string; id: number };
    theme: MessageTheme;
}) {
    return (
        <article
            className="rounded-xl border p-4 text-sm leading-6 shadow-xl"
            style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
            }}
        >
            {message.body}
        </article>
    );
}

type MessageTheme = {
    accent: string;
    border: string;
    card: string;
    surface: string;
    text: string;
};

function useMessageTheme(activity: LearningActivity): MessageTheme {
    const { resolvedAppearance } = useAppearance();

    return useMemo(() => {
        const ui = recordConfig(activity.config.messageUi);
        const dark = resolvedAppearance === 'dark';

        return {
            accent: color(
                ui,
                dark ? 'accentColorDark' : 'accentColorLight',
                dark ? '#5eead4' : '#0f766e',
            ),
            border: color(
                ui,
                dark ? 'cardBorderColorDark' : 'cardBorderColorLight',
                dark ? '#2dd4bf' : '#0f766e',
            ),
            card: color(
                ui,
                dark ? 'cardColorDark' : 'cardColorLight',
                dark ? '#13262d' : '#ffffff',
            ),
            surface: color(
                ui,
                dark ? 'surfaceColorDark' : 'surfaceColorLight',
                dark ? '#071018' : '#e6f5f2',
            ),
            text: color(
                ui,
                dark ? 'textColorDark' : 'textColorLight',
                dark ? '#f1f5f9' : '#0f172a',
            ),
        };
    }, [activity.config.messageUi, resolvedAppearance]);
}

function cardPosition(index: number): CSSProperties {
    const positions = [
        ['8%', '23%', '-3deg'],
        ['38%', '18%', '2deg'],
        ['69%', '25%', '-1deg'],
        ['17%', '55%', '2deg'],
        ['48%', '50%', '-2deg'],
        ['73%', '60%', '3deg'],
        ['5%', '76%', '-1deg'],
        ['38%', '76%', '1deg'],
        ['66%', '78%', '-2deg'],
        ['27%', '36%', '1deg'],
    ];
    const [left, top, rotate] = positions[index % positions.length];

    return { left, top, transform: `rotate(${rotate})` };
}

function messageConfigString(
    activity: LearningActivity,
    key: string,
    fallback: string,
): string {
    const value = activity.config[key];

    return typeof value === 'string' && value.trim() ? value : fallback;
}

function recordConfig(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function color(
    source: Record<string, unknown>,
    key: string,
    fallback: string,
): string {
    const value = source[key];

    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
        ? value
        : fallback;
}
