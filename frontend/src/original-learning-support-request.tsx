import { Check, MessageSquareText, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type LearnerSupportRequestState =
    components['schemas']['LearnerSupportRequestState'];

/**
 * Adapted directly from the source MessagePromptActivity support branch. The
 * Rust contract owns the topic, audience, request identity and reply privacy;
 * this component only presents the source prompt and submits its short body.
 */
export function OriginalLearningSupportRequest({
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
    const config = activity.config as {
        messageInputLabel?: unknown;
        messagePrompt?: unknown;
        messageUi?: unknown;
    };
    const theme = useMessageTheme(config.messageUi, appearance);
    const prompt = typeof config.messagePrompt === 'string'
        ? config.messagePrompt
        : 'Leave a helpful note or an encouraging thought for the next learner.';
    const inputLabel = typeof config.messageInputLabel === 'string'
        ? config.messageInputLabel
        : 'Your message';
    const [state, setState] = useState<LearnerSupportRequestState | null>(null);
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/support-request', {
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
                    setError('The message topic could not be loaded.');
                    return;
                }
                setState(data);
            })
            .catch(() => active && setError('The message topic could not be loaded.'))
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [activity.slug, playRunId]);

    async function submit(): Promise<void> {
        const request = body.trim();
        if (request.length < 2) {
            setError('Write at least two characters.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const csrfToken = await getCsrfToken();
            const response = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/support-request',
                {
                    body: { body: request },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: {
                            activity_slug: activity.slug,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (!response.response.ok || !response.data) {
                throw new Error('support request was rejected');
            }
            setState(response.data);
            await onComplete();
        } catch {
            setError('Your message could not be saved yet.');
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
                            {state?.topic_title ?? 'Learning Support'}
                        </p>
                        <p className="mt-2 text-lg leading-7 font-semibold">{prompt}</p>
                        <p className="mt-2 text-sm leading-6 opacity-75">
                            This request is shared with Learning Support, not the peer message wall.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <p className="mt-6 text-sm opacity-70">Loading messages...</p>
                ) : state?.has_contributed ? (
                    <div className="mt-6">
                        <p className="flex items-center gap-2 text-sm font-medium">
                            <Check className="size-4" style={{ color: theme.accent }} />
                            You have already contributed to this topic.
                        </p>
                        {state.message?.responses.length ? (
                            <div
                                className="mt-5 grid gap-2 rounded-lg border p-3"
                                style={{
                                    backgroundColor: theme.surface,
                                    borderColor: theme.border,
                                }}
                            >
                                <p
                                    className="text-xs font-semibold tracking-[0.12em] uppercase"
                                    style={{ color: theme.accent }}
                                >
                                    Learning Support response
                                </p>
                                <div className="grid gap-3">
                                    {state.message.responses.map((response) => (
                                        <p className="text-sm leading-6" key={response.id}>
                                            {response.body}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="mt-4 text-sm leading-6 opacity-75">
                                Your request is with Learning Support. You can return here to check for a response.
                            </p>
                        )}
                        <button
                            className="mt-5 rounded-md px-4 py-2 text-sm font-medium transition hover:brightness-110 disabled:opacity-50"
                            disabled={submitting}
                            onClick={() => void onComplete()}
                            style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                            type="button"
                        >
                            Continue
                        </button>
                    </div>
                ) : (
                    <div className="mt-6 grid gap-3">
                        <label className="grid gap-2 text-sm font-medium" htmlFor="support-request-body">
                            {inputLabel}
                            <textarea
                                className="min-h-28 rounded-lg border bg-transparent p-3 text-sm leading-6 outline-none focus:ring-2"
                                id="support-request-body"
                                maxLength={280}
                                onChange={(event) => setBody(event.target.value)}
                                style={{ borderColor: theme.border }}
                                value={body}
                            />
                        </label>
                        <p className="text-xs opacity-70">{`${body.trim().length} / 280`}</p>
                        <button
                            className="inline-flex w-fit items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition hover:brightness-110 disabled:opacity-50"
                            disabled={submitting || body.trim().length < 2}
                            onClick={() => void submit()}
                            style={{ backgroundColor: theme.accent, color: theme.buttonText }}
                            type="button"
                        >
                            <Send className="size-4" />
                            {submitting ? 'Sending…' : 'Send request'}
                        </button>
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
            card: color(config[light ? 'cardColorLight' : 'cardColorDark'], light ? '#ffffff' : '#101827'),
            surface: color(config[light ? 'surfaceColorLight' : 'surfaceColorDark'], light ? '#eff6ff' : '#071018'),
            text: light ? '#0f172a' : '#e2e8f0',
        } satisfies Record<string, string>;
    }, [appearance, value]);
}

function color(value: unknown, fallback: string): string {
    return typeof value === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)
        ? value
        : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
