import {
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    MessageSquareText,
    Trash2,
} from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import {
    SettingsNestedWorkspace,
    SettingsSectionNavigation,
    type SettingsNavigationItem,
} from './extracted-settings-configuration-shell';
import { LearningSupportWorkspace } from './extracted-learning-support-navigation';
import { settingsSections } from './extracted-settings-navigation';
import {
    SettingsSidebarNavigation,
    SettingsTopBar,
} from './extracted-settings-sidebar-navigation';
import { SettingsCornerNavigation } from './extracted-settings-corner-navigation';
import type { OriginalAppearance } from './original-appearance';
import { usePlatformTranslation } from './original-platform-translation';

type Topic = components['schemas']['LearningSupportTopic'];
type ModerationPage = components['schemas']['LearningSupportModerationPage'];
type ModerationMessage =
    components['schemas']['LearningSupportModerationMessage'];
type SupportReply = components['schemas']['LearningSupportModerationReply'];
type ResponseFilter = 'all' | 'helpful' | 'unconfirmed';

/**
 * Source-adapted from `learner-message-moderation-panel.tsx`. The existing
 * Settings shell is lifted from the Laravel React source; only Inertia
 * transport and source database IDs are adapted to typed Rust API seams.
 */
export function OriginalLearningSupportModerationPage({
    appearance,
    onSignedOut,
    settingsAccess,
}: {
    appearance: OriginalAppearance;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    const t = usePlatformTranslation();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const [page, setPage] = useState<ModerationPage | null>(null);
    const [loadingTopics, setLoadingTopics] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [error, setError] = useState('');
    const [replyingMessageId, setReplyingMessageId] = useState<string | null>(
        null,
    );
    const [replyBody, setReplyBody] = useState('');
    const [submittingReply, setSubmittingReply] = useState(false);
    const [actionError, setActionError] = useState('');
    const [responseFilter, setResponseFilter] = useState<ResponseFilter>('all');
    const [settingsMenuQuery, setSettingsMenuQuery] = useState('');
    const accessCapabilities = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(settingsAccess).map(([key, read]) => [
                    key,
                    { delete: false, read, update: false },
                ]),
            ),
        [settingsAccess],
    );
    const navigationSections = useMemo(
        () => settingsSections(t, accessCapabilities, true, settingsMenuQuery),
        [accessCapabilities, settingsMenuQuery, t],
    );

    useEffect(() => {
        let active = true;

        void apiClient
            .GET('/learning-support/topics')
            .then(({ data, response }) => {
                if (!active) {
                    return;
                }
                if (!response.ok || !data) {
                    setError(
                        'Learning Support moderation is temporarily unavailable.',
                    );
                    return;
                }
                setTopics(data);
                setSelectedTopicId(data[0]?.id ?? null);
            })
            .catch(() => {
                if (active) {
                    setError(
                        'Learning Support moderation is temporarily unavailable.',
                    );
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingTopics(false);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    async function loadMessages(
        topicId: string,
        requestedPage: number,
        filter: ResponseFilter = responseFilter,
    ): Promise<void> {
        setLoadingRequests(true);
        setError('');
        setActionError('');

        try {
            const { data, response } = await apiClient.GET(
                '/learning-support/topics/{topic_id}/messages',
                {
                    params: {
                        path: { topic_id: topicId },
                        query: { filter, page: requestedPage, per_page: 6 },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('messages unavailable');
            }
            setPage(data);
        } catch {
            setPage(null);
            setError('The selected message topic could not be loaded.');
        } finally {
            setLoadingRequests(false);
        }
    }

    useEffect(() => {
        if (selectedTopicId) {
            void loadMessages(selectedTopicId, 1);
        } else {
            setPage(null);
        }
    }, [responseFilter, selectedTopicId]);

    async function refresh(): Promise<void> {
        if (selectedTopicId) {
            await loadMessages(
                selectedTopicId,
                page?.pagination.current_page ?? 1,
            );
        }
    }

    async function loadResponses(
        messageId: string,
        requestedPage: number,
    ): Promise<void> {
        setActionError('');
        try {
            const { data, response } = await apiClient.GET(
                '/learning-support/messages/{message_id}/responses',
                {
                    params: {
                        path: { message_id: messageId },
                        query: { page: requestedPage },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('responses unavailable');
            }
            setPage((current) =>
                current === null
                    ? current
                    : {
                          ...current,
                          messages: current.messages.map((message) =>
                              message.id === messageId
                                  ? {
                                        ...message,
                                        response_pagination: data.pagination,
                                        responses: data.responses,
                                    }
                                  : message,
                          ),
                      },
            );
        } catch {
            setActionError('The message responses could not be loaded.');
        }
    }

    async function saveReply(messageId: string): Promise<void> {
        const body = replyBody.trim();
        if (body.length < 2) {
            setActionError('Write at least two characters.');
            return;
        }

        setSubmittingReply(true);
        setActionError('');
        try {
            const csrfToken = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/learning-support/messages/{message_id}/responses',
                {
                    body: { body },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: { message_id: messageId },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('reply unavailable');
            }
            setReplyingMessageId(null);
            setReplyBody('');
            await refresh();
        } catch {
            setActionError('The private reply could not be saved yet.');
        } finally {
            setSubmittingReply(false);
        }
    }

    async function setRequestVisibility(
        message: ModerationMessage,
    ): Promise<void> {
        await mutate(async (csrfToken) =>
            apiClient.PATCH(
                '/learning-support/messages/{message_id}/visibility',
                {
                    body: { hidden: message.hidden_at === null },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: { message_id: message.id },
                    },
                },
            ),
        );
    }

    async function setReplyVisibility(reply: SupportReply): Promise<void> {
        await mutate(async (csrfToken) =>
            apiClient.PATCH(
                '/learning-support/responses/{response_id}/visibility',
                {
                    body: { hidden: reply.hidden_at === null },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: { response_id: reply.id },
                    },
                },
            ),
        );
    }

    async function deleteRequest(message: ModerationMessage): Promise<void> {
        if (!window.confirm('Permanently delete this learner message?')) {
            return;
        }
        await mutate(async (csrfToken) =>
            apiClient.DELETE('/learning-support/messages/{message_id}', {
                params: {
                    header: { 'X-CSRF-Token': csrfToken },
                    path: { message_id: message.id },
                },
            }),
        );
    }

    async function deleteReply(reply: SupportReply): Promise<void> {
        if (!window.confirm('Permanently delete this learner response?')) {
            return;
        }
        await mutate(async (csrfToken) =>
            apiClient.DELETE('/learning-support/responses/{response_id}', {
                params: {
                    header: { 'X-CSRF-Token': csrfToken },
                    path: { response_id: reply.id },
                },
            }),
        );
    }

    async function mutate(
        command: (csrfToken: string) => Promise<{ response: Response }>,
    ): Promise<void> {
        setActionError('');
        try {
            const result = await command(await getCsrfToken());
            if (!result.response.ok) {
                throw new Error('moderation unavailable');
            }
            await refresh();
        } catch {
            setActionError('This moderation change could not be saved yet.');
        }
    }

    const selectedTopic = topics.find((topic) => topic.id === selectedTopicId);
    const topicItems = useMemo(
        () =>
            topics.map(
                (topic): SettingsNavigationItem<string> => ({
                    description: `${topic.map_title} · ${t(
                        topic.message_count === 1
                            ? 'settings.learner_messages.count_one'
                            : 'settings.learner_messages.count_many',
                        topic.message_count === 1
                            ? ':count message'
                            : ':count messages',
                        { count: topic.message_count },
                    )}`,
                    icon: MessageSquareText,
                    key: topic.id,
                    label: `${topic.map_asset_title} — ${topic.title}`,
                }),
            ),
        [t, topics],
    );

    return (
        <main
            className="settings-surface h-svh min-h-0 overflow-hidden bg-[var(--settings-content-background)] text-slate-950 dark:text-slate-100"
            data-wl-id="settings.learning-support.learner-messages"
            style={settingsStyle(appearance)}
        >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
                <SettingsTopBar
                    menuQuery={settingsMenuQuery}
                    onSearchChange={setSettingsMenuQuery}
                />
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <aside className="flex shrink-0 flex-col border-b border-[var(--settings-border-color)] bg-[var(--settings-sidebar-background)] lg:w-72 lg:border-r lg:border-b-0">
                        <SettingsSidebarNavigation
                            activePanel="admin-learning-support"
                            sections={navigationSections}
                        />
                        <SettingsCornerNavigation onSignedOut={onSignedOut} />
                    </aside>
                    <div className="min-h-0 flex-1 overflow-hidden bg-[var(--settings-content-background)]">
                        <LearningSupportWorkspace
                            activeSection="learner-messages"
                            settingsAccess={settingsAccess}
                        >
                        <SettingsNestedWorkspace
                            contentClassName="p-0 sm:p-0"
                            sidebar={
                                <SettingsSectionNavigation
                                    activeSection={selectedTopicId ?? ''}
                                    ariaLabel={t(
                                        'settings.learner_messages.topic_navigation',
                                        'Message topics',
                                    )}
                                    items={topicItems}
                                    onChange={(topicId) => {
                                        setSelectedTopicId(topicId);
                                        setResponseFilter('all');
                                    }}
                                />
                            }
                        >
                            <div className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5">
                                {loadingTopics ? (
                                    <p className="py-8 text-sm text-[var(--settings-muted-text)]">
                                        {t(
                                            'settings.learner_messages.loading',
                                            'Loading messages...',
                                        )}
                                    </p>
                                ) : null}
                                {!loadingTopics && !selectedTopic ? (
                                    <EmptyState t={t} />
                                ) : null}
                                {selectedTopic ? (
                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                        <header className="shrink-0 border-b border-[var(--settings-border-color)] pb-5">
                                            <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                                                <MessageSquareText className="size-5" />
                                                <p className="text-xs font-medium tracking-[0.18em] uppercase">
                                                    {t(
                                                        'settings.learner_messages.eyebrow',
                                                        'Learner messages',
                                                    )}
                                                </p>
                                            </div>
                                            <h2 className="text-2xl font-semibold tracking-normal">
                                                {selectedTopic.map_asset_title}
                                            </h2>
                                            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                                                {selectedTopic.map_title} ·{' '}
                                                {selectedTopic.title}
                                            </p>
                                        </header>

                                        <SupportDigest
                                            onSelectTopic={(topicId) => {
                                                setSelectedTopicId(topicId);
                                                setResponseFilter(
                                                    'unconfirmed',
                                                );
                                            }}
                                            t={t}
                                            topics={topics}
                                        />

                                        <div
                                            aria-label={t(
                                                'settings.learner_messages.filter_label',
                                                'Resolution view',
                                            )}
                                            className="mt-4 flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--settings-border-color)] pb-3"
                                            role="group"
                                        >
                                            <span className="mr-1 text-xs font-semibold tracking-wide text-[var(--settings-muted-text)] uppercase">
                                                {t(
                                                    'settings.learner_messages.filter_label',
                                                    'Resolution view',
                                                )}
                                            </span>
                                            {[
                                                {
                                                    filter: 'all' as const,
                                                    label: t(
                                                        'settings.learner_messages.filter_all',
                                                        'All (:count)',
                                                        {
                                                            count:
                                                                page?.counts
                                                                    .all ?? 0,
                                                        },
                                                    ),
                                                },
                                                {
                                                    filter: 'unconfirmed' as const,
                                                    label: t(
                                                        'settings.learner_messages.filter_unconfirmed',
                                                        'Needs learner confirmation (:count)',
                                                        {
                                                            count:
                                                                page?.counts
                                                                    .unconfirmed ??
                                                                0,
                                                        },
                                                    ),
                                                },
                                                {
                                                    filter: 'helpful' as const,
                                                    label: t(
                                                        'settings.learner_messages.filter_helpful',
                                                        'Learner-confirmed helpful (:count)',
                                                        {
                                                            count:
                                                                page?.counts
                                                                    .helpful ??
                                                                0,
                                                        },
                                                    ),
                                                },
                                            ].map((option) => (
                                                <button
                                                    aria-pressed={
                                                        responseFilter ===
                                                        option.filter
                                                    }
                                                    className={`min-h-9 rounded-md border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none ${responseFilter === option.filter ? 'border-[var(--settings-accent)] bg-[var(--settings-active-background)] text-[var(--settings-accent)]' : 'border-[var(--settings-border-color)] text-[var(--settings-muted-text)] hover:border-[var(--settings-accent)] hover:text-[var(--settings-accent)]'}`}
                                                    key={option.filter}
                                                    onClick={() =>
                                                        setResponseFilter(
                                                            option.filter,
                                                        )
                                                    }
                                                    type="button"
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div
                                            aria-busy={loadingRequests}
                                            className="mt-4 flex min-h-0 flex-1 flex-col"
                                        >
                                            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                                {error ? (
                                                    <p
                                                        className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                                                        role="alert"
                                                    >
                                                        {error}
                                                    </p>
                                                ) : null}
                                                {actionError ? (
                                                    <p
                                                        className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                                                        role="alert"
                                                    >
                                                        {actionError}
                                                    </p>
                                                ) : null}
                                                {loadingRequests ? (
                                                    <p className="py-8 text-sm text-[var(--settings-muted-text)]">
                                                        {t(
                                                            'settings.learner_messages.loading',
                                                            'Loading messages...',
                                                        )}
                                                    </p>
                                                ) : null}
                                                {!loadingRequests && page ? (
                                                    <div className="grid gap-3">
                                                        {page.messages.map(
                                                            (message) => (
                                                                <RequestCard
                                                                    key={
                                                                        message.id
                                                                    }
                                                                    message={
                                                                        message
                                                                    }
                                                                    onDelete={() =>
                                                                        void deleteRequest(
                                                                            message,
                                                                        )
                                                                    }
                                                                    onReply={() => {
                                                                        setReplyingMessageId(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                current ===
                                                                                message.id
                                                                                    ? null
                                                                                    : message.id,
                                                                        );
                                                                        setReplyBody(
                                                                            '',
                                                                        );
                                                                        setActionError(
                                                                            '',
                                                                        );
                                                                    }}
                                                                    onSaveReply={() =>
                                                                        void saveReply(
                                                                            message.id,
                                                                        )
                                                                    }
                                                                    onSetVisibility={() =>
                                                                        void setRequestVisibility(
                                                                            message,
                                                                        )
                                                                    }
                                                                    replying={
                                                                        replyingMessageId ===
                                                                        message.id
                                                                    }
                                                                    replyBody={
                                                                        replyBody
                                                                    }
                                                                    setReplyBody={
                                                                        setReplyBody
                                                                    }
                                                                    submittingReply={
                                                                        submittingReply
                                                                    }
                                                                    onDeleteReply={(
                                                                        reply,
                                                                    ) =>
                                                                        void deleteReply(
                                                                            reply,
                                                                        )
                                                                    }
                                                                    onSetReplyVisibility={(
                                                                        reply,
                                                                    ) =>
                                                                        void setReplyVisibility(
                                                                            reply,
                                                                        )
                                                                    }
                                                                    onResponsePageChange={(
                                                                        responsePage,
                                                                    ) =>
                                                                        void loadResponses(
                                                                            message.id,
                                                                            responsePage,
                                                                        )
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                        {page.messages
                                                            .length === 0 ? (
                                                            <p className="border-b border-[var(--settings-border-color)] px-1 py-8 text-sm text-[var(--settings-muted-text)]">
                                                                {t(
                                                                    'settings.learner_messages.filter_empty',
                                                                    'No messages match this view.',
                                                                )}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                            {page ? (
                                                <Pagination
                                                    pagination={page.pagination}
                                                    onPageChange={(nextPage) =>
                                                        void loadMessages(
                                                            selectedTopic.id,
                                                            nextPage,
                                                        )
                                                    }
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </SettingsNestedWorkspace>
                        </LearningSupportWorkspace>
                    </div>
                </div>
            </div>
        </main>
    );
}

function RequestCard({
    message,
    onDelete,
    onDeleteReply,
    onReply,
    onSaveReply,
    onResponsePageChange,
    onSetReplyVisibility,
    onSetVisibility,
    replying,
    replyBody,
    setReplyBody,
    submittingReply,
}: {
    message: ModerationMessage;
    onDelete: () => void;
    onDeleteReply: (reply: SupportReply) => void;
    onReply: () => void;
    onSaveReply: () => void;
    onResponsePageChange: (page: number) => void;
    onSetReplyVisibility: (reply: SupportReply) => void;
    onSetVisibility: () => void;
    replying: boolean;
    replyBody: string;
    setReplyBody: (body: string) => void;
    submittingReply: boolean;
}) {
    return (
        <article className="border-b border-[var(--settings-border-color)] px-1 py-4 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-semibold">{message.author.email}</p>
                    <p className="text-xs text-[var(--settings-muted-text)]">
                        {new Date(message.created_at).toLocaleString()}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <span
                        className={`rounded-full border px-2 py-1 text-xs font-medium ${message.audience === 'support' ? 'border-amber-400/40 text-amber-700 dark:border-amber-300/30 dark:text-amber-200' : 'border-sky-400/40 text-sky-700 dark:border-sky-300/30 dark:text-sky-200'}`}
                    >
                        {message.audience === 'support'
                            ? 'Support request'
                            : 'Peer message'}
                    </span>
                    {message.audience === 'support' ? (
                        <ActionButton onClick={onReply}>
                            {replying ? 'Close reply' : 'Reply privately'}
                        </ActionButton>
                    ) : null}
                    <ActionButton
                        icon={
                            message.hidden_at ? (
                                <Eye className="size-4" />
                            ) : (
                                <EyeOff className="size-4" />
                            )
                        }
                        onClick={onSetVisibility}
                    >
                        {message.hidden_at ? 'Show' : 'Hide'}
                    </ActionButton>
                    <ActionButton
                        danger
                        icon={<Trash2 className="size-4" />}
                        onClick={onDelete}
                    >
                        Delete
                    </ActionButton>
                </div>
            </div>
            <p
                className={`mt-3 max-w-3xl text-sm leading-6 ${message.hidden_at ? 'text-slate-400 line-through opacity-70' : ''}`}
            >
                {message.body}
            </p>
            {message.hidden_at ? (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                    Hidden from learners
                </p>
            ) : null}
            {replying && message.audience === 'support' ? (
                <form
                    className="mt-4 grid gap-2 rounded-lg border border-[var(--settings-border-color)] bg-[color-mix(in_srgb,var(--settings-accent)_5%,transparent)] p-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSaveReply();
                    }}
                >
                    <label
                        className="text-xs font-semibold tracking-wide uppercase"
                        htmlFor={`support-reply-${message.id}`}
                    >
                        Private reply to learner
                    </label>
                    <textarea
                        className="min-h-24 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)]"
                        id={`support-reply-${message.id}`}
                        maxLength={280}
                        onChange={(event) => setReplyBody(event.target.value)}
                        value={replyBody}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--settings-muted-text)]">
                        <span>Only this learner can read the reply.</span>
                        <span>{replyBody.length}/280</span>
                    </div>
                    <div>
                        <ActionButton
                            disabled={submittingReply}
                            primary
                            type="submit"
                        >
                            {submittingReply
                                ? 'Sending...'
                                : 'Send private reply'}
                        </ActionButton>
                    </div>
                </form>
            ) : null}
            {message.responses.length > 0 ? (
                <div className="mt-4 grid gap-3 border-l-2 border-[var(--settings-border-color)] pl-4">
                    <p className="text-xs font-semibold tracking-wide text-[var(--settings-muted-text)] uppercase">
                        {message.responses.length}{' '}
                        {message.responses.length === 1
                            ? 'response'
                            : 'responses'}
                    </p>
                    {message.responses.map((reply) => (
                        <div className="grid gap-2" key={reply.id}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold">
                                        {reply.author.email}
                                    </p>
                                    <p className="text-xs text-[var(--settings-muted-text)]">
                                        {new Date(
                                            reply.created_at,
                                        ).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <ActionButton
                                        onClick={() =>
                                            onSetReplyVisibility(reply)
                                        }
                                    >
                                        {reply.hidden_at ? 'Show' : 'Hide'}
                                    </ActionButton>
                                    <ActionButton
                                        danger
                                        icon={<Trash2 className="size-4" />}
                                        onClick={() => onDeleteReply(reply)}
                                    >
                                        Delete
                                    </ActionButton>
                                </div>
                            </div>
                            <p
                                className={`text-sm leading-6 ${reply.hidden_at ? 'text-slate-400 line-through opacity-70' : ''}`}
                            >
                                {reply.body}
                            </p>
                            {reply.response_type ? (
                                <p className="text-xs font-medium tracking-wide text-[var(--settings-muted-text)] uppercase">
                                    {reply.response_type}
                                </p>
                            ) : null}
                            {reply.is_helpful ? (
                                <p className="text-xs font-medium text-teal-700 dark:text-teal-300">
                                    Learner-confirmed helpful
                                </p>
                            ) : null}
                            {reply.hidden_at ? (
                                <p className="text-xs text-amber-600 dark:text-amber-300">
                                    Hidden from learners
                                </p>
                            ) : null}
                        </div>
                    ))}
                    {message.response_pagination.last_page > 1 ? (
                        <Pagination
                            pagination={message.response_pagination}
                            onPageChange={onResponsePageChange}
                        />
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}

function ActionButton({
    children,
    danger = false,
    icon,
    primary = false,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    danger?: boolean;
    icon?: React.ReactNode;
    primary?: boolean;
}) {
    return (
        <button
            className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${danger ? 'border-red-500 bg-red-600 text-white hover:bg-red-700' : primary ? 'border-[var(--settings-accent)] bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)]' : 'border-[var(--settings-border-color)] text-[var(--settings-muted-text)] hover:border-[var(--settings-accent)] hover:text-[var(--settings-accent)]'}`}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
}

function Pagination({
    pagination,
    onPageChange,
}: {
    pagination: ModerationPage['pagination'];
    onPageChange: (page: number) => void;
}) {
    if (pagination.last_page <= 1) return null;
    return (
        <nav
            aria-label="Message pages"
            className="mt-4 flex min-h-8 items-center justify-between gap-3 border-t border-[var(--settings-border-color)] pt-3"
        >
            <button
                className="inline-flex items-center gap-1 text-sm text-[var(--settings-accent)] disabled:pointer-events-none disabled:opacity-40"
                disabled={pagination.current_page === 1}
                onClick={() => onPageChange(pagination.current_page - 1)}
                type="button"
            >
                <ChevronLeft className="size-4" />
                Previous
            </button>
            <span
                aria-live="polite"
                className="text-sm text-[var(--settings-muted-text)]"
            >
                Page {pagination.current_page} of {pagination.last_page}
            </span>
            <button
                className="inline-flex items-center gap-1 text-sm text-[var(--settings-accent)] disabled:pointer-events-none disabled:opacity-40"
                disabled={pagination.current_page === pagination.last_page}
                onClick={() => onPageChange(pagination.current_page + 1)}
                type="button"
            >
                Next
                <ChevronRight className="size-4" />
            </button>
        </nav>
    );
}

function EmptyState({ t }: { t: ReturnType<typeof usePlatformTranslation> }) {
    return (
        <section className="grid h-full place-items-center p-6 text-center">
            <div className="max-w-lg">
                <MessageSquareText className="mx-auto size-8 text-slate-400" />
                <h2 className="mt-4 text-lg font-semibold">
                    {t(
                        'settings.learner_messages.empty_title',
                        'No learner messages yet',
                    )}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">
                    {t(
                        'settings.learner_messages.empty_description',
                        'Messages appear here after learners contribute through a Message prompt activity.',
                    )}
                </p>
            </div>
        </section>
    );
}

function SupportDigest({
    onSelectTopic,
    t,
    topics,
}: {
    onSelectTopic: (topicId: string) => void;
    t: ReturnType<typeof usePlatformTranslation>;
    topics: Topic[];
}) {
    const attentionTopics = [...topics]
        .filter((topic) => topic.unconfirmed_message_count > 0)
        .sort(
            (left, right) =>
                right.unconfirmed_message_count -
                    left.unconfirmed_message_count ||
                right.message_count - left.message_count,
        )
        .slice(0, 3);

    if (attentionTopics.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="learner-message-digest-heading"
            className="mt-4 rounded-lg border border-[var(--settings-border-color)] bg-[color-mix(in_srgb,var(--settings-accent)_7%,transparent)] p-3"
            data-wl-id="settings.learning-support.learner-messages.digest"
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2
                        className="text-sm font-semibold text-[var(--settings-heading-color)]"
                        id="learner-message-digest-heading"
                    >
                        {t(
                            'settings.learner_messages.digest_title',
                            'Needs attention',
                        )}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                        {t(
                            'settings.learner_messages.digest_description',
                            'Open topics with messages that do not yet have a learner-confirmed resolution.',
                        )}
                    </p>
                </div>
                <span
                    aria-live="polite"
                    className="text-xs font-medium text-[var(--settings-accent)]"
                >
                    {t(
                        attentionTopics.length === 1
                            ? 'settings.learner_messages.digest_topic_one'
                            : 'settings.learner_messages.digest_topic_many',
                        attentionTopics.length === 1
                            ? ':count topic'
                            : ':count topics',
                        { count: attentionTopics.length },
                    )}
                </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {attentionTopics.map((topic) => (
                    <button
                        aria-label={t(
                            'settings.learner_messages.digest_open_topic',
                            'Open :topic; :count messages need learner-confirmed resolution',
                            {
                                count: topic.unconfirmed_message_count,
                                topic: `${topic.map_asset_title} — ${topic.title}`,
                            },
                        )}
                        className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 py-2 text-left text-xs transition hover:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                        key={topic.id}
                        onClick={() => onSelectTopic(topic.id)}
                        type="button"
                    >
                        <span className="block truncate font-medium text-[var(--settings-heading-color)]">
                            {topic.map_asset_title} — {topic.title}
                        </span>
                        <span className="mt-1 block text-[var(--settings-muted-text)]">
                            {t(
                                topic.unconfirmed_message_count === 1
                                    ? 'settings.learner_messages.digest_message_one'
                                    : 'settings.learner_messages.digest_message_many',
                                topic.unconfirmed_message_count === 1
                                    ? ':count message'
                                    : ':count messages',
                                { count: topic.unconfirmed_message_count },
                            )}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-accent-foreground': dark ? '#042f2e' : '#f8fafc',
        '--settings-active-background': dark
            ? 'rgb(45 212 191 / 10%)'
            : 'rgb(15 118 110 / 10%)',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-heading-color': dark ? '#f8fafc' : '#0f172a',
        '--settings-input-background': dark ? 'rgb(2 6 23 / 38%)' : '#ffffff',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark
            ? 'rgb(5 8 22 / 96%)'
            : 'rgb(248 250 252 / 96%)',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
        '--settings-sidebar-background': dark
            ? 'rgb(5 8 22 / 96%)'
            : 'rgb(248 250 252 / 96%)',
    } as CSSProperties;
}
