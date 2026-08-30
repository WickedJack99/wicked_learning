import { router } from '@inertiajs/react';
import { Eye, EyeOff, MessageSquareText, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import {
    SettingsConfigurationLayout,
    SettingsContentPane,
    SettingsPanelHeader,
    SettingsSectionNavigation,
    SettingsSidebar,
} from '@/components/settings-configuration-shell';
import type { SettingsNavigationItem } from '@/components/settings-configuration-shell';
import { Button } from '@/components/ui/button';
import { getJson } from '@/features/world/api';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type ResponseFilter = 'all' | 'helpful' | 'unconfirmed';

type PaginationState = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

export type LearnerMessageModerationTopic = {
    helpfulMessageCount: number;
    id: number;
    mapAsset: {
        id: number;
        mapTitle: string;
        title: string;
    };
    messageCount: number;
    title: string;
    unconfirmedMessageCount: number;
};

export type LearnerMessageModerationMessage = {
    audience: 'peers' | 'support' | string;
    author: { email: string; id: number; name: string };
    body: string;
    createdAt: string | null;
    hiddenAt: string | null;
    hiddenBy: { id: number; name: string } | null;
    id: number;
    responseCount: number;
    responsePagination: PaginationState;
    responses: Array<{
        author: { email: string; id: number; name: string };
        body: string;
        createdAt: string | null;
        hiddenAt: string | null;
        hiddenBy: { id: number; name: string } | null;
        id: number;
        isHelpful: boolean;
        responseType:
            | 'counterexample'
            | 'explanation'
            | 'example'
            | 'question'
            | null;
    }>;
};

type LearnerMessageResponsesPage = {
    messageId: number;
    pagination: PaginationState;
    responses: LearnerMessageModerationMessage['responses'];
};

type LearnerMessageModerationPage = {
    counts: {
        all: number;
        helpful: number;
        unconfirmed: number;
    };
    messages: LearnerMessageModerationMessage[];
    pagination: PaginationState;
};

const MESSAGE_PAGE_SIZE = 6;
const RESPONSE_PAGE_SIZE = 3;

export function LearnerMessageModerationPanel({
    topics,
}: {
    topics: LearnerMessageModerationTopic[];
}) {
    const t = usePlatformTranslation();
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
        topics[0]?.id.toString() ?? null,
    );
    const selectedTopic =
        topics.find((topic) => topic.id.toString() === selectedTopicId) ??
        topics[0];
    const [responseFilter, setResponseFilter] = useState<ResponseFilter>('all');
    const [messages, setMessages] = useState<LearnerMessageModerationMessage[]>(
        [],
    );
    const [pagination, setPagination] = useState({
        currentPage: 1,
        lastPage: 1,
        perPage: MESSAGE_PAGE_SIZE,
        total: 0,
    });
    const [counts, setCounts] = useState({
        all: 0,
        helpful: 0,
        unconfirmed: 0,
    });
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [responseErrorMessageId, setResponseErrorMessageId] = useState<
        number | null
    >(null);
    const [responseLoadingMessageId, setResponseLoadingMessageId] = useState<
        number | null
    >(null);
    const responseRequestRef = useRef<AbortController | null>(null);
    const loadMessages = useCallback(
        async (
            topicId: number,
            requestedPage: number,
            filter: ResponseFilter,
            signal?: AbortSignal,
        ): Promise<void> => {
            responseRequestRef.current?.abort();
            responseRequestRef.current = null;
            setResponseErrorMessageId(null);
            setResponseLoadingMessageId(null);
            setIsLoading(true);
            setError('');
            const params = new URLSearchParams({
                filter,
                page: String(requestedPage),
                per_page: String(MESSAGE_PAGE_SIZE),
            });

            try {
                const payload = await getJson<LearnerMessageModerationPage>(
                    `/settings/learning-support/message-topics/${topicId}/messages?${params.toString()}`,
                    signal,
                );
                setMessages(payload.messages);
                setPagination(payload.pagination);
                setCounts(payload.counts);
                setPage((currentPage) =>
                    Math.min(currentPage, payload.pagination.lastPage),
                );
            } catch (requestError) {
                if (
                    requestError instanceof DOMException &&
                    requestError.name === 'AbortError'
                ) {
                    return;
                }

                setMessages([]);
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : t(
                              'settings.learner_messages.load_error',
                              'The selected message topic could not be loaded.',
                          ),
                );
            } finally {
                if (!signal?.aborted) {
                    setIsLoading(false);
                }
            }
        },
        [t],
    );
    const loadResponses = useCallback(
        async (messageId: number, requestedPage: number): Promise<void> => {
            responseRequestRef.current?.abort();
            const controller = new AbortController();
            responseRequestRef.current = controller;
            setResponseErrorMessageId(null);
            setResponseLoadingMessageId(messageId);
            const params = new URLSearchParams({
                page: String(requestedPage),
                per_page: String(RESPONSE_PAGE_SIZE),
            });

            try {
                const payload = await getJson<LearnerMessageResponsesPage>(
                    `/settings/learning-support/messages/${messageId}/responses?${params.toString()}`,
                    controller.signal,
                );
                setMessages((currentMessages) =>
                    currentMessages.map((message) =>
                        message.id === messageId
                            ? {
                                  ...message,
                                  responsePagination: payload.pagination,
                                  responses: payload.responses,
                              }
                            : message,
                    ),
                );
            } catch (requestError) {
                if (
                    requestError instanceof DOMException &&
                    requestError.name === 'AbortError'
                ) {
                    return;
                }

                setResponseErrorMessageId(messageId);
            } finally {
                if (!controller.signal.aborted) {
                    setResponseLoadingMessageId(null);
                }
            }
        },
        [],
    );
    useEffect(() => {
        if (selectedTopicId === null) {
            return;
        }

        const controller = new AbortController();

        // Loading the selected topic synchronizes local state with the API.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadMessages(
            Number(selectedTopicId),
            page,
            responseFilter,
            controller.signal,
        );

        return () => controller.abort();
    }, [loadMessages, page, responseFilter, selectedTopicId]);
    useEffect(() => () => responseRequestRef.current?.abort(), []);
    const refreshMessages = useCallback(() => {
        if (selectedTopicId === null) {
            return;
        }

        void loadMessages(Number(selectedTopicId), page, responseFilter);
    }, [loadMessages, page, responseFilter, selectedTopicId]);
    const items = useMemo(
        () =>
            topics.map(
                (topic): SettingsNavigationItem<string> => ({
                    description: `${topic.mapAsset.mapTitle} · ${t(
                        topic.messageCount === 1
                            ? 'settings.learner_messages.count_one'
                            : 'settings.learner_messages.count_many',
                        topic.messageCount === 1
                            ? ':count message'
                            : ':count messages',
                        { count: topic.messageCount },
                    )}`,
                    icon: MessageSquareText,
                    key: topic.id.toString(),
                    label: `${topic.mapAsset.title} — ${topic.title}`,
                }),
            ),
        [t, topics],
    );

    if (!selectedTopic) {
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
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {t(
                            'settings.learner_messages.empty_description',
                            'Messages appear here after learners contribute through a Message prompt activity.',
                        )}
                    </p>
                </div>
            </section>
        );
    }

    const headerItem: SettingsNavigationItem<'learner-messages'> = {
        description: t(
            'settings.learner_messages.description',
            'Review short learner contributions grouped by MapAsset and topic.',
        ),
        icon: MessageSquareText,
        key: 'learner-messages',
        label: t('settings.learner_messages.eyebrow', 'Learner messages'),
    };

    return (
        <SettingsConfigurationLayout
            className="h-full gap-0"
            contentClassName="min-h-0 overflow-hidden"
            sidebar={
                <SettingsSidebar>
                    <SettingsSectionNavigation
                        activeSection={selectedTopic.id.toString()}
                        ariaLabel={t(
                            'settings.learner_messages.topic_navigation',
                            'Message topics',
                        )}
                        items={items}
                        onChange={(topicId) => {
                            setSelectedTopicId(topicId);
                            setResponseFilter('all');
                            setPage(1);
                        }}
                    />
                </SettingsSidebar>
            }
        >
            <SettingsContentPane>
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="shrink-0">
                        <SettingsPanelHeader
                            description={`${selectedTopic.mapAsset.mapTitle} · ${selectedTopic.title}`}
                            item={headerItem}
                            title={selectedTopic.mapAsset.title}
                        />
                    </div>

                    <SupportDigest
                        onSelectTopic={(topicId) => {
                            setSelectedTopicId(topicId.toString());
                            setResponseFilter('unconfirmed');
                            setPage(1);
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
                        <span className="mr-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
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
                                    { count: counts.all },
                                ),
                            },
                            {
                                filter: 'unconfirmed' as const,
                                label: t(
                                    'settings.learner_messages.filter_unconfirmed',
                                    'Needs learner confirmation (:count)',
                                    { count: counts.unconfirmed },
                                ),
                            },
                            {
                                filter: 'helpful' as const,
                                label: t(
                                    'settings.learner_messages.filter_helpful',
                                    'Learner-confirmed helpful (:count)',
                                    { count: counts.helpful },
                                ),
                            },
                        ].map((option) => (
                            <button
                                aria-pressed={responseFilter === option.filter}
                                className={`min-h-9 rounded-md border px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-[var(--settings-accent-color)] focus-visible:outline-none ${responseFilter === option.filter ? 'border-[var(--settings-accent-color)] bg-[color-mix(in_srgb,var(--settings-accent-color)_14%,transparent)] text-[var(--settings-heading-color)]' : 'border-[var(--settings-border-color)] text-slate-500 hover:border-[var(--settings-accent-color)] hover:text-[var(--settings-heading-color)] dark:text-slate-400'}`}
                                key={option.filter}
                                onClick={() => {
                                    setResponseFilter(option.filter);
                                    setPage(1);
                                }}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div
                        aria-busy={isLoading}
                        className="mt-4 flex min-h-0 flex-1 flex-col"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            {isLoading ? (
                                <p className="py-8 text-sm text-slate-500 dark:text-slate-400">
                                    {t(
                                        'settings.learner_messages.loading',
                                        'Loading messages...',
                                    )}
                                </p>
                            ) : error ? (
                                <p
                                    className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
                                    role="alert"
                                >
                                    {error}
                                </p>
                            ) : (
                                <div className="grid gap-3">
                                    {messages.map((message) => (
                                        <article
                                            className="border-b border-[var(--settings-border-color)] px-1 py-4 first:pt-0"
                                            key={message.id}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold">
                                                        {message.author.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {message.author.email}
                                                        {message.createdAt
                                                            ? ` · ${new Date(message.createdAt).toLocaleString()}`
                                                            : ''}
                                                    </p>
                                                </div>
                                                {message.audience ===
                                                'support' ? (
                                                    <span className="rounded-full border border-amber-400/40 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-300/30 dark:text-amber-200">
                                                        {t(
                                                            'settings.learner_messages.support_request',
                                                            'Support request',
                                                        )}
                                                    </span>
                                                ) : null}
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() =>
                                                            router.patch(
                                                                `/settings/learning-support/messages/${message.id}/visibility`,
                                                                {
                                                                    hidden:
                                                                        message.hiddenAt ===
                                                                        null,
                                                                },
                                                                {
                                                                    preserveScroll: true,
                                                                    onSuccess:
                                                                        refreshMessages,
                                                                },
                                                            )
                                                        }
                                                        size="sm"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        {message.hiddenAt ? (
                                                            <Eye className="size-4" />
                                                        ) : (
                                                            <EyeOff className="size-4" />
                                                        )}
                                                        {message.hiddenAt
                                                            ? t(
                                                                  'settings.learner_messages.show',
                                                                  'Show',
                                                              )
                                                            : t(
                                                                  'settings.learner_messages.hide',
                                                                  'Hide',
                                                              )}
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            if (
                                                                window.confirm(
                                                                    t(
                                                                        'settings.learner_messages.delete_confirm',
                                                                        'Permanently delete this learner message?',
                                                                    ),
                                                                )
                                                            ) {
                                                                router.delete(
                                                                    `/settings/learning-support/messages/${message.id}`,
                                                                    {
                                                                        preserveScroll: true,
                                                                        onSuccess:
                                                                            refreshMessages,
                                                                    },
                                                                );
                                                            }
                                                        }}
                                                        size="sm"
                                                        type="button"
                                                        variant="destructive"
                                                    >
                                                        <Trash2 className="size-4" />
                                                        {t(
                                                            'settings.learner_messages.delete',
                                                            'Delete',
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                            <p
                                                className={`mt-3 max-w-3xl text-sm leading-6 ${message.hiddenAt ? 'text-slate-400 line-through opacity-70' : ''}`}
                                            >
                                                {message.body}
                                            </p>
                                            {message.hiddenAt ? (
                                                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                                                    {t(
                                                        'settings.learner_messages.hidden_note',
                                                        'Hidden from learners',
                                                    )}
                                                    {message.hiddenBy
                                                        ? ` · ${message.hiddenBy.name}`
                                                        : ''}
                                                </p>
                                            ) : null}
                                            {message.responseCount > 0 ? (
                                                <div
                                                    aria-busy={
                                                        responseLoadingMessageId ===
                                                        message.id
                                                    }
                                                    className="mt-4 grid gap-3 border-l-2 border-[var(--settings-border-color)] pl-4"
                                                >
                                                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                                        {t(
                                                            message.responseCount ===
                                                                1
                                                                ? 'settings.learner_messages.responses_count_one'
                                                                : 'settings.learner_messages.responses_count_many',
                                                            message.responseCount ===
                                                                1
                                                                ? ':count response'
                                                                : ':count responses',
                                                            {
                                                                count: message.responseCount,
                                                            },
                                                        )}
                                                    </p>
                                                    {responseLoadingMessageId ===
                                                    message.id ? (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            {t(
                                                                'settings.learner_messages.responses_loading',
                                                                'Loading responses...',
                                                            )}
                                                        </p>
                                                    ) : null}
                                                    {responseErrorMessageId ===
                                                    message.id ? (
                                                        <p
                                                            className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-200"
                                                            role="alert"
                                                        >
                                                            {t(
                                                                'settings.learner_messages.responses_load_error',
                                                                'The responses could not be loaded.',
                                                            )}
                                                        </p>
                                                    ) : null}
                                                    {message.responses.map(
                                                        (response) => (
                                                            <div
                                                                className="grid gap-2"
                                                                key={
                                                                    response.id
                                                                }
                                                            >
                                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                                    <div>
                                                                        <p className="text-sm font-semibold">
                                                                            {
                                                                                response
                                                                                    .author
                                                                                    .name
                                                                            }
                                                                        </p>
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                            {
                                                                                response
                                                                                    .author
                                                                                    .email
                                                                            }
                                                                            {response.createdAt
                                                                                ? ` · ${new Date(response.createdAt).toLocaleString()}`
                                                                                : ''}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            onClick={() =>
                                                                                router.patch(
                                                                                    `/settings/learning-support/message-responses/${response.id}/visibility`,
                                                                                    {
                                                                                        hidden:
                                                                                            response.hiddenAt ===
                                                                                            null,
                                                                                    },
                                                                                    {
                                                                                        preserveScroll: true,
                                                                                        onSuccess:
                                                                                            refreshMessages,
                                                                                    },
                                                                                )
                                                                            }
                                                                            size="sm"
                                                                            type="button"
                                                                            variant="outline"
                                                                        >
                                                                            {response.hiddenAt
                                                                                ? t(
                                                                                      'settings.learner_messages.show',
                                                                                      'Show',
                                                                                  )
                                                                                : t(
                                                                                      'settings.learner_messages.hide',
                                                                                      'Hide',
                                                                                  )}
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => {
                                                                                if (
                                                                                    window.confirm(
                                                                                        t(
                                                                                            'settings.learner_messages.delete_response_confirm',
                                                                                            'Permanently delete this learner response?',
                                                                                        ),
                                                                                    )
                                                                                ) {
                                                                                    router.delete(
                                                                                        `/settings/learning-support/message-responses/${response.id}`,
                                                                                        {
                                                                                            preserveScroll: true,
                                                                                            onSuccess:
                                                                                                refreshMessages,
                                                                                        },
                                                                                    );
                                                                                }
                                                                            }}
                                                                            size="sm"
                                                                            type="button"
                                                                            variant="destructive"
                                                                        >
                                                                            <Trash2 className="size-4" />
                                                                            {t(
                                                                                'settings.learner_messages.delete',
                                                                                'Delete',
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <p
                                                                    className={`text-sm leading-6 ${response.hiddenAt ? 'text-slate-400 line-through opacity-70' : ''}`}
                                                                >
                                                                    {response.responseType ? (
                                                                        <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                                                                            {t(
                                                                                `settings.learner_messages.response_kind_${response.responseType}`,
                                                                                response.responseType ===
                                                                                    'explanation'
                                                                                    ? 'Explained an idea'
                                                                                    : response.responseType ===
                                                                                        'example'
                                                                                      ? 'Shared an example'
                                                                                      : response.responseType ===
                                                                                          'counterexample'
                                                                                        ? 'Shared a counterexample'
                                                                                        : 'Asked a question',
                                                                            )}
                                                                        </span>
                                                                    ) : null}
                                                                    {
                                                                        response.body
                                                                    }
                                                                </p>
                                                                {response.isHelpful ? (
                                                                    <span className="mt-2 inline-flex rounded-full border border-teal-500/30 px-2 py-1 text-xs font-medium text-teal-700 dark:border-teal-300/30 dark:text-teal-200">
                                                                        {t(
                                                                            'settings.learner_messages.helpful_signal',
                                                                            'Marked helpful by learner',
                                                                        )}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ),
                                                    )}
                                                    <PaginationControls
                                                        className="border-t border-[var(--settings-border-color)] pt-2"
                                                        currentPage={
                                                            message
                                                                .responsePagination
                                                                .currentPage
                                                        }
                                                        label={t(
                                                            'settings.learner_messages.responses_pagination',
                                                            'Response pages',
                                                        )}
                                                        nextLabel={t(
                                                            'settings.learner_messages.responses_next_page',
                                                            'Next response page',
                                                        )}
                                                        onPageChange={(
                                                            responsePage,
                                                        ) =>
                                                            void loadResponses(
                                                                message.id,
                                                                responsePage,
                                                            )
                                                        }
                                                        pageCount={
                                                            message
                                                                .responsePagination
                                                                .lastPage
                                                        }
                                                        previousLabel={t(
                                                            'settings.learner_messages.responses_previous_page',
                                                            'Previous response page',
                                                        )}
                                                    />
                                                </div>
                                            ) : null}
                                        </article>
                                    ))}
                                    {messages.length === 0 ? (
                                        <p className="border-b border-[var(--settings-border-color)] px-1 py-8 text-sm text-slate-500 dark:text-slate-400">
                                            {t(
                                                'settings.learner_messages.filter_empty',
                                                'No messages match this view.',
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </div>
                        <PaginationControls
                            className="mt-4 border-t border-[var(--settings-border-color)] pt-3"
                            currentPage={pagination.currentPage}
                            label={t(
                                'settings.learner_messages.pagination',
                                'Message pages',
                            )}
                            nextLabel={t(
                                'settings.learner_messages.next_page',
                                'Next message page',
                            )}
                            onPageChange={setPage}
                            pageCount={pagination.lastPage}
                            previousLabel={t(
                                'settings.learner_messages.previous_page',
                                'Previous message page',
                            )}
                        />
                    </div>
                </div>
            </SettingsContentPane>
        </SettingsConfigurationLayout>
    );
}

function SupportDigest({
    onSelectTopic,
    t,
    topics,
}: {
    onSelectTopic: (topicId: number) => void;
    t: ReturnType<typeof usePlatformTranslation>;
    topics: LearnerMessageModerationTopic[];
}) {
    const attentionTopics = [...topics]
        .filter((topic) => topic.unconfirmedMessageCount > 0)
        .sort(
            (left, right) =>
                right.unconfirmedMessageCount - left.unconfirmedMessageCount ||
                right.messageCount - left.messageCount,
        )
        .slice(0, 3);

    if (attentionTopics.length === 0) {
        return null;
    }

    return (
        <section
            aria-labelledby="learner-message-digest-heading"
            className="mt-4 rounded-lg border border-[var(--settings-border-color)] bg-[color-mix(in_srgb,var(--settings-accent-color)_7%,transparent)] p-3"
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
                                count: topic.unconfirmedMessageCount,
                                topic: `${topic.mapAsset.title} — ${topic.title}`,
                            },
                        )}
                        className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 py-2 text-left text-xs transition hover:border-[var(--settings-accent)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                        key={topic.id}
                        onClick={() => onSelectTopic(topic.id)}
                        type="button"
                    >
                        <span className="block truncate font-medium text-[var(--settings-heading-color)]">
                            {topic.mapAsset.title} — {topic.title}
                        </span>
                        <span className="mt-1 block text-[var(--settings-muted-text)]">
                            {t(
                                topic.unconfirmedMessageCount === 1
                                    ? 'settings.learner_messages.digest_message_one'
                                    : 'settings.learner_messages.digest_message_many',
                                topic.unconfirmedMessageCount === 1
                                    ? ':count message'
                                    : ':count messages',
                                { count: topic.unconfirmedMessageCount },
                            )}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
