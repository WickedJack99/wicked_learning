import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import { OriginalAppearanceToggle } from './original-appearance-toggle';

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
    const [isLight, setIsLight] = useState(false);
    const authTheme = isLight
        ? {
              backgroundColor: '#ecfeff',
              backgroundOverlay:
                  'linear-gradient(120deg, rgba(236, 254, 255, 0.94), rgba(240, 249, 255, 0.82), rgba(219, 234, 254, 0.62))',
              borderLineColor: 'rgba(8, 145, 178, 0.24)',
              buttonBackground: '#0e7490',
              buttonTextColor: '#ffffff',
              descriptionTextColor: 'rgba(51, 65, 85, 0.78)',
              inputBackground: 'rgba(255, 255, 255, 0.7)',
              inputBorderColor: 'rgba(14, 116, 144, 0.28)',
              labelTextColor: '#0f172a',
              logoBackground: '#0e7490',
              logoColor: '#ffffff',
              panelBackground: 'rgba(255, 255, 255, 0.86)',
              titleTextColor: '#0f172a',
          }
        : {
              backgroundColor: '#07111f',
              backgroundOverlay:
                  'linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))',
              borderLineColor: 'rgba(94, 234, 212, 0.24)',
              buttonBackground: '#5eead4',
              buttonTextColor: '#06111f',
              descriptionTextColor: 'rgba(203, 213, 225, 0.78)',
              inputBackground: 'rgba(2, 6, 23, 0.36)',
              inputBorderColor: 'rgba(125, 211, 252, 0.32)',
              labelTextColor: '#e2e8f0',
              logoBackground: '#5eead4',
              logoColor: '#06111f',
              panelBackground: 'rgba(7, 17, 31, 0.82)',
              titleTextColor: '#f8fafc',
          };

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
                    '--auth-background-color': authTheme.backgroundColor,
                    '--auth-background-overlay': authTheme.backgroundOverlay,
                    '--auth-border-line-color': authTheme.borderLineColor,
                    '--auth-button-background': authTheme.buttonBackground,
                    '--auth-button-text-color': authTheme.buttonTextColor,
                    '--auth-description-text-color':
                        authTheme.descriptionTextColor,
                    '--auth-input-background': authTheme.inputBackground,
                    '--auth-input-border-color': authTheme.inputBorderColor,
                    '--auth-label-text-color': authTheme.labelTextColor,
                    '--auth-logo-background': authTheme.logoBackground,
                    '--auth-logo-color': authTheme.logoColor,
                    '--auth-panel-background': authTheme.panelBackground,
                    '--auth-title-text-color': authTheme.titleTextColor,
                    '--public-control-border': isLight ? '#0f172a' : '#ffffff',
                    '--public-control-text': isLight ? '#0f172a' : '#ffffff',
                } as React.CSSProperties
            }
        >
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'var(--auth-background-overlay)' }}
            />
            <div className="absolute top-4 right-4 z-10">
                <OriginalAppearanceToggle
                    appearance={isLight ? 'light' : 'dark'}
                    onAppearanceChange={(appearance) =>
                        setIsLight(appearance === 'light')
                    }
                />
            </div>
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
                                    className="text-sm font-medium"
                                    htmlFor="email"
                                    style={{ color: 'var(--auth-label-text-color)' }}
                                >
                                    Email address
                                </label>
                                <input
                                    autoComplete="email"
                                    autoFocus
                                    className="h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none placeholder:opacity-70 focus-visible:ring-2"
                                    id="email"
                                    onChange={(event) =>
                                        setEmail(event.currentTarget.value)
                                    }
                                    placeholder="email@example.com"
                                    required
                                    style={{
                                        background:
                                            'var(--auth-input-background)',
                                        borderColor:
                                            'var(--auth-input-border-color)',
                                        color: 'var(--auth-label-text-color)',
                                    }}
                                    type="email"
                                    value={email}
                                />
                            </div>
                            <div className="grid gap-2">
                                <label
                                    className="text-sm font-medium"
                                    htmlFor="password"
                                    style={{ color: 'var(--auth-label-text-color)' }}
                                >
                                    Password
                                </label>
                                <input
                                    autoComplete="current-password"
                                    className="h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none placeholder:opacity-70 focus-visible:ring-2"
                                    id="password"
                                    onChange={(event) =>
                                        setPassword(event.currentTarget.value)
                                    }
                                    placeholder="Password"
                                    required
                                    style={{
                                        background:
                                            'var(--auth-input-background)',
                                        borderColor:
                                            'var(--auth-input-border-color)',
                                        color: 'var(--auth-label-text-color)',
                                    }}
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
                                className="mt-4 h-9 w-full rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                                disabled={submitting}
                                style={{
                                    background:
                                        'var(--auth-button-background)',
                                    color: 'var(--auth-button-text-color)',
                                }}
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
