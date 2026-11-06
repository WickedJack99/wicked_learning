import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type LearnerPlaybackActivity = components['schemas']['LearnerPlaybackActivity'];
type LearnerPeerMessageWall = components['schemas']['LearnerPeerMessageWall'];
type LearnerPeerMessage = components['schemas']['LearnerPeerMessage'];
type ResponseType = NonNullable<
    components['schemas']['SubmitLearnerPeerResponse']['response_type']
>;

/**
 * Adapted from the source `MessageWallActivity`. The Rust API owns topic
 * binding, visibility, anonymous response eligibility and helpfulness; this
 * component retains the original activity's presentation and local controls.
 */
export function OriginalPeerMessageWall({
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
        messageAllowResponses?: unknown;
        messageResponsePrompt?: unknown;
        messageUi?: unknown;
    };
    const theme = useMessageTheme(config.messageUi, appearance);
    const allowResponses = config.messageAllowResponses === true;
    const responsePrompt =
        typeof config.messageResponsePrompt === 'string'
            ? config.messageResponsePrompt
            : '';
    const [state, setState] = useState<LearnerPeerMessageWall | null>(null);
    const [closing, setClosing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
    const [responseBody, setResponseBody] = useState('');
    const [responseType, setResponseType] =
        useState<ResponseType>('explanation');
    const [responseError, setResponseError] = useState('');
    const [helpfulError, setHelpfulError] = useState('');
    const [helpfulErrorMessageId, setHelpfulErrorMessageId] = useState<
        string | null
    >(null);
    const [markingHelpfulResponseId, setMarkingHelpfulResponseId] = useState<
        string | null
    >(null);
    const [responding, setResponding] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(() =>
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 639px)').matches
            ? 3
            : 10,
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 639px)');
        const updatePageSize = () => {
            setLoading(true);
            setPageSize(mediaQuery.matches ? 3 : 10);
            setPage(1);
        };
        mediaQuery.addEventListener('change', updatePageSize);

        return () => mediaQuery.removeEventListener('change', updatePageSize);
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        void apiClient
            .GET('/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall', {
                params: {
                    path: {
                        activity_slug: activity.slug,
                        play_run_id: playRunId,
                    },
                    query: { page, per_page: pageSize },
                },
            })
            .then(({ data, response }) => {
                if (!active) return;
                setState(response.ok && data ? data : null);
            })
            .catch(() => active && setState(null))
            .finally(() => active && setLoading(false));

        return () => {
            active = false;
        };
    }, [activity.slug, page, pageSize, playRunId]);

    async function refreshWall(): Promise<void> {
        const { data, response } = await apiClient.GET(
            '/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall',
            {
                params: {
                    path: {
                        activity_slug: activity.slug,
                        play_run_id: playRunId,
                    },
                    query: { page, per_page: pageSize },
                },
            },
        );
        if (!response.ok || !data) throw new Error('peer wall unavailable');
        setState(data);
    }

    async function close(): Promise<void> {
        setClosing(true);
        try {
            await onComplete();
        } finally {
            setClosing(false);
        }
    }

    async function submitResponse(messageId: string): Promise<void> {
        if (responseBody.trim().length < 2) {
            setResponseError('Write at least two characters.');
            return;
        }
        setResponding(true);
        setResponseError('');
        setHelpfulError('');
        setHelpfulErrorMessageId(null);
        try {
            const csrfToken = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall/messages/{message_id}/responses',
                {
                    body: {
                        body: responseBody.trim(),
                        response_type: responseType,
                    },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: {
                            activity_slug: activity.slug,
                            message_id: messageId,
                            play_run_id: playRunId,
                        },
                    },
                },
            );
            if (!response.ok) throw new Error('peer response was rejected');
            await refreshWall();
            setActiveMessageId(null);
            setResponseBody('');
            setResponseType('explanation');
        } catch {
            setResponseError('Your response could not be saved yet.');
        } finally {
            setResponding(false);
        }
    }

    async function markHelpful(
        messageId: string,
        responseId: string,
        helpful: boolean,
    ): Promise<void> {
        setMarkingHelpfulResponseId(responseId);
        setHelpfulError('');
        setHelpfulErrorMessageId(null);
        try {
            const csrfToken = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/learner/play-runs/{play_run_id}/activities/{activity_slug}/peer-wall/messages/{message_id}/responses/{response_id}/helpfulness',
                {
                    body: { helpful },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: {
                            activity_slug: activity.slug,
                            message_id: messageId,
                            play_run_id: playRunId,
                            response_id: responseId,
                        },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('helpfulness was rejected');
            setState((current) =>
                current === null
                    ? current
                    : {
                          ...current,
                          messages: current.messages.map((message) =>
                              message.id !== messageId
                                  ? message
                                  : {
                                        ...message,
                                        responses: message.responses.map(
                                            (item) => ({
                                                ...item,
                                                is_helpful:
                                                    item.id === responseId
                                                        ? data.helpful
                                                        : false,
                                            }),
                                        ),
                                    },
                          ),
                      },
            );
        } catch {
            setHelpfulError('The helpful response mark could not be saved yet.');
            setHelpfulErrorMessageId(messageId);
        } finally {
            setMarkingHelpfulResponseId(null);
        }
    }

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
                    {state?.topic_title ?? 'Learner messages'}
                </p>
                <p className="mt-1 text-sm opacity-75">
                    Thoughts shared by learners who explored this topic.
                </p>
            </div>
            <button
                aria-label="Close message wall"
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
                    <p className="text-sm opacity-75">Loading messages...</p>
                </div>
            ) : messages.length === 0 ? (
                <div className="grid h-full min-h-[28rem] place-items-center p-8 text-center">
                    <p className="max-w-sm text-sm leading-6 opacity-75">
                        No learner messages are visible for this topic yet.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3 px-4 pt-24 pb-16 sm:hidden">
                        {messages.map((message) => (
                            <MessageCard
                                activeMessageId={activeMessageId}
                                allowResponses={allowResponses}
                                helpfulError={helpfulError}
                                helpfulErrorMessageId={helpfulErrorMessageId}
                                key={message.id}
                                markingHelpfulResponseId={markingHelpfulResponseId}
                                message={message}
                                onMarkHelpful={(messageId, responseId, helpful) =>
                                    void markHelpful(messageId, responseId, helpful)
                                }
                                onSubmitResponse={(messageId) =>
                                    void submitResponse(messageId)
                                }
                                onToggleResponse={(messageId) => {
                                    setActiveMessageId((current) =>
                                        current === messageId ? null : messageId,
                                    );
                                    setResponseBody('');
                                    setResponseType('explanation');
                                    setResponseError('');
                                }}
                                responding={responding}
                                responseBody={responseBody}
                                responseError={responseError}
                                responsePrompt={responsePrompt}
                                responseType={responseType}
                                setResponseBody={setResponseBody}
                                setResponseType={setResponseType}
                                theme={theme}
                            />
                        ))}
                    </div>
                    <div className="hidden h-full min-h-[28rem] sm:block">
                        {messages.map((message, index) => (
                            <div
                                className="absolute w-[min(17rem,32%)]"
                                key={message.id}
                                style={cardPosition(index)}
                            >
                                <MessageCard
                                    activeMessageId={activeMessageId}
                                    allowResponses={allowResponses}
                                    helpfulError={helpfulError}
                                    helpfulErrorMessageId={helpfulErrorMessageId}
                                    markingHelpfulResponseId={markingHelpfulResponseId}
                                    message={message}
                                    onMarkHelpful={(messageId, responseId, helpful) =>
                                        void markHelpful(messageId, responseId, helpful)
                                    }
                                    onSubmitResponse={(messageId) =>
                                        void submitResponse(messageId)
                                    }
                                    onToggleResponse={(messageId) => {
                                        setActiveMessageId((current) =>
                                            current === messageId
                                                ? null
                                                : messageId,
                                        );
                                        setResponseBody('');
                                        setResponseType('explanation');
                                        setResponseError('');
                                    }}
                                    responding={responding}
                                    responseBody={responseBody}
                                    responseError={responseError}
                                    responsePrompt={responsePrompt}
                                    responseType={responseType}
                                    setResponseBody={setResponseBody}
                                    setResponseType={setResponseType}
                                    theme={theme}
                                />
                            </div>
                        ))}
                    </div>
                    {state && state.pagination.last_page > 1 ? (
                        <nav
                            aria-label="Message pages"
                            className="absolute right-4 bottom-3 left-4 z-30 flex items-center justify-between rounded-lg px-2 py-1 text-xs"
                            style={{ backgroundColor: theme.card }}
                        >
                            <button
                                className="min-h-8 rounded-lg border px-2 disabled:opacity-40"
                                disabled={state.pagination.current_page === 1}
                                onClick={() => setPage((current) => current - 1)}
                                style={{ borderColor: theme.border }}
                                type="button"
                            >
                                Previous
                            </button>
                            <span>{`${state.pagination.current_page} / ${state.pagination.last_page}`}</span>
                            <button
                                className="min-h-8 rounded-lg border px-2 disabled:opacity-40"
                                disabled={
                                    state.pagination.current_page ===
                                    state.pagination.last_page
                                }
                                onClick={() => setPage((current) => current + 1)}
                                style={{ borderColor: theme.border }}
                                type="button"
                            >
                                Next
                            </button>
                        </nav>
                    ) : null}
                </>
            )}
        </div>
    );
}

function MessageCard({
    activeMessageId,
    allowResponses,
    helpfulError,
    helpfulErrorMessageId,
    markingHelpfulResponseId,
    message,
    onMarkHelpful,
    onSubmitResponse,
    onToggleResponse,
    responding,
    responseBody,
    responseError,
    responsePrompt,
    responseType,
    setResponseBody,
    setResponseType,
    theme,
}: {
    activeMessageId: string | null;
    allowResponses: boolean;
    helpfulError: string;
    helpfulErrorMessageId: string | null;
    markingHelpfulResponseId: string | null;
    message: LearnerPeerMessage;
    onMarkHelpful: (messageId: string, responseId: string, helpful: boolean) => void;
    onSubmitResponse: (messageId: string) => void;
    onToggleResponse: (messageId: string) => void;
    responding: boolean;
    responseBody: string;
    responseError: string;
    responsePrompt: string;
    responseType: ResponseType;
    setResponseBody: (value: string) => void;
    setResponseType: (value: ResponseType) => void;
    theme: MessageTheme;
}) {
    const isResponding = activeMessageId === message.id;
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
            {message.responses.length > 0 ? (
                <div
                    className="mt-4 grid gap-2 border-t pt-3 text-sm opacity-85"
                    style={{ borderColor: theme.border }}
                >
                    {message.responses.map((response) => (
                        <div className="grid gap-1" key={response.id}>
                            {response.response_type ? (
                                <p className="mb-1 text-xs font-semibold tracking-wide uppercase opacity-70">
                                    {responseKind(response.response_type)}
                                </p>
                            ) : null}
                            <p>{response.body}</p>
                            {response.is_helpful ? (
                                <p className="flex items-center gap-1 text-xs font-semibold opacity-80">
                                    <Check className="size-3.5" />
                                    The learner marked this response helpful.
                                </p>
                            ) : null}
                            {response.can_mark_helpful ? (
                                <button
                                    className="w-fit text-xs font-medium underline-offset-4 hover:underline disabled:opacity-50"
                                    disabled={markingHelpfulResponseId !== null}
                                    onClick={() =>
                                        onMarkHelpful(
                                            message.id,
                                            response.id,
                                            !response.is_helpful,
                                        )
                                    }
                                    type="button"
                                >
                                    {markingHelpfulResponseId === response.id
                                        ? 'Saving...'
                                        : response.is_helpful
                                          ? 'Clear helpful mark'
                                          : 'This helped me'}
                                </button>
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : null}
            {helpfulError && helpfulErrorMessageId === message.id ? (
                <p className="mt-2 text-xs text-red-300" role="alert">
                    {helpfulError}
                </p>
            ) : null}
            {allowResponses && message.can_respond ? (
                <div
                    className="mt-4 border-t pt-3"
                    style={{ borderColor: theme.border }}
                >
                    {message.has_responded ? (
                        <p className="text-xs opacity-75">
                            You responded to this message.
                        </p>
                    ) : (
                        <>
                            <button
                                className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                                onClick={() => onToggleResponse(message.id)}
                                style={{ borderColor: theme.border }}
                                type="button"
                            >
                                {isResponding ? 'Close response' : 'Respond'}
                            </button>
                            {isResponding ? (
                                <div className="mt-3 grid gap-2">
                                    {responsePrompt ? (
                                        <p className="text-xs leading-5 opacity-80">
                                            <span className="font-semibold">
                                                Response guidance:{' '}
                                            </span>
                                            {responsePrompt}
                                        </p>
                                    ) : null}
                                    <label
                                        className="grid gap-1 text-xs font-semibold"
                                        htmlFor={`response-type-${message.id}`}
                                    >
                                        What kind of help would you like to offer?
                                        <span className="font-normal opacity-75">
                                            Choose a shape for your response; it is not a grade.
                                        </span>
                                    </label>
                                    <select
                                        className="min-h-11 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2"
                                        id={`response-type-${message.id}`}
                                        onChange={(event) =>
                                            setResponseType(
                                                event.target.value as ResponseType,
                                            )
                                        }
                                        style={{ borderColor: theme.border }}
                                        value={responseType}
                                    >
                                        <option value="explanation">Explain an idea</option>
                                        <option value="example">Share an example</option>
                                        <option value="question">Ask a question</option>
                                        <option value="counterexample">
                                            Offer a counterexample
                                        </option>
                                    </select>
                                    <textarea
                                        aria-label="Your response"
                                        className="min-h-20 w-full rounded-lg border bg-transparent p-2 text-sm outline-none focus:ring-2"
                                        maxLength={280}
                                        onChange={(event) =>
                                            setResponseBody(event.target.value)
                                        }
                                        placeholder="Add a thoughtful response..."
                                        style={{ borderColor: theme.border }}
                                        value={responseBody}
                                    />
                                    {responseError ? (
                                        <p className="text-xs text-red-300">
                                            {responseError}
                                        </p>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            className="rounded-md px-3 py-1.5 text-xs font-medium"
                                            disabled={responding}
                                            onClick={() => onSubmitResponse(message.id)}
                                            style={{
                                                backgroundColor: theme.accent,
                                                color: theme.buttonText,
                                            }}
                                            type="button"
                                        >
                                            Send response
                                        </button>
                                        <button
                                            className="rounded-md px-3 py-1.5 text-xs font-medium"
                                            disabled={responding}
                                            onClick={() => onToggleResponse(message.id)}
                                            type="button"
                                        >
                                            Not now
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}
                </div>
            ) : null}
        </article>
    );
}

type MessageTheme = {
    accent: string;
    border: string;
    buttonText: string;
    card: string;
    surface: string;
    text: string;
};

function useMessageTheme(value: unknown, appearance: OriginalAppearance): MessageTheme {
    return useMemo(() => {
        const config = isRecord(value) ? value : {};
        const light = appearance === 'light';
        return {
            accent: color(
                config[light ? 'accentColorLight' : 'accentColorDark'],
                light ? '#0f766e' : '#5eead4',
            ),
            border: light ? '#cbd5e1' : 'rgba(255, 255, 255, 0.16)',
            buttonText: light ? '#ffffff' : '#071018',
            card: color(
                config[light ? 'cardColorLight' : 'cardColorDark'],
                light ? '#ffffff' : '#13262d',
            ),
            surface: color(
                config[light ? 'surfaceColorLight' : 'surfaceColorDark'],
                light ? '#e6f5f2' : '#071018',
            ),
            text: light ? '#0f172a' : '#f1f5f9',
        };
    }, [appearance, value]);
}

function responseKind(responseType: ResponseType): string {
    switch (responseType) {
        case 'explanation':
            return 'Explained an idea';
        case 'example':
            return 'Shared an example';
        case 'question':
            return 'Asked a question';
        case 'counterexample':
            return 'Offered a counterexample';
    }
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

function color(value: unknown, fallback: string): string {
    return typeof value === 'string' && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)
        ? value
        : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
