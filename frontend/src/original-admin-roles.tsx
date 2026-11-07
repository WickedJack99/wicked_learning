import { Plus, Shield, Trash2 } from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type AdminRole = components['schemas']['AdminRole'];
type AdminRoles = components['schemas']['AdminRoles'];
type PermissionResource = components['schemas']['AdminPermissionResource'];
type PermissionLevel = 'none' | 'ro' | 'ru' | 'rud';
type PermissionScope = 'none' | 'own' | 'assigned' | 'group' | 'all';

type RoleForm = {
    description: string;
    level: string;
    name: string;
    permissionScopes: Record<string, PermissionScope>;
    permissions: Record<string, PermissionLevel>;
    roleKey: string;
};

/** Source-adapted from `RoleManagementPanel` in the Laravel settings page. */
export function OriginalAdminRolesPage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const [data, setData] = useState<AdminRoles | null>(null);
    const [selectedRoleKey, setSelectedRoleKey] = useState<string | 'new'>(
        'new',
    );
    const [form, setForm] = useState<RoleForm>(() => blankForm([]));
    const [loading, setLoading] = useState(true);
    const [forbidden, setForbidden] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const selectedRole =
        selectedRoleKey === 'new'
            ? null
            : (data?.roles.find((role) => role.role_key === selectedRoleKey) ??
              null);
    const baseline = useMemo(
        () => formFromRole(selectedRole, data?.permission_resources ?? []),
        [data?.permission_resources, selectedRole],
    );
    const hasChanges =
        JSON.stringify(normalizeForm(form)) !==
        JSON.stringify(normalizeForm(baseline));
    const groupedResources = useMemo(
        () => groupResources(data?.permission_resources ?? []),
        [data?.permission_resources],
    );

    function load(selectRoleKey?: string | 'new'): void {
        setLoading(true);
        void apiClient
            .GET('/admin/roles')
            .then(({ data: responseData, response }) => {
                if (response.status === 403 || response.status === 404) {
                    setForbidden(true);
                    return;
                }
                if (!response.ok || !responseData)
                    throw new Error('unavailable');
                setData(responseData);
                const key =
                    selectRoleKey ?? responseData.roles[0]?.role_key ?? 'new';
                const selected =
                    responseData.roles.find((role) => role.role_key === key) ??
                    null;
                setSelectedRoleKey(selected?.role_key ?? 'new');
                setForm(
                    formFromRole(selected, responseData.permission_resources),
                );
            })
            .catch(() =>
                setError('Role administration is temporarily unavailable.'),
            )
            .finally(() => setLoading(false));
    }

    useEffect(load, []);

    function selectRole(role: AdminRole): void {
        setSelectedRoleKey(role.role_key);
        setForm(formFromRole(role, data?.permission_resources ?? []));
        setError('');
    }

    function startCreate(): void {
        setSelectedRoleKey('new');
        setForm(blankForm(data?.permission_resources ?? []));
        setError('');
    }

    function updateForm(next: Partial<RoleForm>): void {
        setForm((current) => ({ ...current, ...next }));
    }

    function setPermission(resource: string, level: PermissionLevel): void {
        setForm((current) => ({
            ...current,
            permissions: { ...current.permissions, [resource]: level },
        }));
    }

    function setPermissionScope(
        resource: string,
        scope: PermissionScope,
    ): void {
        setForm((current) => ({
            ...current,
            permissionScopes: {
                ...current.permissionScopes,
                [resource]: scope,
            },
        }));
    }

    async function saveRole(): Promise<void> {
        if (!hasChanges || saving) return;
        setSaving(true);
        setError('');
        const body = {
            description: form.description.trim() || null,
            level: Number(form.level),
            name: form.name,
            permission_scopes: form.permissionScopes,
            permissions: form.permissions,
            role_key: selectedRole ? null : form.roleKey,
        };
        try {
            const token = await getCsrfToken();
            const result = selectedRole
                ? await apiClient.PATCH('/admin/roles/{role_key}', {
                      body,
                      params: {
                          header: { 'X-CSRF-Token': token },
                          path: { role_key: selectedRole.role_key },
                      },
                  })
                : await apiClient.POST('/admin/roles', {
                      body,
                      params: { header: { 'X-CSRF-Token': token } },
                  });
            if (!result.response.ok || !result.data) throw new Error('invalid');
            load(result.data.role.role_key);
        } catch {
            setError(
                'The role could not be saved. Check its name, key, level and permission values.',
            );
        } finally {
            setSaving(false);
        }
    }

    async function deleteRole(): Promise<void> {
        if (
            !selectedRole ||
            !window.confirm(`Delete role ${selectedRole.name}?`)
        )
            return;
        setSaving(true);
        setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE(
                '/admin/roles/{role_key}',
                {
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { role_key: selectedRole.role_key },
                    },
                },
            );
            if (!response.ok) throw new Error('unavailable');
            load();
        } catch {
            setError(
                selectedRole.is_system
                    ? 'Default system roles cannot be deleted.'
                    : 'The role could not be deleted.',
            );
        } finally {
            setSaving(false);
        }
    }

    if (forbidden) return <Navigate replace to="/home" />;

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
                            Roles
                        </h1>
                    </div>
                </header>
                <section className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 sm:p-5">
                    <div className="mb-5 flex shrink-0 items-start gap-3 border-b border-[var(--settings-border-color)] pb-5">
                        <Shield className="mt-0.5 size-5 text-[var(--settings-accent)]" />
                        <div>
                            <h2 className="text-lg font-semibold">
                                Access management
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                                Configure who can read, update or delete
                                administration areas. Default roles stay
                                available.
                            </p>
                        </div>
                    </div>
                    {loading ? (
                        <p className="py-8 text-sm text-[var(--settings-muted-text)]">
                            Loading roles...
                        </p>
                    ) : (
                        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
                            <aside className="flex min-h-0 flex-col rounded-lg border border-[var(--settings-border-color)]">
                                <div className="flex items-center justify-between border-b border-[var(--settings-border-color)] p-3">
                                    <div>
                                        <h3 className="text-sm font-semibold">
                                            Roles
                                        </h3>
                                        <p className="text-xs text-[var(--settings-muted-text)]">
                                            Select a role to inspect or edit.
                                        </p>
                                    </div>
                                    {data?.can_update_roles ? (
                                        <button
                                            aria-label="Create role"
                                            className="rounded-md bg-[var(--settings-accent)] p-2 text-[var(--settings-accent-foreground)]"
                                            onClick={startCreate}
                                            type="button"
                                        >
                                            <Plus className="size-4" />
                                        </button>
                                    ) : null}
                                </div>
                                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                                    {data?.roles.map((role) => (
                                        <button
                                            className={`mb-2 w-full rounded-lg border p-3 text-left transition ${selectedRoleKey === role.role_key ? 'border-[var(--settings-accent)] bg-[var(--settings-active-background)]' : 'border-[var(--settings-border-color)] bg-[var(--settings-active-background)] hover:border-[color-mix(in_srgb,var(--settings-accent)_42%,transparent)]'}`}
                                            key={role.role_key}
                                            onClick={() => selectRole(role)}
                                            type="button"
                                        >
                                            <span className="block text-sm font-medium">
                                                {role.name}
                                            </span>
                                            <span className="mt-1 block text-xs text-[var(--settings-muted-text)]">
                                                {role.role_key}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </aside>
                            <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--settings-border-color)]">
                                <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--settings-border-color)] p-4">
                                    <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                        {selectedRole ? 'Role' : 'New role'}
                                    </p>
                                    <h3 className="text-xl font-semibold">
                                        {selectedRole?.name ?? 'Create role'}
                                    </h3>
                                </div>
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                                    <div className="grid shrink-0 gap-3 sm:grid-cols-2">
                                        <Field label="Name">
                                            <input
                                                disabled={
                                                    !data?.can_update_roles
                                                }
                                                onChange={(event) =>
                                                    updateForm({
                                                        name: event
                                                            .currentTarget
                                                            .value,
                                                    })
                                                }
                                                value={form.name}
                                            />
                                        </Field>
                                        <Field label="Role key">
                                            <input
                                                disabled={
                                                    !data?.can_update_roles ||
                                                    Boolean(selectedRole)
                                                }
                                                onChange={(event) =>
                                                    updateForm({
                                                        roleKey:
                                                            event.currentTarget
                                                                .value,
                                                    })
                                                }
                                                value={form.roleKey}
                                            />
                                        </Field>
                                        <Field
                                            className="sm:col-span-2"
                                            label="Description"
                                        >
                                            <input
                                                disabled={
                                                    !data?.can_update_roles
                                                }
                                                onChange={(event) =>
                                                    updateForm({
                                                        description:
                                                            event.currentTarget
                                                                .value,
                                                    })
                                                }
                                                value={form.description}
                                            />
                                        </Field>
                                        <Field label="Assignment level">
                                            <input
                                                disabled={
                                                    !data?.can_update_roles
                                                }
                                                max="100"
                                                min="1"
                                                onChange={(event) =>
                                                    updateForm({
                                                        level: event
                                                            .currentTarget
                                                            .value,
                                                    })
                                                }
                                                type="number"
                                                value={form.level}
                                            />
                                        </Field>
                                    </div>
                                    <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--settings-border-color)]">
                                        <div className="hidden shrink-0 grid-cols-[minmax(12rem,1fr)_18rem_14rem] bg-[var(--settings-active-background)] px-4 py-3 text-xs font-medium tracking-[0.14em] text-[var(--settings-muted-text)] uppercase sm:grid">
                                            <span>Area</span>
                                            <span>Permission level</span>
                                            <span>Scope</span>
                                        </div>
                                        <div className="min-h-0 flex-1 overflow-y-auto">
                                            {groupedResources.map((group) => (
                                                <div key={group.name}>
                                                    <div className="border-t border-[var(--settings-border-color)] bg-[var(--settings-active-background)] px-4 py-2 text-xs font-semibold tracking-[0.14em] text-[var(--settings-muted-text)] uppercase">
                                                        {group.name}
                                                    </div>
                                                    {group.resources.map(
                                                        (resource) => (
                                                            <div
                                                                className="grid gap-3 border-t border-[var(--settings-border-color)] p-4 sm:grid-cols-[minmax(12rem,1fr)_18rem_14rem] sm:items-center"
                                                                key={
                                                                    resource.key
                                                                }
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-medium">
                                                                        {
                                                                            resource.label
                                                                        }
                                                                    </p>
                                                                    <p className="mt-1 text-xs leading-5 text-[var(--settings-muted-text)]">
                                                                        {
                                                                            resource.description
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <PermissionButtons
                                                                    disabled={
                                                                        !data?.can_update_roles
                                                                    }
                                                                    level={
                                                                        form
                                                                            .permissions[
                                                                            resource
                                                                                .key
                                                                        ] ??
                                                                        'none'
                                                                    }
                                                                    onChange={(
                                                                        level,
                                                                    ) =>
                                                                        setPermission(
                                                                            resource.key,
                                                                            level,
                                                                        )
                                                                    }
                                                                />
                                                                <ScopeSelect
                                                                    disabled={
                                                                        !data?.can_update_roles
                                                                    }
                                                                    onChange={(
                                                                        scope,
                                                                    ) =>
                                                                        setPermissionScope(
                                                                            resource.key,
                                                                            scope,
                                                                        )
                                                                    }
                                                                    scope={
                                                                        form
                                                                            .permissionScopes[
                                                                            resource
                                                                                .key
                                                                        ] ??
                                                                        'all'
                                                                    }
                                                                />
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-2 rounded-lg bg-[var(--settings-active-background)] p-3 text-xs leading-5 text-[var(--settings-muted-text)]">
                                        <p>
                                            <strong>RO</strong>: read only. The
                                            role may inspect the area but not
                                            save changes.
                                        </p>
                                        <p>
                                            <strong>RU</strong>: read and
                                            update. The role may edit existing
                                            content and create new content.
                                        </p>
                                        <p>
                                            <strong>RUD</strong>: read, update
                                            and delete. The role may remove
                                            records where the feature supports
                                            deletion.
                                        </p>
                                        <p>
                                            Scope limits where the level
                                            applies: own records, assigned
                                            records, group records or all
                                            records.
                                        </p>
                                    </div>
                                </div>
                                <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--settings-border-color)] p-4">
                                    <div>
                                        {selectedRole &&
                                        data?.can_delete_roles ? (
                                            <button
                                                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-red-400 dark:text-slate-950"
                                                disabled={
                                                    saving ||
                                                    selectedRole.is_system
                                                }
                                                onClick={() =>
                                                    void deleteRole()
                                                }
                                                type="button"
                                            >
                                                <Trash2 className="size-4" />
                                                Delete
                                            </button>
                                        ) : null}
                                    </div>
                                    {data?.can_update_roles ? (
                                        <button
                                            className="rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-[var(--settings-accent-foreground)] disabled:opacity-50"
                                            disabled={!hasChanges || saving}
                                            onClick={() => void saveRole()}
                                            type="button"
                                        >
                                            {selectedRole ? 'Save' : 'Create'}
                                        </button>
                                    ) : (
                                        <button
                                            className="rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium"
                                            disabled
                                            type="button"
                                        >
                                            Read only
                                        </button>
                                    )}
                                </footer>
                            </section>
                        </div>
                    )}
                    {error ? (
                        <p
                            className="mt-3 text-sm text-red-600 dark:text-red-300"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : null}
                </section>
            </div>
        </main>
    );
}

function Field({
    children,
    className,
    label,
}: {
    children: React.ReactNode;
    className?: string;
    label: string;
}) {
    return (
        <label className={`grid gap-1 ${className ?? ''}`}>
            <span className="text-sm font-medium">{label}</span>
            {children}
        </label>
    );
}
function PermissionButtons({
    disabled,
    level,
    onChange,
}: {
    disabled: boolean;
    level: PermissionLevel;
    onChange: (level: PermissionLevel) => void;
}) {
    return (
        <div className="inline-grid grid-cols-4 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-active-background)] p-1 text-xs font-medium">
            {(['none', 'ro', 'ru', 'rud'] as PermissionLevel[]).map(
                (option) => (
                    <button
                        className={`rounded-md px-3 py-2 transition ${level === option ? 'bg-[var(--settings-accent)] text-[var(--settings-accent-foreground)] shadow-sm' : 'text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]'}`}
                        disabled={disabled}
                        key={option}
                        onClick={() => onChange(option)}
                        type="button"
                    >
                        {option === 'none' ? 'No' : option.toUpperCase()}
                    </button>
                ),
            )}
        </div>
    );
}
function ScopeSelect({
    disabled,
    onChange,
    scope,
}: {
    disabled: boolean;
    onChange: (scope: PermissionScope) => void;
    scope: PermissionScope;
}) {
    return (
        <select
            disabled={disabled}
            onChange={(event) =>
                onChange(event.currentTarget.value as PermissionScope)
            }
            value={scope}
        >
            {(
                ['none', 'own', 'assigned', 'group', 'all'] as PermissionScope[]
            ).map((option) => (
                <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                </option>
            ))}
        </select>
    );
}
function blankForm(resources: PermissionResource[]): RoleForm {
    return {
        description: '',
        level: '10',
        name: '',
        permissionScopes: Object.fromEntries(
            resources.map((resource) => [resource.key, 'all']),
        ) as Record<string, PermissionScope>,
        permissions: Object.fromEntries(
            resources.map((resource) => [resource.key, 'none']),
        ) as Record<string, PermissionLevel>,
        roleKey: '',
    };
}
function formFromRole(
    role: AdminRole | null,
    resources: PermissionResource[],
): RoleForm {
    if (!role) return blankForm(resources);
    return {
        description: role.description ?? '',
        level: role.level.toString(),
        name: role.name,
        permissionScopes: {
            ...blankForm(resources).permissionScopes,
            ...role.permission_scopes,
        } as Record<string, PermissionScope>,
        permissions: {
            ...blankForm(resources).permissions,
            ...role.permissions,
        } as Record<string, PermissionLevel>,
        roleKey: role.role_key,
    };
}
function normalizeForm(form: RoleForm): RoleForm {
    return {
        ...form,
        description: form.description.trim(),
        permissionScopes: Object.fromEntries(
            Object.entries(form.permissionScopes).sort(),
        ),
        permissions: Object.fromEntries(
            Object.entries(form.permissions).sort(),
        ),
    };
}
function groupResources(
    resources: PermissionResource[],
): { name: string; resources: PermissionResource[] }[] {
    const groups = new Map<string, PermissionResource[]>();
    resources.forEach((resource) =>
        groups.set(resource.group, [
            ...(groups.get(resource.group) ?? []),
            resource,
        ]),
    );
    return Array.from(groups.entries()).map(([name, grouped]) => ({
        name,
        resources: grouped,
    }));
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
