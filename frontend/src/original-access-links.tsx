import { Link, Navigate, useNavigate } from 'react-router';
import { type CSSProperties, useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import type { OriginalAppearance } from './original-appearance';

type AdminData = components['schemas']['AccessLinkAdminData'];
type GrantOption = components['schemas']['AccessLinkGrantOption'];

/** Source-adapted from `features/settings/access-links-panel.tsx`. */
export function OriginalAccessLinksPage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const [data, setData] = useState<AdminData | null>(null);
    const [page, setPage] = useState(1);
    const [purpose, setPurpose] = useState<
        'grant_tool' | 'grant_items' | 'registration' | 'temporary_login'
    >('grant_tool');
    const [toolId, setToolId] = useState('');
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [usage, setUsage] = useState<'one_time' | 'multiple' | 'per_user'>(
        'one_time',
    );
    const [expiresAt, setExpiresAt] = useState(defaultExpiry());
    const [note, setNote] = useState('');
    const [roles, setRoles] = useState<string[]>([]);
    const [createdUrl, setCreatedUrl] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    function load(requestedPage: number): void {
        void apiClient
            .GET('/admin/access-links', {
                params: { query: { page: requestedPage } },
            })
            .then(({ data, response }) => {
                if (!response.ok || !data) throw new Error('unavailable');
                setData(data);
                setRoles((current) =>
                    current.length > 0
                        ? current
                        : [data.assignable_roles[0] ?? 'learner'],
                );
            })
            .catch(() => setError('Access links are temporarily unavailable.'));
    }
    useEffect(() => load(page), [page]);

    async function create(): Promise<void> {
        setSaving(true);
        setError('');
        setCreatedUrl('');
        try {
            const token = await getCsrfToken();
            const item_grants =
                purpose === 'grant_items'
                    ? [{ item_id: itemId, quantity: Number(quantity) }]
                    : [];
            const { data: created, response } = await apiClient.POST(
                '/admin/access-links',
                {
                    body: {
                        expires_at: new Date(expiresAt).toISOString(),
                        item_grants,
                        note: note || null,
                        purpose,
                        ...(purpose === 'registration' ? { roles } : {}),
                        tool_id:
                            purpose === 'grant_tool' ? toolId || null : null,
                        usage_policy: usage,
                    },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !created) throw new Error('invalid');
            setCreatedUrl(created.redeem_url);
            setPage(1);
            load(1);
        } catch {
            setError('Choose a valid grant and a future expiry time.');
        } finally {
            setSaving(false);
        }
    }
    async function toggle(id: string, enabled: boolean): Promise<void> {
        try {
            const token = await getCsrfToken();
            const { data: updated, response } = await apiClient.PATCH(
                '/admin/access-links/{access_link_id}',
                {
                    body: { enabled },
                    params: {
                        header: { 'X-CSRF-Token': token },
                        path: { access_link_id: id },
                    },
                },
            );
            if (!response.ok || !updated) throw new Error('unavailable');
            setData((current) =>
                current
                    ? {
                          ...current,
                          links: current.links.map((link) =>
                              link.id === id ? updated.link : link,
                          ),
                      }
                    : current,
            );
        } catch {
            setError('The link status could not be saved.');
        }
    }
    return (
        <main
            className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100"
            style={settingsStyle(appearance)}
        >
            <div className="mx-auto w-full max-w-5xl">
                <Link
                    className="mb-4 inline-flex rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)]"
                    to="/home"
                >
                    Settings
                </Link>
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                    Administration
                </p>
                <h1 className="mt-2 text-3xl font-semibold">Access links</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                    Create bounded links that grant a learner a tool or item, or
                    let a new learner register with the normal account form, or
                    begin a temporary learner session.
                </p>
                <section className="mt-6 grid gap-4 border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4">
                    <h2 className="text-lg font-semibold">Create link</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Purpose">
                            <select
                                value={purpose}
                                onChange={(event) => {
                                    const nextPurpose = event.target
                                        .value as typeof purpose;
                                    setPurpose(nextPurpose);
                                    if (
                                        nextPurpose === 'temporary_login' &&
                                        usage === 'per_user'
                                    )
                                        setUsage('one_time');
                                }}
                            >
                                <option value="grant_tool">Grant a tool</option>
                                <option value="grant_items">Grant items</option>
                                <option value="registration">
                                    Allow registration
                                </option>
                                <option value="temporary_login">
                                    Temporary learner login
                                </option>
                            </select>
                        </Field>
                        <Field label="Usage">
                            <select
                                value={usage}
                                onChange={(event) =>
                                    setUsage(event.target.value as typeof usage)
                                }
                            >
                                <option value="one_time">One time</option>
                                <option value="multiple">Multiple times</option>
                                <option
                                    disabled={purpose === 'temporary_login'}
                                    value="per_user"
                                >
                                    One time per user
                                </option>
                            </select>
                        </Field>
                        {purpose === 'grant_tool' ? (
                            <Field label="Tool">
                                <select
                                    value={toolId}
                                    onChange={(event) =>
                                        setToolId(event.target.value)
                                    }
                                >
                                    <option value="">Choose a tool</option>
                                    {data?.tools.map((option) => (
                                        <Option
                                            option={option}
                                            key={option.id}
                                        />
                                    ))}
                                </select>
                            </Field>
                        ) : purpose === 'grant_items' ? (
                            <>
                                <Field label="Item">
                                    <select
                                        value={itemId}
                                        onChange={(event) =>
                                            setItemId(event.target.value)
                                        }
                                    >
                                        <option value="">Choose an item</option>
                                        {data?.items.map((option) => (
                                            <Option
                                                option={option}
                                                key={option.id}
                                            />
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Quantity">
                                    <input
                                        min="1"
                                        max="99"
                                        type="number"
                                        value={quantity}
                                        onChange={(event) =>
                                            setQuantity(event.target.value)
                                        }
                                    />
                                </Field>
                            </>
                        ) : purpose === 'registration' ? (
                            <Field label="Roles">
                                <select
                                    className="min-h-24"
                                    multiple
                                    onChange={(event) =>
                                        setRoles(
                                            Array.from(
                                                event.currentTarget.selectedOptions,
                                                (option) => option.value,
                                            ),
                                        )
                                    }
                                    value={roles}
                                >
                                    {data?.assignable_roles.map((role) => (
                                        <option key={role} value={role}>
                                            {roleLabel(role)}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-xs text-[var(--settings-muted-text)]">
                                    Choose the roles this registration link grants.
                                </span>
                            </Field>
                        ) : (
                            <p className="text-sm leading-6 text-[var(--settings-muted-text)] sm:col-span-2">
                                A temporary-login link starts a fresh temporary
                                learner session. It supports one or multiple
                                uses, but not one use per user.
                            </p>
                        )}
                        <Field label="Expires at">
                            <input
                                type="datetime-local"
                                value={expiresAt}
                                onChange={(event) =>
                                    setExpiresAt(event.target.value)
                                }
                            />
                        </Field>
                        <Field label="Note">
                            <input
                                maxLength={500}
                                value={note}
                                onChange={(event) =>
                                    setNote(event.target.value)
                                }
                                placeholder="Optional internal note"
                            />
                        </Field>
                    </div>
                    <button
                        className="w-fit rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-medium text-[var(--settings-accent-foreground)] disabled:opacity-50"
                        disabled={saving || !data}
                        onClick={() => void create()}
                        type="button"
                    >
                        {saving ? 'Creating…' : 'Create link'}
                    </button>
                    {createdUrl ? (
                        <p className="rounded-md bg-[var(--settings-active-background)] p-3 text-sm break-all">
                            Copy this link now: <code>{createdUrl}</code>
                        </p>
                    ) : null}
                </section>
                <section className="mt-6 grid gap-3 border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-4">
                    <h2 className="text-lg font-semibold">Recent links</h2>
                    {data?.links.length === 0 ? (
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            No links yet.
                        </p>
                    ) : null}
                    {data?.links.map((link) => (
                        <article
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--settings-active-background)] p-3 text-sm"
                            key={link.id}
                        >
                            <div>
                                <p className="font-medium">
                                    {link.purpose === 'grant_tool'
                                        ? 'Grant a tool'
                                        : link.purpose === 'grant_items'
                                          ? 'Grant items'
                                          : link.purpose === 'registration'
                                            ? 'Allow registration'
                                            : 'Temporary learner login'}
                                </p>
                                <p className="text-xs text-[var(--settings-muted-text)]">
                                    {link.usage_policy.replace('_', ' ')} ·
                                    expires{' '}
                                    {new Intl.DateTimeFormat(undefined, {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                    }).format(new Date(link.expires_at))}
                                    {link.note ? ` · ${link.note}` : ''}
                                </p>
                            </div>
                            <button
                                className="rounded border border-[var(--settings-border-color)] px-3 py-1.5"
                                onClick={() =>
                                    void toggle(link.id, !link.is_enabled)
                                }
                                type="button"
                            >
                                {link.is_enabled
                                    ? 'Disable link'
                                    : 'Enable link'}
                            </button>
                        </article>
                    ))}
                    {data && data.pagination.last_page > 1 ? (
                        <div className="mt-3 flex items-center justify-between border-t border-[var(--settings-border-color)] pt-3 text-sm">
                            <button
                                className="text-[var(--settings-accent)] disabled:opacity-40"
                                disabled={data.pagination.current_page <= 1}
                                onClick={() =>
                                    setPage(data.pagination.current_page - 1)
                                }
                                type="button"
                            >
                                Previous
                            </button>
                            <span className="text-[var(--settings-muted-text)]">
                                Page {data.pagination.current_page} of{' '}
                                {data.pagination.last_page}
                            </span>
                            <button
                                className="text-[var(--settings-accent)] disabled:opacity-40"
                                disabled={
                                    data.pagination.current_page >=
                                    data.pagination.last_page
                                }
                                onClick={() =>
                                    setPage(data.pagination.current_page + 1)
                                }
                                type="button"
                            >
                                Next
                            </button>
                        </div>
                    ) : null}
                </section>
                {error ? (
                    <p className="mt-4 text-sm text-red-600" role="alert">
                        {error}
                    </p>
                ) : null}
            </div>
        </main>
    );
}

export function OriginalAccessLinkRedeemPage({
    token,
    isAuthenticated,
}: {
    token: string;
    isAuthenticated: boolean;
}) {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [preview, setPreview] = useState<
        components['schemas']['AccessLinkPreview'] | null
    >(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        void apiClient
            .GET('/access-links/{token}', { params: { path: { token } } })
            .then(({ data, response }) => {
                if (!active) return;
                if (!response.ok || !data) {
                    setError(
                        'This access link is unavailable or can no longer be redeemed.',
                    );
                    return;
                }
                setPreview(data);
            })
            .catch(() => {
                if (active)
                    setError(
                        'This access link is unavailable or can no longer be redeemed.',
                    );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [token]);
    async function redeem(): Promise<void> {
        setRedeeming(true);
        setError('');
        try {
            const csrf = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/access-links/{token}/redeem',
                {
                    params: {
                        header: { 'X-CSRF-Token': csrf },
                        path: { token },
                    },
                },
            );
            if (!response.ok) throw new Error('unavailable');
            navigate('/world', { replace: true });
        } catch {
            setError(
                'This access link is unavailable or can no longer be redeemed.',
            );
        } finally {
            setRedeeming(false);
        }
    }
    const purpose =
        preview?.purpose === 'grant_tool'
            ? 'Grant a tool'
            : preview?.purpose === 'grant_items'
              ? 'Grant items'
              : 'Allow registration';
    if (preview?.purpose === 'registration') {
        return (
            <Navigate
                replace
                to={`/register?registration_token=${encodeURIComponent(token)}`}
            />
        );
    }
    if (preview?.purpose === 'temporary_login') {
        return <TemporaryAccessLinkLogin token={token} />;
    }
    return (
        <main className="mx-auto flex min-h-svh max-w-xl items-center px-6 py-12">
            <section className="w-full rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-50 shadow-xl">
                <p className="text-xs font-semibold tracking-[0.18em] text-teal-300 uppercase">
                    Access link
                </p>
                <h1 className="mt-4 text-2xl font-semibold">
                    {loading ? 'Checking access link…' : purpose}
                </h1>
                {preview?.note ? (
                    <p className="mt-3 text-sm text-slate-300">
                        {preview.note}
                    </p>
                ) : null}
                <p className="mt-4 text-sm text-slate-400">
                    This link grants its configured learning resource to your
                    account.
                </p>
                {preview && isAuthenticated ? (
                    <button
                        className="mt-6 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
                        disabled={redeeming}
                        onClick={() => void redeem()}
                        type="button"
                    >
                        {redeeming ? 'Redeeming…' : 'Redeem link'}
                    </button>
                ) : null}
                {preview && !isAuthenticated ? (
                    <Link
                        className="mt-6 inline-flex rounded-md bg-teal-600 px-4 py-2 text-sm font-medium"
                        to={`/login?next=${encodeURIComponent(`/access-links/${token}`)}`}
                    >
                        Log in to redeem
                    </Link>
                ) : null}
                {error ? (
                    <p className="mt-4 text-sm text-red-300" role="alert">
                        {error}
                    </p>
                ) : null}
            </section>
        </main>
    );
}

function TemporaryAccessLinkLogin({ token }: { token: string }) {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    async function login(): Promise<void> {
        setSubmitting(true);
        setError('');
        try {
            const csrf = await getCsrfToken();
            const { response } = await apiClient.POST(
                '/access-links/{token}/temporary-login',
                {
                    params: {
                        header: { 'X-CSRF-Token': csrf },
                        path: { token },
                    },
                },
            );
            if (!response.ok) throw new Error('unavailable');
            navigate('/home', { replace: true });
        } catch {
            setError(
                'This temporary access link is unavailable or can no longer be used.',
            );
        } finally {
            setSubmitting(false);
        }
    }
    return (
        <main className="mx-auto flex min-h-svh max-w-xl items-center px-6 py-12">
            <section className="w-full rounded-xl border border-slate-700 bg-slate-950 p-6 text-slate-50 shadow-xl">
                <p className="text-xs font-semibold tracking-[0.18em] text-teal-300 uppercase">
                    Temporary learner
                </p>
                <h1 className="mt-4 text-2xl font-semibold">
                    Continue as temporary learner
                </h1>
                <p className="mt-3 text-sm text-slate-300">
                    This link creates a temporary learner session.
                </p>
                <button
                    className="mt-6 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => void login()}
                    type="button"
                >
                    {submitting
                        ? 'Continuing…'
                        : 'Continue as temporary learner'}
                </button>
                {error ? (
                    <p className="mt-4 text-sm text-red-300" role="alert">
                        {error}
                    </p>
                ) : null}
            </section>
        </main>
    );
}

function Option({ option }: { option: GrantOption }) {
    return <option value={option.id}>{option.title}</option>;
}
function Field({
    children,
    label,
}: {
    children: React.ReactNode;
    label: string;
}) {
    return (
        <label className="grid gap-1 text-sm font-medium">
            {label}
            <span className="[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-[var(--settings-border-color)] [&_input]:bg-[var(--settings-input-background)] [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-[var(--settings-border-color)] [&_select]:bg-[var(--settings-input-background)] [&_select]:px-3 [&_select]:py-2">
                {children}
            </span>
        </label>
    );
}
function defaultExpiry(): string {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
    return next.toISOString().slice(0, 16);
}

function roleLabel(role: string): string {
    return role
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
        .join(' ');
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
