import { router } from '@inertiajs/react';
import { MessageSquareText, Plus, Save, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMessageTime } from '@/features/messages/message-time';
import { cn } from '@/lib/utils';

export type AccessGroupUser = {
    email: string;
    id: number;
    name: string;
};

type GroupMessage = {
    body: string;
    createdAt: string | null;
    id: number;
    user: AccessGroupUser | null;
};

export type AccessLearningGroup = {
    adminChatRequiredVotes: number;
    adminChatVisible: boolean;
    adminChatVisibleUntil: string | null;
    adminChatVoteCount: number;
    description: string | null;
    id: number;
    memberCount: number;
    memberIds: number[];
    members: AccessGroupUser[];
    messages: GroupMessage[];
    name: string;
    slug: string;
    voteUserIds: number[];
};

type GroupForm = {
    description: string;
    name: string;
    slug: string;
};

export function AccessGroupManagementPanel({
    groups,
    users,
}: {
    groups: AccessLearningGroup[];
    users: AccessGroupUser[];
}) {
    const [selectedGroupId, setSelectedGroupId] = useState<number | 'new'>(
        groups[0]?.id ?? 'new',
    );
    const selectedGroup =
        groups.find((group) => group.id === selectedGroupId) ?? null;
    const [form, setForm] = useState<GroupForm>(() =>
        selectedGroup ? formFromGroup(selectedGroup) : blankForm(),
    );
    const [memberIds, setMemberIds] = useState<number[]>(
        () => selectedGroup?.memberIds ?? [],
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const sortedUsers = useMemo(
        () =>
            [...users].sort((left, right) =>
                left.name.localeCompare(right.name),
            ),
        [users],
    );

    const selectGroup = (group: AccessLearningGroup | null) => {
        setSelectedGroupId(group?.id ?? 'new');
        setForm(group ? formFromGroup(group) : blankForm());
        setMemberIds(group?.memberIds ?? []);
        setErrors({});
    };

    const saveGroup = () => {
        const isNew = selectedGroup === null;
        const url = isNew
            ? '/settings/groups'
            : `/settings/groups/${selectedGroup.id}`;

        setSaving(true);

        const options = {
            preserveScroll: true,
            onError: (nextErrors: Record<string, string>) =>
                setErrors(nextErrors),
            onSuccess: () => setErrors({}),
            onFinish: () => setSaving(false),
        };

        if (isNew) {
            router.post(url, form, options);

            return;
        }

        router.patch(url, form, options);
    };

    const saveMembers = () => {
        if (!selectedGroup) {
            return;
        }

        setSaving(true);
        router.patch(
            `/settings/groups/${selectedGroup.id}/members`,
            { user_ids: memberIds },
            {
                preserveScroll: true,
                onError: (nextErrors) => setErrors(nextErrors),
                onSuccess: () => setErrors({}),
                onFinish: () => setSaving(false),
            },
        );
    };

    const toggleMember = (userId: number, checked: boolean) => {
        setMemberIds((current) =>
            checked
                ? [...new Set([...current, userId])]
                : current.filter((id) => id !== userId),
        );
    };

    return (
        <div className="grid gap-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <div>
                    <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                        <Users className="size-5" />
                        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                            Groups
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Manage shared learner groups, memberships and
                        admin-visible chat voting state.
                    </p>
                </div>
                <Button onClick={() => selectGroup(null)} type="button">
                    <Plus className="size-4" />
                    New group
                </Button>
            </div>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <GroupEditor
                    errors={errors}
                    form={form}
                    memberIds={memberIds}
                    onFormChange={setForm}
                    onSaveGroup={saveGroup}
                    onSaveMembers={saveMembers}
                    onToggleMember={toggleMember}
                    saving={saving}
                    selectedGroup={selectedGroup}
                    users={sortedUsers}
                />

                <GroupList
                    groups={groups}
                    onSelect={selectGroup}
                    selectedGroupId={selectedGroupId}
                />
            </section>
        </div>
    );
}

function GroupEditor({
    errors,
    form,
    memberIds,
    onFormChange,
    onSaveGroup,
    onSaveMembers,
    onToggleMember,
    saving,
    selectedGroup,
    users,
}: {
    errors: Record<string, string>;
    form: GroupForm;
    memberIds: number[];
    onFormChange: (form: GroupForm) => void;
    onSaveGroup: () => void;
    onSaveMembers: () => void;
    onToggleMember: (userId: number, checked: boolean) => void;
    saving: boolean;
    selectedGroup: AccessLearningGroup | null;
    users: AccessGroupUser[];
}) {
    return (
        <div className="grid gap-5">
            <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-[#0b1117]/80">
                <div>
                    <h2 className="text-lg font-semibold">
                        {selectedGroup ? selectedGroup.name : 'New group'}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        Groups can share chat, activity state and selected map
                        editing permissions.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Name" message={errors.name}>
                        <Input
                            value={form.name}
                            onChange={(event) =>
                                onFormChange({
                                    ...form,
                                    name: event.target.value,
                                })
                            }
                        />
                    </Field>
                    <Field label="Slug" message={errors.slug}>
                        <Input
                            placeholder="Generated from name"
                            value={form.slug}
                            onChange={(event) =>
                                onFormChange({
                                    ...form,
                                    slug: event.target.value,
                                })
                            }
                        />
                    </Field>
                </div>

                <Field label="Description" message={errors.description}>
                    <textarea
                        className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950"
                        value={form.description}
                        onChange={(event) =>
                            onFormChange({
                                ...form,
                                description: event.target.value,
                            })
                        }
                    />
                </Field>

                <div className="flex flex-wrap gap-2">
                    <Button disabled={saving} onClick={onSaveGroup}>
                        <Save className="size-4" />
                        Save group
                    </Button>
                    <Button
                        disabled={!selectedGroup || saving}
                        onClick={onSaveMembers}
                        variant="secondary"
                    >
                        <Users className="size-4" />
                        Save members
                    </Button>
                </div>
            </section>

            <MembersPanel
                errors={errors}
                memberIds={memberIds}
                onToggleMember={onToggleMember}
                users={users}
            />

            {selectedGroup ? <AdminChatPreview group={selectedGroup} /> : null}
        </div>
    );
}

function MembersPanel({
    errors,
    memberIds,
    onToggleMember,
    users,
}: {
    errors: Record<string, string>;
    memberIds: number[];
    onToggleMember: (userId: number, checked: boolean) => void;
    users: AccessGroupUser[];
}) {
    return (
        <section className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-[#0b1117]/80">
            <div>
                <h2 className="text-sm font-semibold">Members</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Assign any number of users to this group.
                </p>
            </div>
            <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/70">
                {users.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No users available.
                    </p>
                ) : null}
                {users.map((user) => (
                    <label
                        className="flex items-center gap-3 rounded-lg px-2 py-1 text-sm"
                        key={user.id}
                    >
                        <Checkbox
                            checked={memberIds.includes(user.id)}
                            onCheckedChange={(checked) =>
                                onToggleMember(user.id, checked === true)
                            }
                        />
                        <span className="min-w-0">
                            <span className="block truncate font-medium">
                                {user.name}
                            </span>
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                {user.email}
                            </span>
                        </span>
                    </label>
                ))}
            </div>
            <InputError message={errors.user_ids ?? errors['user_ids.0']} />
        </section>
    );
}

function GroupList({
    groups,
    onSelect,
    selectedGroupId,
}: {
    groups: AccessLearningGroup[];
    onSelect: (group: AccessLearningGroup | null) => void;
    selectedGroupId: number | 'new';
}) {
    return (
        <aside className="grid content-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-[#0b1117]/80">
            {groups.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No groups yet.
                </p>
            ) : null}
            {groups.map((group) => (
                <button
                    className={cn(
                        'rounded-lg border p-3 text-left text-sm transition',
                        selectedGroupId === group.id
                            ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-950/50 dark:hover:border-white/20',
                    )}
                    key={group.id}
                    onClick={() => onSelect(group)}
                    type="button"
                >
                    <span className="block font-semibold">{group.name}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                        {group.memberCount} members
                    </span>
                </button>
            ))}
        </aside>
    );
}

function AdminChatPreview({ group }: { group: AccessLearningGroup }) {
    return (
        <section className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <MessageSquareText className="size-4" />
                        Admin-visible chat
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {group.adminChatVisible
                            ? 'Members voted to allow admin viewing.'
                            : group.adminChatVisibleUntil
                              ? `Visible until ${formatDate(group.adminChatVisibleUntil)}. A newer member requires a new vote.`
                              : 'Not visible until more than half of members vote to allow it.'}
                    </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-white/10">
                    {group.adminChatVoteCount}/{group.adminChatRequiredVotes}
                </span>
            </div>
            <div
                aria-label="Admin-visible group chat messages"
                className="grid h-72 content-start gap-2 overflow-y-auto overscroll-contain"
            >
                {group.messages.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                        No admin-visible messages.
                    </p>
                ) : null}
                {group.messages.map((message) => (
                    <article
                        className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-white/10"
                        key={message.id}
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="font-medium">
                                {message.user?.name ?? 'Unknown user'}
                            </p>
                            <time
                                className="text-xs text-slate-500 dark:text-slate-400"
                                dateTime={message.createdAt ?? undefined}
                            >
                                {formatMessageTime(message.createdAt)}
                            </time>
                        </div>
                        <p className="mt-1 leading-6 whitespace-pre-wrap">
                            {message.body}
                        </p>
                    </article>
                ))}
            </div>
        </section>
    );
}

function Field({
    children,
    label,
    message,
}: {
    children: ReactNode;
    label: string;
    message?: string;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={message} />
        </div>
    );
}

function blankForm(): GroupForm {
    return {
        description: '',
        name: '',
        slug: '',
    };
}

function formFromGroup(group: AccessLearningGroup): GroupForm {
    return {
        description: group.description ?? '',
        name: group.name,
        slug: group.slug,
    };
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
