import { Check, MessageSquareText, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type LearnerPeerMessagePromptState =
    components['schemas']['LearnerPeerMessagePromptState'];

/** Source-adapted from the peer branch of `MessagePromptActivity`. */
export function OriginalPeerMessagePrompt({
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
    const t = usePlatformTranslation();
    const config = activity.config as {
        messageInputLabel?: unknown;
        messagePrompt?: unknown;
        messageUi?: unknown;
    };
    const theme = useMessageTheme(config.messageUi, appearance);
    const prompt =
        typeof config.messagePrompt === 'string'
            ? config.messagePrompt
            : t(
                  'activities.messages.default_prompt',
                  'Leave a helpful note or an encouraging thought for the next learner.',
              );
    const inputLabel =
        typeof config.messageInputLabel === 'string'
            ? config.messageInputLabel
            : t('activities.messages.input_label', 'Your message');
    const [state, setState] = useState<LearnerPeerMessagePromptState | null>(null);
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-message', {
                params: {
                    path: {
                        activity_slug: activity.slug,
                        play_run_id: playRunId,
                    },
                },
            })
            .then(({ data, response }) => {
                if (!active) return;
                if (!response.ok || !data) {
                    setError(
                        t(
                            'activities.messages.load_error',
                            'The message topic could not be loaded.',
                        ),
                    );
                    return;
                }
                setState(data);
            })
            .catch(() =>
                active &&
                setError(
                    t(
                        'activities.messages.load_error',
                        'The message topic could not be loaded.',
                    ),
                ),
            )
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [activity.slug, playRunId, t]);

    async function submit(): Promise<void> {
        const message = body.trim();
        if (message.length < 2) {
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
            const csrfToken = await getCsrfToken();
            const result = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-message',
                {
                    body: { body: message },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (!result.response.ok || !result.data) {
                throw new Error('peer message was rejected');
            }
            setState(result.data);
            await onComplete();
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
    }

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
                style={{ backgroundColor: theme.card, borderColor: theme.border }}
            >
                <div className="flex items-start gap-3">
                    <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg border"
                        style={{ borderColor: theme.border, color: theme.accent }}
                    >
                        <MessageSquareText className="size-5" />
                    </span>
                    <div>
                        <p
                            className="text-xs font-semibold tracking-[0.16em] uppercase"
                            style={{ color: theme.accent }}
                        >
                            {state?.topic_title ??
                                t('activities.messages.topic', 'Learner messages')}
                        </p>
                        <p className="mt-2 text-lg leading-7 font-semibold">{prompt}</p>
                        <p className="mt-2 text-sm leading-6 opacity-75">
                            {t(
                                'activities.messages.peer_visibility',
                                'You can share this with the peer message wall, or continue without posting.',
                            )}
                        </p>
                    </div>
                </div>
                {loading ? (
                    <p className="mt-6 text-sm opacity-70">
                        {t('activities.messages.loading', 'Loading messages...')}
                    </p>
                ) : state?.has_contributed ? (
                    <div className="mt-6">
                        <p className="flex items-center gap-2 text-sm font-medium">
                            <Check className="size-4" style={{ color: theme.accent }} />
                            {t(
                                'activities.messages.already_shared',
                                'You have already contributed to this topic.',
                            )}
                        </p>
                        <button
                            className="mt-5 rounded-md px-4 py-2 text-sm font-medium transition hover:brightness-110 disabled:opacity-50"
                            disabled={submitting}
                            onClick={() => void onComplete()}
                            style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                            type="button"
                        >
                            {t('activities.messages.continue', 'Continue')}
                        </button>
                    </div>
                ) : (
                    <div className="mt-6 grid gap-3">
                        <label className="grid gap-2 text-sm font-medium" htmlFor="peer-message-body">
                            {inputLabel}
                            <textarea
                                className="min-h-28 rounded-lg border bg-transparent p-3 text-sm leading-6 outline-none focus:ring-2"
                                id="peer-message-body"
                                maxLength={280}
                                onChange={(event) => setBody(event.target.value)}
                                placeholder={t(
                                    'activities.messages.placeholder',
                                    'A small clue, observation or encouraging thought...',
                                )}
                                style={{ borderColor: theme.border }}
                                value={body}
                            />
                        </label>
                        <div className="flex items-center justify-between text-xs opacity-70">
                            <span>{`${body.length}/280`}</span>
                            <span>
                                {t(
                                    'activities.messages.moderated',
                                    'Messages can be hidden by learning support.',
                                )}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                className="inline-flex w-fit items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:brightness-110 disabled:opacity-50"
                                disabled={submitting}
                                onClick={() => void submit()}
                                style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                                type="button"
                            >
                                <Send className="size-4" />
                                {t(
                                    'activities.messages.share',
                                    'Share and continue',
                                )}
                            </button>
                            <button
                                className="rounded-md px-4 py-2 text-sm font-medium"
                                disabled={submitting}
                                onClick={() => void onComplete()}
                                type="button"
                            >
                                {t('activities.messages.not_now', 'Not now')}
                            </button>
                        </div>
                    </div>
                )}
                {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
            </div>
        </div>
    );
}

function useMessageTheme(value: unknown, appearance: OriginalAppearance) {
    return useMemo(() => {
        const config = isRecord(value) ? value : {};
        const light = appearance === 'light';
        return {
            accent: color(config[light ? 'accentColorLight' : 'accentColorDark'], light ? '#0f766e' : '#5eead4'),
            border: light ? '#cbd5e1' : 'rgba(255, 255, 255, 0.16)',
            buttonText: light ? '#ffffff' : '#071018',
            card: color(config[light ? 'cardColorLight' : 'cardColorDark'], light ? '#ffffff' : '#13262d'),
            surface: color(config[light ? 'surfaceColorLight' : 'surfaceColorDark'], light ? '#e6f5f2' : '#071018'),
            text: light ? '#0f172a' : '#f1f5f9',
        };
    }, [appearance, value]);
}

function color(value: unknown, fallback: string): string {
    return typeof value === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)
        ? value
        : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
