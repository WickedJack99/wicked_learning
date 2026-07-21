import { Send, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatMessageTime } from '@/features/messages/message-time';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { postJson } from './api';

type GroupMessage = {
    body: string;
    createdAt: string | null;
    id: number;
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

export function GroupControl({
    groups,
    isOpen,
    onClose,
    onGroupUpdated,
    onOpen,
}: {
    groups: LearningGroup[];
    isOpen: boolean;
    onClose: () => void;
    onGroupUpdated: (group: LearningGroup) => void;
    onOpen: () => void;
}) {
    const t = usePlatformTranslation();

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
                    className="absolute top-4 right-4 z-40 grid max-h-[calc(100svh-2rem)] w-[min(28rem,calc(100%-2rem))] gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/94 p-4 text-slate-950 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/92 dark:text-slate-100"
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
                    <div className="min-h-0 overflow-y-auto">
                        {groups.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                                {t(
                                    'world.groups.empty',
                                    'You are not assigned to a group yet.',
                                )}
                            </p>
                        ) : (
                            <div className="grid gap-3">
                                {groups.map((group) => (
                                    <GroupChatCard
                                        group={group}
                                        key={group.id}
                                        onGroupUpdated={onGroupUpdated}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
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
                { body: message },
            );
            onGroupUpdated(response.group);
            setBody('');
        } catch {
            setError('The message could not be sent.');
        } finally {
            setIsSending(false);
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
                            <p className="font-medium">
                                {message.user?.name ?? 'Unknown user'}
                            </p>
                            <time dateTime={message.createdAt ?? undefined}>
                                {formatMessageTime(message.createdAt)}
                            </time>
                        </div>
                        <p className="mt-1 leading-6 whitespace-pre-wrap">
                            {message.body}
                        </p>
                    </div>
                ))}
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
                    disabled={isSending || body.trim() === ''}
                    onClick={() => void sendMessage()}
                    size="icon"
                    type="button"
                >
                    <Send className="size-4" />
                </Button>
            </div>
            {error ? (
                <p className="text-sm text-red-600 dark:text-red-300">
                    {error}
                </p>
            ) : null}
        </article>
    );
}
