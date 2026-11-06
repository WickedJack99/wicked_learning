import { Send, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';

type LearningGroup = components['schemas']['LearnerGroup'];
type LearningGroupPage = components['schemas']['LearnerGroupPage'];

/**
 * Source-adapted from resources/js/features/world/group-control.tsx. The
 * original receives its first group page as an Inertia prop; the standalone
 * React surface loads the same member-only page when the floating control is
 * opened, through the generated Rust contract.
 */
export function OriginalGroupControl() {
    const [isOpen, setIsOpen] = useState(false);
    const [page, setPage] = useState<LearningGroupPage | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    async function loadGroupPage(requestedPage: number): Promise<void> {
        if (isLoading) {
            return;
        }
        setIsLoading(true);
        setLoadError('');
        try {
            const { data, response } = await apiClient.GET('/learner/groups', {
                params: { query: { page: requestedPage, per_page: 1 } },
            });
            if (!response.ok || !data) {
                throw new Error('groups unavailable');
            }
            setPage(data);
        } catch {
            setLoadError('The group chats could not be loaded.');
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        if (isOpen && page === null) {
            void loadGroupPage(1);
        }
    }, [isOpen, page]);

    function updateGroup(updatedGroup: LearningGroup): void {
        setPage((current) =>
            current === null
                ? current
                : {
                      ...current,
                      groups: current.groups.map((group) =>
                          group.id === updatedGroup.id ? updatedGroup : group,
                      ),
                  },
        );
    }

    const pagination = page?.pagination;
    return (
        <>
            <button
                aria-label="Open groups"
                className="absolute top-1/2 right-4 z-30 grid size-12 -translate-y-1/2 place-items-center rounded-2xl border border-slate-200 bg-white/92 shadow-2xl backdrop-blur-md transition hover:-translate-y-[calc(50%+2px)] focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/86 dark:focus-visible:ring-teal-200"
                onClick={() => setIsOpen(true)}
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
                    aria-label="Groups"
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
                                style={{ color: 'var(--map-floating-accent-color)' }}
                            >
                                Groups
                            </p>
                            <h2 className="mt-1 text-lg font-semibold">
                                Group chats
                            </h2>
                        </div>
                        <button
                            aria-label="Close groups"
                            className="grid size-9 place-items-center rounded-md transition hover:bg-black/10 dark:hover:bg-white/10"
                            onClick={() => setIsOpen(false)}
                            type="button"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                    <div>
                        {isLoading && page === null ? (
                            <p
                                aria-live="polite"
                                className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400"
                                role="status"
                            >
                                Loading group chat…
                            </p>
                        ) : null}
                        {page?.pagination.total === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                                You are not assigned to a group yet.
                            </p>
                        ) : null}
                        {page && page.pagination.total > 0 ? (
                            <div aria-busy={isLoading} className="grid gap-3">
                                {isLoading ? (
                                    <p
                                        aria-live="polite"
                                        className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400"
                                        role="status"
                                    >
                                        Loading group chat…
                                    </p>
                                ) : null}
                                {page.groups.map((group) => (
                                    <GroupChatCard
                                        group={group}
                                        key={group.id}
                                        onGroupUpdated={updateGroup}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>
                    {loadError ? (
                        <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                            {loadError}
                        </p>
                    ) : null}
                    {pagination && pagination.last_page > 1 ? (
                        <nav
                            aria-label="Group chats"
                            className="flex items-center justify-between border-t border-[var(--map-floating-border-color)] pt-3"
                        >
                            <button
                                className="min-h-11 rounded px-2 text-sm text-[var(--map-floating-accent-color)] disabled:opacity-50"
                                disabled={isLoading || pagination.current_page <= 1}
                                onClick={() =>
                                    void loadGroupPage(pagination.current_page - 1)
                                }
                                type="button"
                            >
                                Previous
                            </button>
                            <span className="text-sm">
                                {pagination.current_page} / {pagination.last_page}
                            </span>
                            <button
                                className="min-h-11 rounded px-2 text-sm text-[var(--map-floating-accent-color)] disabled:opacity-50"
                                disabled={
                                    isLoading ||
                                    pagination.current_page >= pagination.last_page
                                }
                                onClick={() =>
                                    void loadGroupPage(pagination.current_page + 1)
                                }
                                type="button"
                            >
                                Next
                            </button>
                        </nav>
                    ) : null}
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
    const [body, setBody] = useState('');
    const [isHelpRequest, setIsHelpRequest] = useState(false);
    const [isResolvingMessageId, setIsResolvingMessageId] = useState<
        string | null
    >(null);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    async function sendMessage(): Promise<void> {
        const message = body.trim();
        if (message === '') {
            return;
        }
        setIsSending(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/groups/{group_id}/messages',
                {
                    body: { body: message, is_help_request: isHelpRequest },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { group_id: group.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('message unavailable');
            }
            onGroupUpdated(data.group);
            setBody('');
            setIsHelpRequest(false);
        } catch {
            setError('The message could not be sent.');
        } finally {
            setIsSending(false);
        }
    }

    async function resolveHelpRequest(messageId: string): Promise<void> {
        setError('');
        setIsResolvingMessageId(messageId);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/groups/{group_id}/messages/{message_id}/resolve',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { group_id: group.id, message_id: messageId },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('resolution unavailable');
            }
            onGroupUpdated(data.group);
        } catch {
            setError('The help request could not be updated.');
        } finally {
            setIsResolvingMessageId(null);
        }
    }

    async function vote(): Promise<void> {
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/learner/groups/{group_id}/admin-chat-vote',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { group_id: group.id },
                    },
                },
            );
            if (!response.ok || !data) {
                throw new Error('vote unavailable');
            }
            onGroupUpdated(data.group);
        } catch {
            setError('The vote could not be saved.');
        }
    }

    return (
        <article className="grid gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {group.member_count} members
                    </p>
                </div>
                <button
                    className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium transition hover:bg-slate-200 disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20"
                    disabled={
                        group.admin_chat_visible ||
                        group.current_user_voted_for_admin_chat
                    }
                    onClick={() => void vote()}
                    type="button"
                >
                    {group.admin_chat_visible
                        ? 'Admin view allowed'
                        : group.current_user_voted_for_admin_chat
                          ? 'Voted'
                          : `Vote ${group.admin_chat_vote_count}/${group.admin_chat_required_votes}`}
                </button>
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
                                <p className="font-medium">{message.user.name}</p>
                                {message.is_help_request ? (
                                    <span className="rounded-full border border-amber-300/70 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-200/30 dark:text-amber-200">
                                        {message.resolved_at
                                            ? 'Help request resolved'
                                            : 'Help requested'}
                                    </span>
                                ) : null}
                            </div>
                            <time dateTime={message.created_at}>
                                {formatMessageTime(message.created_at)}
                            </time>
                        </div>
                        <p className="mt-1 leading-6 whitespace-pre-wrap">
                            {message.body}
                        </p>
                        {message.is_help_request && message.resolved_at ? (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                Marked resolved by {message.resolved_by?.name ?? 'Unknown'}.
                            </p>
                        ) : null}
                        {message.can_resolve ? (
                            <button
                                className="mt-2 rounded px-2 py-1 text-sm transition hover:bg-black/10 dark:hover:bg-white/10"
                                disabled={isResolvingMessageId === message.id}
                                onClick={() =>
                                    void resolveHelpRequest(message.id)
                                }
                                type="button"
                            >
                                {isResolvingMessageId === message.id
                                    ? 'Updating…'
                                    : 'Mark resolved'}
                            </button>
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
                    Ask the group for help
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    This labels your message as a request that another member can mark resolved.
                </p>
            </div>
            <div className="flex gap-2">
                <input
                    aria-label="Message the group"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-slate-950"
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void sendMessage();
                        }
                    }}
                    placeholder="Message the group"
                    value={body}
                />
                <button
                    aria-label="Send message"
                    className="grid size-10 place-items-center rounded-md bg-cyan-700 text-white transition hover:bg-cyan-800 disabled:opacity-50"
                    disabled={isSending || body.trim() === ''}
                    onClick={() => void sendMessage()}
                    type="button"
                >
                    <Send className="size-4" />
                </button>
            </div>
            {error ? (
                <p className="text-sm text-red-600 dark:text-red-300" role="alert">
                    {error}
                </p>
            ) : null}
        </article>
    );
}

function formatMessageTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
