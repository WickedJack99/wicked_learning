import {
    ArrowLeft,
    Bell,
    Brush,
    KeyRound,
    Languages,
    MessageSquareText,
    Trash2,
    UserRound,
    Volume2,
} from 'lucide-react';
import {
    type CSSProperties,
    type FormEvent,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';

/**
 * Source-adapted from PersonalSettingsContent's DeleteAccountPanel and
 * DeleteUser. Only the Inertia form transport is replaced by the typed Rust
 * contract; labels, warning, confirmation and password requirement are kept.
 */
export function OriginalPersonalDeleteAccountPage({
    appearance,
    onDeleted,
}: {
    appearance: OriginalAppearance;
    onDeleted: () => void;
}) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (dialogOpen) {
            passwordInput.current?.focus();
        }
    }, [dialogOpen]);

    function closeDialog() {
        if (processing) {
            return;
        }
        setDialogOpen(false);
        setError(null);
        setPassword('');
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (processing) {
            return;
        }
        setProcessing(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.DELETE('/account/profile', {
                body: { password },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 422) {
                setError('The password is incorrect.');
                passwordInput.current?.focus();
                return;
            }
            if (!response.ok) {
                setError('The account could not be deleted right now.');
                return;
            }
            onDeleted();
        } catch {
            setError('The account could not be deleted right now.');
        } finally {
            setProcessing(false);
        }
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
                            <ArrowLeft className="size-4" />Settings
                        </Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            Personal
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Delete account
                        </h1>
                    </div>
                </header>
                <section className="grid min-h-0 flex-1 gap-4 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                    <PersonalNavigation />
                    <div className="min-h-0 overflow-auto bg-[var(--settings-panel-background)] p-5 sm:p-7">
                        <section className="grid gap-5">
                            <header>
                                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                    Delete account
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">
                                    Delete account
                                </h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                                    Delete your account and all of its resources.
                                </p>
                            </header>
                            <div className="max-w-2xl border-t border-red-400/30 pt-5">
                                <div className="settings-rounded-control space-y-4 rounded-lg border border-red-100 bg-red-50 p-4 dark:border-red-200/10 dark:bg-red-700/10">
                                    <div className="relative space-y-0.5 text-red-600 dark:text-red-100">
                                        <p className="font-medium">Warning</p>
                                        <p className="text-sm">
                                            Please proceed with caution, this cannot be undone.
                                        </p>
                                    </div>
                                    <button
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 disabled:pointer-events-none disabled:opacity-50"
                                        data-test="delete-user-button"
                                        onClick={() => setDialogOpen(true)}
                                        type="button"
                                    >
                                        Delete account
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </section>
            </div>
            {dialogOpen ? (
                <div
                    aria-labelledby="delete-account-title"
                    aria-modal="true"
                    className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target) {
                            closeDialog();
                        }
                    }}
                    role="dialog"
                >
                    <div className="grid w-full max-w-lg gap-4 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] p-6 shadow-lg">
                        <h2 className="text-lg leading-none font-semibold" id="delete-account-title">
                            Are you sure you want to delete your account?
                        </h2>
                        <p className="text-sm text-[var(--settings-muted-text)]">
                            Once your account is deleted, all of its resources and data will also be permanently deleted. Please enter your password to confirm you would like to permanently delete your account.
                        </p>
                        <form className="space-y-6" onSubmit={(event) => void submit(event)}>
                            <div className="grid gap-2">
                                <label className="sr-only" htmlFor="delete-account-password">
                                    Password
                                </label>
                                <input
                                    autoComplete="current-password"
                                    className="block w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-active-background)]"
                                    id="delete-account-password"
                                    onChange={(event) => setPassword(event.currentTarget.value)}
                                    placeholder="Password"
                                    ref={passwordInput}
                                    required
                                    type="password"
                                    value={password}
                                />
                                {error ? <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p> : null}
                            </div>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <button
                                    className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--settings-border-color)] px-4 py-2 text-sm font-medium shadow-xs transition hover:bg-[var(--settings-active-background)] disabled:pointer-events-none disabled:opacity-50"
                                    disabled={processing}
                                    onClick={closeDialog}
                                    type="button"
                                >
                                    Cancel
                                </button>
                                <button
                                    className="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                                    data-test="confirm-delete-user-button"
                                    disabled={processing}
                                    type="submit"
                                >
                                    Delete account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </main>
    );
}

function PersonalNavigation() {
    const inactive = 'relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]';
    return (
        <aside className="h-full min-h-0 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-2">
            <nav aria-label="Personal settings sections" className="grid gap-2">
                <Link className={inactive} to="/settings"><UserRound className="mt-0.5 size-4" />Profile</Link>
                <Link className={inactive} to="/settings?panel=personal&personal=appearance"><Brush className="mt-0.5 size-4" />Appearance</Link>
                <Link className={inactive} to="/settings?panel=personal&personal=language"><Languages className="mt-0.5 size-4" />Language</Link>
                <Link className={inactive} to="/settings?panel=personal&personal=notifications"><Bell className="mt-0.5 size-4" />Notifications</Link>
                <Link className={inactive} to="/settings?panel=personal&personal=feedback"><MessageSquareText className="mt-0.5 size-4" />Feedback</Link>
                <Link className={inactive} to="/settings?panel=personal&personal=sound"><Volume2 className="mt-0.5 size-4" />Sound</Link>
                <Link className={inactive} to="/settings?panel=personal&personal=security"><KeyRound className="mt-0.5 size-4" />Security</Link>
                <div aria-current="page" className="relative flex items-start gap-3 overflow-hidden rounded-lg bg-red-50 px-3 py-3 text-left text-sm font-medium text-red-600 dark:bg-red-700/10 dark:text-red-100"><Trash2 className="mt-0.5 size-4" />Delete account</div>
            </nav>
        </aside>
    );
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark ? '#111820' : '#ffffff',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
    } as CSSProperties;
}
