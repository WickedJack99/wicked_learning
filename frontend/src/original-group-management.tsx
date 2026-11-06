import { MessageSquareText, Plus, Save, Users } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type Group = components['schemas']['AdminLearningGroup'];
type User = components['schemas']['AdminLearningGroupUser'];
type GroupForm = {
    description: string;
    name: string;
    slug: string;
    study_topic: string;
};

/**
 * Source-adapted from `access-group-management-panel.tsx`. Its original
 * Inertia props/actions are replaced only by the typed Rust administration
 * contract; labels, information hierarchy and consent preview remain source
 * behavior.
 */
export function OriginalGroupManagementPage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string | 'new'>('new');
    const [form, setForm] = useState<GroupForm>(blankForm());
    const [memberIds, setMemberIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
    const sortedUsers = useMemo(
        () => [...users].sort((left, right) => left.name.localeCompare(right.name)),
        [users],
    );
    const hasGroupChanges = JSON.stringify(form) !== JSON.stringify(selectedGroup ? formFromGroup(selectedGroup) : blankForm());
    const hasMemberChanges = JSON.stringify(sortedIds(memberIds)) !== JSON.stringify(sortedIds(selectedGroup?.member_ids ?? []));

    useEffect(() => {
        let active = true;
        void apiClient.GET('/admin/learning-groups').then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) {
                setError('Learning group administration is temporarily unavailable.');
                return;
            }
            setGroups(data.groups);
            setUsers(data.users);
            const first = data.groups[0] ?? null;
            selectGroup(first, setSelectedGroupId, setForm, setMemberIds);
        }).catch(() => {
            if (active) setError('Learning group administration is temporarily unavailable.');
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, []);

    function chooseGroup(group: Group | null): void {
        selectGroup(group, setSelectedGroupId, setForm, setMemberIds);
        setError('');
    }

    function applyGroup(group: Group): void {
        setGroups((current) => {
            const exists = current.some((entry) => entry.id === group.id);
            const next = exists
                ? current.map((entry) => entry.id === group.id ? group : entry)
                : [...current, group];
            return [...next].sort((left, right) => left.name.localeCompare(right.name));
        });
        chooseGroup(group);
    }

    async function saveGroup(): Promise<void> {
        if (!hasGroupChanges || saving) return;
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const request = { body: form, params: { header: { 'X-CSRF-Token': token } } };
            const result = selectedGroup
                ? await apiClient.PATCH('/admin/learning-groups/{group_id}', {
                    ...request,
                    params: { ...request.params, path: { group_id: selectedGroup.id } },
                })
                : await apiClient.POST('/admin/learning-groups', request);
            if (!result.response.ok || !result.data) throw new Error('group unavailable');
            applyGroup(result.data.group);
        } catch {
            setError('The group could not be saved. Check its name and optional slug.');
        } finally {
            setSaving(false);
        }
    }

    async function saveMembers(): Promise<void> {
        if (!selectedGroup || !hasMemberChanges || saving) return;
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/admin/learning-groups/{group_id}/members',
                {
                    body: { member_ids: memberIds },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { group_id: selectedGroup.id },
                    },
                },
            );
            if (!response.ok || !data) throw new Error('members unavailable');
            applyGroup(data.group);
        } catch {
            setError('The group members could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    function toggleMember(userId: string, checked: boolean): void {
        setMemberIds((current) => checked
            ? [...new Set([...current, userId])]
            : current.filter((id) => id !== userId));
    }

    return (
        <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
            <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Link className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/home">
                            Settings
                        </Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Administration</p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Groups</h1>
                    </div>
                </header>
                <section className="grid min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)]">
                    <div className="flex min-h-0 flex-col p-4 sm:p-5">
                        <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]"><Users className="size-5" /><h2 className="text-lg font-semibold text-foreground">Groups</h2></div>
                                <p className="max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">Manage shared learner groups, memberships and admin-visible chat voting state.</p>
                            </div>
                            <button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-[var(--settings-accent-foreground)]" onClick={() => chooseGroup(null)} type="button"><Plus className="size-4" />New group</button>
                        </div>
                        {loading ? <p className="py-8 text-sm text-[var(--settings-muted-text)]">Loading groups...</p> : null}
                        {!loading ? <section className="grid min-h-0 flex-1 gap-4 pt-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
                            <div className="flex min-h-0 flex-col overflow-hidden">
                                <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto pr-1">
                                    <section className="grid gap-4 border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4">
                                        <div><h2 className="text-lg font-semibold">{selectedGroup ? selectedGroup.name : 'New group'}</h2><p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">Groups can share chat, activity state and selected map editing permissions.</p></div>
                                        <div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} /></Field><Field label="Slug"><input className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm" onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Generated from name" value={form.slug} /></Field></div>
                                        <Field label="Description"><textarea className="min-h-24 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm" onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></Field>
                                        <Field label="Study topic"><input className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm" onChange={(event) => setForm({ ...form, study_topic: event.target.value })} placeholder="What should this group study or build?" value={form.study_topic} /></Field>
                                    </section>
                                    <section className="grid gap-3 border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4"><div><h2 className="text-sm font-semibold">Members</h2><p className="mt-1 text-xs text-[var(--settings-muted-text)]">Assign any number of users to this group.</p></div><div className="grid max-h-80 gap-2 overflow-y-auto border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] p-3">{sortedUsers.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--settings-border-color)] p-3 text-sm text-[var(--settings-muted-text)]">No users available.</p> : null}{sortedUsers.map((user) => <label className="flex items-center gap-3 rounded-lg px-2 py-1 text-sm" key={user.id}><input checked={memberIds.includes(user.id)} className="size-4 accent-[var(--settings-accent)]" onChange={(event) => toggleMember(user.id, event.target.checked)} type="checkbox" /><span className="min-w-0"><span className="block truncate font-medium">{user.name}</span><span className="block truncate text-xs text-[var(--settings-muted-text)]">{user.email}</span></span></label>)}</div></section>
                                    {selectedGroup ? <AdminChatPreview group={selectedGroup} /> : null}
                                </div>
                                <footer className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--settings-border-color)] py-4"><button className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-[var(--settings-accent-foreground)] disabled:opacity-50" disabled={saving || !hasGroupChanges} onClick={() => void saveGroup()} type="button"><Save className="size-4" />Save group</button><button className="inline-flex items-center gap-2 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] disabled:opacity-50" disabled={!selectedGroup || saving || !hasMemberChanges} onClick={() => void saveMembers()} type="button"><Users className="size-4" />Save members</button></footer>
                            </div>
                            <aside className="grid h-full min-h-0 content-start gap-2 overflow-y-auto border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-3">{groups.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--settings-border-color)] p-4 text-sm text-[var(--settings-muted-text)]">No groups yet.</p> : null}{groups.map((group) => <button className={`rounded-lg border p-3 text-left text-sm transition ${selectedGroupId === group.id ? 'border-[var(--settings-accent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)]' : 'border-[var(--settings-border-color)] bg-[var(--settings-input-background)] hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)]'}`} key={group.id} onClick={() => chooseGroup(group)} type="button"><span className="block font-semibold">{group.name}</span><span className="mt-1 block text-xs text-[var(--settings-muted-text)]">{group.member_count} members</span></button>)}</aside>
                        </section> : null}
                        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p> : null}
                    </div>
                </section>
            </div>
        </main>
    );
}

function AdminChatPreview({ group }: { group: Group }) {
    return <section className="grid gap-3 border border-[var(--settings-border-color)] p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4" />Admin-visible chat</h2><p className="mt-1 text-xs text-[var(--settings-muted-text)]">{group.admin_chat_visible ? 'Members voted to allow admin viewing.' : group.admin_chat_visible_until ? `Visible until ${formatDate(group.admin_chat_visible_until)}. A newer member requires a new vote.` : 'Not visible until more than half of members vote to allow it.'}</p></div><span className="rounded-full bg-[color-mix(in_srgb,var(--settings-muted-text)_12%,transparent)] px-2 py-1 text-xs">{group.admin_chat_vote_count}/{group.admin_chat_required_votes}</span></div><div aria-label="Admin-visible group chat messages" className="grid h-72 content-start gap-2 overflow-y-auto overscroll-contain">{group.messages.length === 0 ? <p className="rounded-lg border border-dashed border-[var(--settings-border-color)] p-3 text-sm text-[var(--settings-muted-text)]">No admin-visible messages.</p> : null}{group.messages.map((message) => <article className="rounded-lg bg-[color-mix(in_srgb,var(--settings-muted-text)_12%,transparent)] p-3 text-sm" key={message.id}><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{message.user?.name ?? 'Unknown user'}</p><time className="text-xs text-[var(--settings-muted-text)]" dateTime={message.created_at}>{formatDate(message.created_at)}</time></div><p className="mt-1 leading-6 whitespace-pre-wrap">{message.body}</p></article>)}</div></section>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="grid gap-2"><span className="text-sm font-medium">{label}</span>{children}</label>; }
function blankForm(): GroupForm { return { description: '', name: '', slug: '', study_topic: '' }; }
function formFromGroup(group: Group): GroupForm { return { description: group.description ?? '', name: group.name, slug: group.slug, study_topic: group.study_topic ?? '' }; }
function sortedIds(ids: string[]): string[] { return [...ids].sort(); }
function selectGroup(group: Group | null, setSelected: (value: string | 'new') => void, setForm: (value: GroupForm) => void, setMembers: (value: string[]) => void): void { setSelected(group?.id ?? 'new'); setForm(group ? formFromGroup(group) : blankForm()); setMembers(group?.member_ids ?? []); }
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function settingsStyle(appearance: OriginalAppearance): CSSProperties { const dark = appearance === 'dark'; return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-accent-foreground': dark ? '#042f2e' : '#f8fafc', '--settings-active-background': dark ? 'rgb(45 212 191 / 10%)' : 'rgb(15 118 110 / 10%)', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-input-background': dark ? 'rgb(2 6 23 / 38%)' : '#ffffff', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-nested-sidebar-background': dark ? 'rgb(5 8 22 / 96%)' : 'rgb(248 250 252 / 96%)', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties; }
