import { Copy, KeyRound, Plus, Shield, Trash2, Users, X } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type AdminUsers = components['schemas']['AdminUsers'];
type AdminUser = components['schemas']['AdminUser'];
type RegistrationToken = components['schemas']['AdminRegistrationToken'];

type AccessForm = {
    bannedUntil: string;
    loginDisabled: boolean;
    roles: string[];
};

/**
 * Source-adapted from `AdminUsersPanel` in the Laravel settings page. The
 * original information hierarchy and interactions are retained; only Inertia
 * form visits are replaced with the typed Rust API contract.
 */
export function OriginalAdminUsersPage({
    appearance,
    currentSubjectId,
}: {
    appearance: OriginalAppearance;
    currentSubjectId: string;
}) {
    const [data, setData] = useState<AdminUsers | null>(null);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [formOverrides, setFormOverrides] = useState<
        Record<string, Partial<AccessForm>>
    >({});
    const [creatingToken, setCreatingToken] = useState(false);
    const [tokenRoles, setTokenRoles] = useState<string[]>([]);
    const [tokenRoleToAdd, setTokenRoleToAdd] = useState('');
    const [tokenExpiresAt, setTokenExpiresAt] = useState('');
    const [tokenNote, setTokenNote] = useState('');
    const [createdToken, setCreatedToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const users = data?.users ?? [];
    const assignableRoles = data?.assignable_roles ?? [];
    const defaultForms = useMemo(
        () =>
            Object.fromEntries(
                users.map((user) => [
                    user.subject_id,
                    {
                        bannedUntil: toDateTimeLocal(user.banned_until),
                        loginDisabled: user.is_login_disabled,
                        roles: user.roles,
                    },
                ]),
            ) as Record<string, AccessForm>,
        [users],
    );
    const forms = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(defaultForms).map(([subjectId, form]) => [
                    subjectId,
                    { ...form, ...formOverrides[subjectId] },
                ]),
            ) as Record<string, AccessForm>,
        [defaultForms, formOverrides],
    );
    const unusedTokenCount = useMemo(
        () =>
            (data?.registration_tokens ?? []).filter(
                (token) => !token.is_used && !token.is_expired,
            ).length,
        [data],
    );

    function load(): void {
        setLoading(true);
        void apiClient
            .GET('/admin/users')
            .then(({ data: responseData, response }) => {
                if (response.status === 403 || response.status === 404) {
                    setForbidden(true);
                    return;
                }
                if (!response.ok || !responseData) {
                    throw new Error('unavailable');
                }
                setData(responseData);
                setFormOverrides({});
                setTokenRoles((current) =>
                    current.length > 0
                        ? current
                        : [responseData.assignable_roles[0] ?? 'learner'],
                );
                setTokenRoleToAdd(
                    (current) =>
                        current ||
                        responseData.assignable_roles[0] ||
                        'learner',
                );
            })
            .catch(() =>
                setError('User administration is temporarily unavailable.'),
            )
            .finally(() => setLoading(false));
    }

    useEffect(load, []);

    function updateForm(subjectId: string, next: Partial<AccessForm>): void {
        setFormOverrides((current) => ({
            ...current,
            [subjectId]: { ...current[subjectId], ...next },
        }));
    }

    function resetTokenCreation(): void {
        setCreatingToken(false);
        setTokenRoles([assignableRoles[0] ?? 'learner']);
        setTokenRoleToAdd(assignableRoles[0] ?? 'learner');
        setTokenExpiresAt('');
        setTokenNote('');
    }

    async function createToken(): Promise<void> {
        setSaving(true);
        setError('');
        try {
            const csrfToken = await getCsrfToken();
            const { data: responseData, response } = await apiClient.POST(
                '/registration-tokens',
                {
                    body: {
                        expires_at: tokenExpiresAt
                            ? new Date(tokenExpiresAt).toISOString()
                            : null,
                        note: tokenNote.trim() || null,
                        roles: tokenRoles,
                    },
                    params: { header: { 'X-CSRF-Token': csrfToken } },
                },
            );
            if (!response.ok || !responseData) {
                throw new Error('invalid token');
            }
            setCreatedToken(responseData.token);
            resetTokenCreation();
            load();
        } catch {
            setError(
                'The registration token could not be created. Check its roles and expiry date.',
            );
        } finally {
            setSaving(false);
        }
    }

    async function saveAccess(user: AdminUser): Promise<void> {
        const form = forms[user.subject_id];
        if (!form || !hasChanges(form, defaultForms[user.subject_id])) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            const csrfToken = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/admin/users/{subject_id}/access',
                {
                    body: {
                        banned_until: form.bannedUntil
                            ? new Date(form.bannedUntil).toISOString()
                            : null,
                        login_disabled: form.loginDisabled,
                        roles: form.roles,
                    },
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: { subject_id: user.subject_id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('access unavailable');
            }
            load();
        } catch {
            setError('The account access changes could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    async function deleteUser(user: AdminUser): Promise<void> {
        if (!window.confirm(`Delete ${user.name}? This cannot be undone.`)) {
            return;
        }
        setSaving(true);
        setError('');
        try {
            const csrfToken = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/users/{subject_id}',
                {
                    params: {
                        header: { 'X-CSRF-Token': csrfToken },
                        path: { subject_id: user.subject_id },
                    },
                },
            );
            if (!response.ok) {
                throw new Error('delete unavailable');
            }
            setSelectedUser(null);
            load();
        } catch {
            setError('The account could not be deleted.');
        } finally {
            setSaving(false);
        }
    }

    async function copyCreatedToken(): Promise<void> {
        if (!createdToken) {
            return;
        }
        try {
            await navigator.clipboard.writeText(createdToken);
        } catch {
            setError(
                'Copy the displayed token manually before closing this page.',
            );
        }
    }

    if (forbidden) {
        return <Navigate replace to="/home" />;
    }

    return (
        <main
            className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100"
            style={settingsStyle(appearance)}
        >
            <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Link
                            className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]"
                            to="/home"
                        >
                            Settings
                        </Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            Administration
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Users
                        </h1>
                    </div>
                </header>

                <section className="grid min-h-0 flex-1 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)]">
                    <div className="flex min-h-0 flex-col p-4 sm:p-5">
                        <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                                    <Users className="size-5" />
                                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                                        Users
                                    </h2>
                                </div>
                                <p className="max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                                    Manage registration tokens and account
                                    access. Token plaintext is shown only once
                                    after creation.
                                </p>
                            </div>
                            <button
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-[var(--settings-accent-foreground)] disabled:opacity-50"
                                disabled={loading || saving}
                                onClick={() => setCreatingToken(true)}
                                type="button"
                            >
                                <Plus className="size-4" />
                                Create token
                            </button>
                        </div>

                        {createdToken ? (
                            <section className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--settings-accent)_12%,transparent)] p-4">
                                <p className="text-sm font-medium">
                                    New registration token
                                </p>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                    <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-[var(--settings-content-background)] px-3 py-2 text-sm">
                                        {createdToken}
                                    </code>
                                    <button
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium"
                                        onClick={() => void copyCreatedToken()}
                                        type="button"
                                    >
                                        <Copy className="size-4" />
                                        Copy
                                    </button>
                                </div>
                            </section>
                        ) : null}

                        {loading ? (
                            <p className="py-8 text-sm text-[var(--settings-muted-text)]">
                                Loading users...
                            </p>
                        ) : null}
                        {!loading ? (
                            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                    <Metric
                                        label="Registered users"
                                        value={users.length}
                                    />
                                    <Metric
                                        label="Unused tokens"
                                        value={unusedTokenCount}
                                    />
                                    <Metric
                                        label="Blocked users"
                                        value={
                                            users.filter(
                                                (user) =>
                                                    user.is_login_disabled ||
                                                    user.is_currently_banned,
                                            ).length
                                        }
                                    />
                                </div>
                                <section className="mt-5 overflow-hidden rounded-lg border border-[var(--settings-border-color)]">
                                    <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] gap-3 bg-[var(--settings-active-background)] px-4 py-3 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase lg:grid">
                                        <span>User</span>
                                        <span>Roles</span>
                                        <span>Status</span>
                                        <span>Ban until</span>
                                        <span>Actions</span>
                                    </div>
                                    <div className="divide-y divide-[var(--settings-border-color)]">
                                        {users.map((user) => {
                                            const form = forms[user.subject_id];
                                            const isCurrentUser =
                                                user.subject_id ===
                                                currentSubjectId;
                                            return (
                                                <article
                                                    className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,1fr)_150px_minmax(0,1fr)_180px] lg:items-center"
                                                    key={user.subject_id}
                                                >
                                                    <button
                                                        className="min-w-0 text-left focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                                                        onClick={() =>
                                                            setSelectedUser(
                                                                user,
                                                            )
                                                        }
                                                        type="button"
                                                    >
                                                        <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">
                                                            {user.name}
                                                        </span>
                                                        <span className="block truncate text-xs text-[var(--settings-muted-text)]">
                                                            {user.email}
                                                        </span>
                                                    </button>
                                                    <RoleEditor
                                                        assignableRoles={
                                                            assignableRoles
                                                        }
                                                        disabled={
                                                            isCurrentUser ||
                                                            !data?.can_update_users
                                                        }
                                                        idPrefix={`user-${user.subject_id}`}
                                                        onChange={(roles) =>
                                                            updateForm(
                                                                user.subject_id,
                                                                { roles },
                                                            )
                                                        }
                                                        roleToAdd={
                                                            firstAddableRole(
                                                                assignableRoles,
                                                                form?.roles ??
                                                                    user.roles,
                                                            ) ??
                                                            assignableRoles[0]
                                                        }
                                                        roles={
                                                            form?.roles ??
                                                            user.roles
                                                        }
                                                    />
                                                    <div className="flex flex-col gap-2">
                                                        <StatusBadges
                                                            user={user}
                                                        />
                                                        <LoginToggle
                                                            disabled={
                                                                isCurrentUser ||
                                                                !data?.can_update_users
                                                            }
                                                            isDisabled={
                                                                form?.loginDisabled ??
                                                                false
                                                            }
                                                            onChange={(
                                                                loginDisabled,
                                                            ) =>
                                                                updateForm(
                                                                    user.subject_id,
                                                                    {
                                                                        loginDisabled,
                                                                    },
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                    <label className="grid gap-1">
                                                        <span className="text-xs lg:hidden">
                                                            Ban until
                                                        </span>
                                                        <input
                                                            className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm"
                                                            disabled={
                                                                isCurrentUser ||
                                                                !data?.can_update_users
                                                            }
                                                            onChange={(event) =>
                                                                updateForm(
                                                                    user.subject_id,
                                                                    {
                                                                        bannedUntil:
                                                                            event
                                                                                .currentTarget
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                            type="datetime-local"
                                                            value={
                                                                form?.bannedUntil ??
                                                                ''
                                                            }
                                                        />
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            className="rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium disabled:opacity-50"
                                                            disabled={
                                                                isCurrentUser ||
                                                                saving ||
                                                                !data?.can_update_users ||
                                                                !form ||
                                                                !hasChanges(
                                                                    form,
                                                                    defaultForms[
                                                                        user
                                                                            .subject_id
                                                                    ],
                                                                )
                                                            }
                                                            onClick={() =>
                                                                void saveAccess(
                                                                    user,
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-red-400 dark:text-slate-950"
                                                            disabled={
                                                                isCurrentUser ||
                                                                saving ||
                                                                !data?.can_delete_users
                                                            }
                                                            onClick={() =>
                                                                void deleteUser(
                                                                    user,
                                                                )
                                                            }
                                                            type="button"
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                                <TokenList
                                    tokens={data?.registration_tokens ?? []}
                                />
                            </div>
                        ) : null}
                        {error ? (
                            <p
                                className="mt-3 text-sm text-red-600 dark:text-red-300"
                                role="alert"
                            >
                                {error}
                            </p>
                        ) : null}
                    </div>
                </section>
            </div>

            {creatingToken ? (
                <Modal
                    title="Create registration token"
                    description="Choose the roles this one-use token grants, optionally set an expiration date, and add a note for later reference."
                    onClose={resetTokenCreation}
                >
                    <div className="grid gap-4">
                        <RoleEditor
                            assignableRoles={assignableRoles}
                            idPrefix="token"
                            onChange={setTokenRoles}
                            roleToAdd={tokenRoleToAdd}
                            roles={tokenRoles}
                            setRoleToAdd={setTokenRoleToAdd}
                        />
                        <Field label="Expires at">
                            <input
                                className="rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-input-background)] px-3 py-2 text-sm"
                                onChange={(event) =>
                                    setTokenExpiresAt(event.currentTarget.value)
                                }
                                type="datetime-local"
                                value={tokenExpiresAt}
                            />
                        </Field>
                        <Field label="Note (optional)">
                            <textarea
                                className="min-h-20 resize-y rounded-md border border-[var(--settings-border-color)] bg-transparent px-3 py-2 text-sm"
                                maxLength={500}
                                onChange={(event) =>
                                    setTokenNote(event.currentTarget.value)
                                }
                                placeholder="For example: biology pilot group"
                                value={tokenNote}
                            />
                        </Field>
                    </div>
                    <footer className="mt-5 flex flex-wrap justify-end gap-2">
                        <button
                            className="rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium"
                            onClick={resetTokenCreation}
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            className="inline-flex items-center gap-2 rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-[var(--settings-accent-foreground)] disabled:opacity-50"
                            disabled={saving}
                            onClick={() => void createToken()}
                            type="button"
                        >
                            <Plus className="size-4" />
                            Create
                        </button>
                    </footer>
                </Modal>
            ) : null}
            {selectedUser ? (
                <Modal
                    title={selectedUser.name}
                    description="Read-only account and registration-token audit details."
                    onClose={() => setSelectedUser(null)}
                >
                    <UserDetails
                        user={selectedUser}
                        token={
                            (data?.registration_tokens ?? []).find(
                                (token) =>
                                    token.used_by?.subject_id ===
                                    selectedUser.subject_id,
                            ) ?? null
                        }
                    />
                </Modal>
            ) : null}
        </main>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] p-4">
            <p className="text-2xl font-semibold text-slate-950 dark:text-white">
                {value}
            </p>
            <p className="mt-1 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                {label}
            </p>
        </div>
    );
}
function Field({
    children,
    label,
}: {
    children: React.ReactNode;
    label: string;
}) {
    return (
        <label className="grid gap-1">
            <span className="text-sm font-medium">{label}</span>
            {children}
        </label>
    );
}

function RoleEditor({
    assignableRoles,
    disabled = false,
    idPrefix,
    onChange,
    roleToAdd,
    roles,
    setRoleToAdd,
}: {
    assignableRoles: string[];
    disabled?: boolean;
    idPrefix: string;
    onChange: (roles: string[]) => void;
    roleToAdd?: string;
    roles: string[];
    setRoleToAdd?: (role: string) => void;
}) {
    const [internalRole, setInternalRole] = useState(
        firstAddableRole(assignableRoles, roles) ??
            assignableRoles[0] ??
            'learner',
    );
    const selectedRole = roleToAdd ?? internalRole;
    const setSelectedRole = setRoleToAdd ?? setInternalRole;
    const addableRoles = assignableRoles.filter(
        (role) => !roles.includes(role),
    );
    return (
        <div className="grid gap-2">
            <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                    <span
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] px-2 py-1 text-xs font-medium"
                        key={role}
                    >
                        {roleLabel(role)}
                        {!disabled && roles.length > 1 ? (
                            <button
                                aria-label={`Remove ${roleLabel(role)} role`}
                                className="rounded text-[var(--settings-muted-text)] hover:text-red-600"
                                onClick={() =>
                                    onChange(
                                        roles.filter((entry) => entry !== role),
                                    )
                                }
                                type="button"
                            >
                                <X className="size-3" />
                            </button>
                        ) : null}
                    </span>
                ))}
            </div>
            {!disabled && addableRoles.length > 0 ? (
                <div className="flex gap-2">
                    <select
                        className="h-9 min-w-0 flex-1 rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] px-3 text-sm"
                        id={`${idPrefix}-role`}
                        onChange={(event) =>
                            setSelectedRole(event.currentTarget.value)
                        }
                        value={selectedRole}
                    >
                        {addableRoles.map((role) => (
                            <option key={role} value={role}>
                                {roleLabel(role)}
                            </option>
                        ))}
                    </select>
                    <button
                        className="rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium"
                        onClick={() => {
                            if (selectedRole && !roles.includes(selectedRole))
                                onChange([...roles, selectedRole]);
                        }}
                        type="button"
                    >
                        Add
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function LoginToggle({
    disabled,
    isDisabled,
    onChange,
}: {
    disabled: boolean;
    isDisabled: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="inline-grid grid-cols-2 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] p-1 text-xs font-medium">
            <button
                className={`rounded-md px-2 py-1.5 transition ${!isDisabled ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm' : 'text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]'}`}
                disabled={disabled}
                onClick={() => onChange(false)}
                type="button"
            >
                Enabled
            </button>
            <button
                className={`rounded-md px-2 py-1.5 transition ${isDisabled ? 'bg-red-600 text-white shadow-sm dark:bg-red-400 dark:text-slate-950' : 'text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]'}`}
                disabled={disabled}
                onClick={() => onChange(true)}
                type="button"
            >
                Disabled
            </button>
        </div>
    );
}
function StatusBadges({ user }: { user: AdminUser }) {
    return !user.is_login_disabled && !user.is_currently_banned ? (
        <span className="w-fit rounded-md bg-[var(--settings-active-background)] px-2 py-1 text-xs font-medium">
            Active
        </span>
    ) : (
        <div className="flex flex-wrap gap-1">
            {user.is_login_disabled ? (
                <span className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white dark:bg-red-400 dark:text-slate-950">
                    Disabled
                </span>
            ) : null}
            {user.is_currently_banned ? (
                <span className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white dark:bg-red-400 dark:text-slate-950">
                    Banned
                </span>
            ) : null}
        </div>
    );
}

function TokenList({ tokens }: { tokens: RegistrationToken[] }) {
    return (
        <section className="mt-5 rounded-lg border border-[var(--settings-border-color)] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-950 dark:text-white">
                <KeyRound className="size-4 text-[var(--settings-accent)]" />
                Latest registration tokens
            </div>
            <div className="grid gap-2">
                {tokens.length === 0 ? (
                    <p className="text-sm text-[var(--settings-muted-text)]">
                        No registration tokens have been created.
                    </p>
                ) : (
                    tokens.map((token) => (
                        <div
                            className="flex flex-col gap-2 rounded-md bg-[var(--settings-active-background)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                            key={token.id}
                        >
                            <div>
                                <span className="font-medium">
                                    Token #{token.id.slice(0, 8)}
                                </span>
                                <span className="ml-2 text-[var(--settings-muted-text)]">
                                    created by{' '}
                                    {token.created_by?.name ?? 'Unknown'}
                                </span>
                                {token.note ? (
                                    <p className="mt-1 max-w-xl text-xs text-[var(--settings-muted-text)]">
                                        {token.note}
                                    </p>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-wrap gap-1">
                                    {token.roles.map((role) => (
                                        <span
                                            className="rounded border border-[var(--settings-border-color)] px-2 py-1 text-xs"
                                            key={role}
                                        >
                                            {roleLabel(role)}
                                        </span>
                                    ))}
                                </div>
                                <span className="rounded-md bg-[var(--settings-content-background)] px-2 py-1 text-xs">
                                    {token.is_expired
                                        ? 'Expired'
                                        : token.is_used
                                          ? 'Used'
                                          : 'Unused'}
                                </span>
                                <time
                                    className="text-xs text-[var(--settings-muted-text)]"
                                    dateTime={token.created_at}
                                >
                                    {formatDate(token.created_at)}
                                </time>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

function UserDetails({
    token,
    user,
}: {
    token: RegistrationToken | null;
    user: AdminUser;
}) {
    return (
        <div className="grid gap-4 text-sm">
            <section className="grid gap-2 rounded-lg border border-[var(--settings-border-color)] p-4">
                <Detail label="Email" value={user.email} />
                <Detail label="Created" value={formatDate(user.created_at)} />
                <Detail
                    label="Roles"
                    value={user.roles.map(roleLabel).join(', ')}
                />
                <Detail
                    label="Login"
                    value={user.is_login_disabled ? 'Disabled' : 'Enabled'}
                />
                <Detail
                    label="Ban until"
                    value={formatDate(user.banned_until)}
                />
            </section>
            <section className="rounded-lg border border-[var(--settings-border-color)] p-4">
                <div className="mb-3 flex items-center gap-2 font-medium">
                    <KeyRound className="size-4 text-[var(--settings-accent)]" />
                    Registration token
                </div>
                {token ? (
                    <div className="grid gap-2">
                        <Detail
                            label="Roles"
                            value={token.roles.map(roleLabel).join(', ')}
                        />
                        <Detail
                            label="Note"
                            value={token.note ?? 'No note added'}
                        />
                        <Detail
                            label="Expires"
                            value={formatDate(token.expires_at)}
                        />
                        <Detail
                            label="Created by"
                            value={
                                token.created_by
                                    ? `${token.created_by.name} (${token.created_by.email})`
                                    : 'Unknown'
                            }
                        />
                        <Detail
                            label="Used"
                            value={formatDate(token.used_at)}
                        />
                    </div>
                ) : (
                    <p className="text-[var(--settings-muted-text)]">
                        No registration token is linked to this account.
                    </p>
                )}
            </section>
            <section className="rounded-lg border border-[var(--settings-border-color)] p-4">
                <div className="mb-3 flex items-center gap-2 font-medium">
                    <Shield className="size-4 text-[var(--settings-accent)]" />
                    Access history
                </div>
                {user.access_history.length > 0 ? (
                    <div className="grid gap-3">
                        {user.access_history.map((event) => (
                            <div
                                className="rounded-md bg-[var(--settings-active-background)] p-3 text-sm"
                                key={event.id}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-medium">
                                        {event.action === 'access_updated'
                                            ? 'Access updated'
                                            : event.action.replaceAll('_', ' ')}
                                    </span>
                                    <time
                                        className="text-xs text-[var(--settings-muted-text)]"
                                        dateTime={event.created_at}
                                    >
                                        {formatDate(event.created_at)}
                                    </time>
                                </div>
                                <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                    By {event.actor?.name ?? 'Former user'}
                                </p>
                                <div className="mt-2 grid gap-1 text-xs">
                                    {event.changes.map((change) => (
                                        <p key={change.label}>
                                            <span className="font-medium">
                                                {change.label}:
                                            </span>{' '}
                                            {change.before} → {change.after}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-[var(--settings-muted-text)]">
                        No access or security changes recorded yet.
                    </p>
                )}
            </section>
        </div>
    );
}
function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                {label}
            </dt>
            <dd className="min-w-0 break-words text-slate-800 dark:text-slate-100">
                {value}
            </dd>
        </div>
    );
}
function Modal({
    children,
    description,
    onClose,
    title,
}: {
    children: React.ReactNode;
    description: string;
    onClose: () => void;
    title: string;
}) {
    return (
        <div
            aria-modal="true"
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
            role="dialog"
        >
            <section className="max-h-[90svh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-5 text-slate-950 shadow-xl dark:text-slate-100">
                <header className="mb-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">{title}</h2>
                            <p className="mt-1 text-sm leading-6 text-[var(--settings-muted-text)]">
                                {description}
                            </p>
                        </div>
                        <button
                            aria-label="Close"
                            className="rounded p-1 text-[var(--settings-muted-text)] hover:text-slate-950 dark:hover:text-white"
                            onClick={onClose}
                            type="button"
                        >
                            <X className="size-5" />
                        </button>
                    </div>
                </header>
                {children}
            </section>
        </div>
    );
}

function firstAddableRole(
    assignableRoles: string[],
    roles: string[],
): string | null {
    return assignableRoles.find((role) => !roles.includes(role)) ?? null;
}
function hasChanges(
    current: AccessForm,
    initial: AccessForm | undefined,
): boolean {
    if (!initial) return false;
    return (
        current.bannedUntil !== initial.bannedUntil ||
        current.loginDisabled !== initial.loginDisabled ||
        [...current.roles].sort().join(',') !==
            [...initial.roles].sort().join(',')
    );
}
function roleLabel(role: string): string {
    return role
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
        .join(' ');
}
function formatDate(value: string | null): string {
    return value
        ? new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Not set';
}
function toDateTimeLocal(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
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
        '--settings-input-background': dark ? 'rgb(2 6 23 / 38%)' : '#ffffff',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
    } as CSSProperties;
}
