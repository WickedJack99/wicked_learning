import { Send, Users, X } from 'lucide-react';
import { useState } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMessageTime } from '@/features/messages/message-time';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { getJson, JsonRequestError, postJson } from './api';

type GroupMessage = {
    body: string;
    canResolve: boolean;
    createdAt: string | null;
    id: number;
    isHelpRequest: boolean;
    resolvedAt: string | null;
    resolvedBy: {
        email: string;
        id: number;
        name: string;
    } | null;
    user: {
        email: string;
        id: number;
        name: string;
    } | null;
};

export type LearningGroup = {
    adminChatRequiredVotes: number;
    adminChatVisible: boolean;
    adminChatVoteCount: number;
    currentUserVotedForAdminChat: boolean;
    description: string | null;
    id: number;
    memberCount: number;
    members: Array<{
        email: string;
        id: number;
        name: string;
    }>;
    messages: GroupMessage[];
    name: string;
};

export type LearningGroupPagination = {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
};

type LearningGroupsResponse = {
    groups: LearningGroup[];
    pagination: LearningGroupPagination;
};

export function GroupControl({
    groups,
    pagination: initialPagination,
    isOpen,
    onClose,
    onOpen,
}: {
    groups: LearningGroup[];
    pagination: LearningGroupPagination;
    isOpen: boolean;
    onClose: () => void;
    onOpen: () => void;
}) {
    const t = usePlatformTranslation();
    const [visibleGroups, setVisibleGroups] = useState(groups);
    const [pagination, setPagination] = useState(initialPagination);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    const loadGroupPage = async (page: number) => {
        if (isLoading || page === pagination.currentPage) {
            return;
        }

        setIsLoading(true);
        setLoadError('');

        try {
            const response = await getJson<LearningGroupsResponse>(
                `/learning/groups?page=${page}&per_page=${pagination.perPage}`,
            );
            setVisibleGroups(response.groups);
            setPagination(response.pagination);
        } catch (error) {
            setLoadError(
                error instanceof JsonRequestError
                    ? error.message
                    : t(
                          'world.groups.load_error',
                          'The group chats could not be loaded.',
                      ),
            );
        } finally {
            setIsLoading(false);
        }
    };

    const updateGroup = (updatedGroup: LearningGroup) => {
        setVisibleGroups((current) =>
            current.map((group) =>
                group.id === updatedGroup.id ? updatedGroup : group,
            ),
        );
    };

    return (
        <>
            <button
                aria-label={t('world.groups.open', 'Open groups')}
                className="absolute top-1/2 right-4 z-30 grid size-12 -translate-y-1/2 place-items-center rounded-2xl border border-slate-200 bg-white/92 shadow-2xl backdrop-blur-md transition hover:-translate-y-[calc(50%+2px)] focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/86 dark:focus-visible:ring-teal-200"
                onClick={onOpen}
                style={{
                    background: 'var(--map-floating-background)',
                    borderColor: 'var(--map-floating-border-color)',
                    color: 'var(--map-floating-text-color)',
                    cursor: 'var(--platform-action-cursor)',
                }}
                type="button"
            >
                <Users className="size-5" />
            </button>

            {isOpen ? (
                <section
                    className="absolute top-28 right-4 z-40 grid max-h-[calc(100svh-7rem)] w-[min(28rem,calc(100%-2rem))] gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/94 p-4 text-slate-950 shadow-2xl backdrop-blur-md sm:top-16 sm:max-h-[calc(100svh-5rem)] dark:border-white/10 dark:bg-slate-950/92 dark:text-slate-100"
                    style={{
                        background: 'var(--map-floating-background)',
                        borderColor: 'var(--map-floating-border-color)',
                        color: 'var(--map-floating-text-color)',
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p
                                className="text-xs font-semibold tracking-[0.18em] uppercase"
                                style={{
                                    color: 'var(--map-floating-accent-color)',
                                }}
                            >
                                {t('world.groups.eyebrow', 'Groups')}
                            </p>
                            <h2 className="mt-1 text-lg font-semibold">
                                {t('world.groups.title', 'Group chats')}
                            </h2>
                        </div>
                        <Button
                            aria-label={t('world.groups.close', 'Close groups')}
                            onClick={onClose}
                            size="icon"
                            type="button"
                            variant="ghost"
                        >
                            <X className="size-5" />
                        </Button>
                    </div>
                    <div>
                        {pagination.total === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                                {t(
                                    'world.groups.empty',
                                    'You are not assigned to a group yet.',
                                )}
                            </p>
                        ) : (
                            <div aria-busy={isLoading} className="grid gap-3">
                                {isLoading ? (
                                    <p
                                        aria-live="polite"
                                        className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400"
                                        role="status"
                                    >
                                        {t(
                                            'world.groups.loading',
                                            'Loading group chat...',
                                        )}
                                    </p>
                                ) : null}
                                {visibleGroups.map((group) => (
                                    <GroupChatCard
                                        group={group}
                                        key={group.id}
                                        onGroupUpdated={updateGroup}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    {loadError ? (
                        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                            {loadError}
                        </p>
                    ) : null}
                    <PaginationControls
                        buttonClassName="min-h-11 text-[var(--map-floating-accent-color)] transition hover:text-[var(--map-floating-text-color)]"
                        className="border-t border-[var(--map-floating-border-color)] pt-3"
                        currentPage={pagination.currentPage}
                        disabled={isLoading}
                        label={t('world.groups.pagination', 'Group chats')}
                        onPageChange={(page) => void loadGroupPage(page)}
                        pageCount={pagination.lastPage}
                        textClassName="text-[var(--map-floating-text-color)]"
                    />
                </section>
            ) : null}
        </>
    );
}

function GroupChatCard({
    group,
    onGroupUpdated,
}: {
    group: LearningGroup;
    onGroupUpdated: (group: LearningGroup) => void;
}) {
    const t = usePlatformTranslation();
    const [body, setBody] = useState('');
    const [isHelpRequest, setIsHelpRequest] = useState(false);
    const [isResolvingMessageId, setIsResolvingMessageId] = useState<
        number | null
    >(null);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    const sendMessage = async () => {
        const message = body.trim();

        if (message === '') {
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const response = await postJson<{ group: LearningGroup }>(
                `/learning/groups/${group.id}/messages`,
                { body: message, is_help_request: isHelpRequest },
            );
            onGroupUpdated(response.group);
            setBody('');
            setIsHelpRequest(false);
        } catch (error) {
            setError(
                error instanceof JsonRequestError
                    ? error.message
                    : 'The message could not be sent.',
            );
        } finally {
            setIsSending(false);
        }
    };

    const resolveHelpRequest = async (messageId: number) => {
        setError('');
        setIsResolvingMessageId(messageId);

        try {
            const response = await postJson<{ group: LearningGroup }>(
                `/learning/groups/${group.id}/messages/${messageId}/resolve`,
                {},
            );
            onGroupUpdated(response.group);
        } catch (error) {
            setError(
                error instanceof JsonRequestError
                    ? error.message
                    : t(
                          'world.groups.help.resolve_error',
                          'The help request could not be updated.',
                      ),
            );
        } finally {
            setIsResolvingMessageId(null);
        }
    };

    const vote = async () => {
        setError('');

        try {
            const response = await postJson<{ group: LearningGroup }>(
                `/learning/groups/${group.id}/admin-chat-vote`,
                {},
            );
            onGroupUpdated(response.group);
        } catch {
            setError('The vote could not be saved.');
        }
    };

    return (
        <article className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {group.memberCount} members
                    </p>
                </div>
                <Button
                    disabled={
                        group.adminChatVisible ||
                        group.currentUserVotedForAdminChat
                    }
                    onClick={() => void vote()}
                    size="sm"
                    type="button"
                    variant="secondary"
                >
                    {group.adminChatVisible
                        ? 'Admin view allowed'
                        : group.currentUserVotedForAdminChat
                          ? 'Voted'
                          : `Vote ${group.adminChatVoteCount}/${group.adminChatRequiredVotes}`}
                </Button>
            </div>
            <div
                aria-label="Group chat messages"
                className="grid h-52 content-start gap-2 overflow-y-auto overscroll-contain rounded-lg bg-slate-100 p-2 dark:bg-white/10"
            >
                {group.messages.length === 0 ? (
                    <p className="p-2 text-sm text-slate-500 dark:text-slate-400">
                        No messages yet.
                    </p>
                ) : null}
                {group.messages.map((message) => (
                    <div
                        className="rounded-lg bg-white p-2 text-sm dark:bg-slate-950/70"
                        key={message.id}
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                    {message.user?.name ?? 'Unknown user'}
                                </p>
                                {message.isHelpRequest ? (
                                    <span className="rounded-full border border-amber-300/70 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-200/30 dark:text-amber-200">
                                        {message.resolvedAt
                                            ? t(
                                                  'world.groups.help.resolved',
                                                  'Help request resolved',
                                              )
                                            : t(
                                                  'world.groups.help.request',
                                                  'Help requested',
                                              )}
                                    </span>
                                ) : null}
                            </div>
                            <time dateTime={message.createdAt ?? undefined}>
                                {formatMessageTime(message.createdAt)}
                            </time>
                        </div>
                        <p className="mt-1 leading-6 whitespace-pre-wrap">
                            {message.body}
                        </p>
                        {message.isHelpRequest && message.resolvedAt ? (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {t(
                                    'world.groups.help.resolved_by',
                                    'Marked resolved by :name.',
                                    {
                                        name:
                                            message.resolvedBy?.name ??
                                            t('common.unknown', 'Unknown'),
                                    },
                                )}
                            </p>
                        ) : null}
                        {message.canResolve ? (
                            <Button
                                className="mt-2"
                                disabled={isResolvingMessageId === message.id}
                                onClick={() =>
                                    void resolveHelpRequest(message.id)
                                }
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                {isResolvingMessageId === message.id
                                    ? t(
                                          'world.groups.help.resolving',
                                          'Updating...',
                                      )
                                    : t(
                                          'world.groups.help.mark_resolved',
                                          'Mark resolved',
                                      )}
                            </Button>
                        ) : null}
                    </div>
                ))}
            </div>
            <div className="grid gap-1">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                        checked={isHelpRequest}
                        className="size-4 accent-teal-500"
                        onChange={(event) =>
                            setIsHelpRequest(event.target.checked)
                        }
                        type="checkbox"
                    />
                    {t('world.groups.help.checkbox', 'Ask the group for help')}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(
                        'world.groups.help.helper',
                        'This labels your message as a request that another member can mark resolved.',
                    )}
                </p>
            </div>
            <div className="flex gap-2">
                <Input
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                        }
                    }}
                    placeholder="Message the group"
                />
                <Button
                    aria-label="Send message"
                    disabled={isSending || body.trim() === ''}
                    onClick={() => void sendMessage()}
                    size="icon"
                    type="button"
                >
                    <Send className="size-4" />
                </Button>
            </div>
            {error ? (
                <p
                    className="text-sm text-red-600 dark:text-red-300"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </article>
    );
}
