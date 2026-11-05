import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';

/**
 * Lifted from `resources/js/pages/auth/login.tsx` and
 * `resources/js/layouts/auth/auth-simple-layout.tsx`.  Only the Inertia form
 * submission is replaced by the typed Rust session command.
 */
export function OriginalLoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/session/login', {
                body: { email, password },
                params: { header: { 'X-CSRF-Token': token } },
            });

            if (response.status === 401) {
                setError('The email address or password is not valid.');
                return;
            }
            if (!response.ok || !data) {
                setError('Sign in is temporarily unavailable.');
                return;
            }

            navigate('/world', { replace: true });
        } catch {
            setError('Sign in is temporarily unavailable.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main
            className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[var(--auth-background-color)] p-6 md:p-10"
            style={
                {
                    '--auth-background-color': '#07111f',
                    '--auth-background-overlay':
                        'linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))',
                    '--auth-border-line-color': 'rgba(148, 163, 184, 0.24)',
                    '--auth-description-text-color': 'rgba(203, 213, 225, 0.78)',
                    '--auth-logo-background': '#5eead4',
                    '--auth-logo-color': '#06111f',
                    '--auth-panel-background': 'rgba(15, 23, 42, 0.86)',
                    '--auth-title-text-color': '#f8fafc',
                } as React.CSSProperties
            }
        >
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'var(--auth-background-overlay)' }}
            />
            <section
                className="relative w-full max-w-sm rounded-lg border p-6 shadow-2xl backdrop-blur-md md:p-8"
                data-wl-id="identity.login"
                style={{
                    background: 'var(--auth-panel-background)',
                    borderColor: 'var(--auth-border-line-color)',
                }}
            >
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            className="flex flex-col items-center gap-2 font-medium"
                            to="/"
                        >
                            <div
                                aria-hidden="true"
                                className="mb-1 flex h-10 w-10 items-center justify-center rounded-md"
                                style={{
                                    background: 'var(--auth-logo-background)',
                                    color: 'var(--auth-logo-color)',
                                }}
                            >
                                <img
                                    alt=""
                                    className="size-8 object-contain"
                                    draggable={false}
                                    src="/images/logo.png"
                                />
                            </div>
                            <span className="sr-only">Log in to your account</span>
                        </Link>
                        <div className="space-y-2 text-center">
                            <h1
                                className="text-xl font-medium"
                                style={{ color: 'var(--auth-title-text-color)' }}
                            >
                                Log in to your account
                            </h1>
                            <p
                                className="text-center text-sm"
                                style={{
                                    color: 'var(--auth-description-text-color)',
                                }}
                            >
                                Enter your email and password below to log in
                            </p>
                        </div>
                    </div>
                    <form className="flex flex-col gap-6" onSubmit={submit}>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <label
                                    className="text-sm font-medium text-slate-100"
                                    htmlFor="email"
                                >
                                    Email address
                                </label>
                                <input
                                    autoComplete="email"
                                    autoFocus
                                    className="h-9 w-full rounded-md border border-white/20 bg-transparent px-3 py-1 text-sm text-slate-100 shadow-xs outline-none placeholder:text-slate-400 focus-visible:ring-2"
                                    id="email"
                                    onChange={(event) =>
                                        setEmail(event.currentTarget.value)
                                    }
                                    placeholder="email@example.com"
                                    required
                                    type="email"
                                    value={email}
                                />
                            </div>
                            <div className="grid gap-2">
                                <label
                                    className="text-sm font-medium text-slate-100"
                                    htmlFor="password"
                                >
                                    Password
                                </label>
                                <input
                                    autoComplete="current-password"
                                    className="h-9 w-full rounded-md border border-white/20 bg-transparent px-3 py-1 text-sm text-slate-100 shadow-xs outline-none placeholder:text-slate-400 focus-visible:ring-2"
                                    id="password"
                                    onChange={(event) =>
                                        setPassword(event.currentTarget.value)
                                    }
                                    placeholder="Password"
                                    required
                                    type="password"
                                    value={password}
                                />
                            </div>
                            {error ? (
                                <p className="text-sm text-red-300" role="alert">
                                    {error}
                                </p>
                            ) : null}
                            <button
                                className="mt-4 h-9 w-full rounded-md bg-teal-300 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-200 disabled:pointer-events-none disabled:opacity-50"
                                disabled={submitting}
                                type="submit"
                            >
                                {submitting ? 'Logging in…' : 'Log in'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}
