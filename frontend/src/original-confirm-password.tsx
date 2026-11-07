import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalAppearanceToggle } from './original-appearance-toggle';
import {
    publicPresentationStyle,
    type PublicPresentation,
} from './public-presentation';
import { OriginalPasskeyVerify } from './original-passkey';

/**
 * Lifted from `resources/js/pages/auth/confirm-password.tsx` and the source
 * `AuthSimpleLayout`. Its source passkey alternative uses the same typed
 * recent-confirmation contract as the Rust security settings.
 */
export function OriginalConfirmPasswordPage({
    appearance,
    onAppearanceChange,
    presentation,
}: {
    appearance: OriginalAppearance;
    onAppearanceChange: (appearance: OriginalAppearance) => void;
    presentation: PublicPresentation;
}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST(
                '/account/password/confirmation',
                {
                    body: { password },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (response.status === 401) {
                navigate('/login', { replace: true });
                return;
            }
            if (response.status === 422) {
                setError('The password could not be confirmed.');
                return;
            }
            if (!response.ok || !data?.confirmed) {
                setError('Password confirmation is temporarily unavailable.');
                return;
            }

            const next = searchParams.get('next');
            navigate(
                next?.startsWith('/') && !next.startsWith('//')
                    ? next
                    : '/settings?panel=personal&personal=security',
                { replace: true },
            );
        } catch {
            setError('Password confirmation is temporarily unavailable.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main
            className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[var(--auth-background-color)] p-6 md:p-10"
            style={publicPresentationStyle(presentation, appearance, 'login')}
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'var(--auth-background-image)' }}
            />
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'var(--auth-background-overlay)' }}
            />
            <div className="absolute top-4 right-4 z-10">
                <OriginalAppearanceToggle
                    appearance={appearance}
                    onAppearanceChange={onAppearanceChange}
                />
            </div>
            <section
                className="relative w-full max-w-sm rounded-lg border p-6 shadow-2xl backdrop-blur-md md:p-8"
                data-wl-id="identity.password-confirmation"
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
                                    src={presentation.branding.logo}
                                />
                            </div>
                            <span className="sr-only">Confirm password</span>
                        </Link>
                        <div className="space-y-2 text-center">
                            <h1
                                className="text-xl font-medium"
                                style={{ color: 'var(--auth-title-text-color)' }}
                            >
                                Confirm password
                            </h1>
                            <p
                                className="text-center text-sm"
                                style={{
                                    color: 'var(--auth-description-text-color)',
                                }}
                            >
                                This is a secure area of the application. Please
                                confirm your password before continuing.
                            </p>
                        </div>
                    </div>
                    <OriginalPasskeyVerify
                        label="Confirm with passkey"
                        loadingLabel="Confirming..."
                        onSuccess={() => {
                            const next = searchParams.get('next');
                            navigate(
                                next?.startsWith('/') && !next.startsWith('//')
                                    ? next
                                    : '/settings?panel=personal&personal=security',
                                { replace: true },
                            );
                        }}
                        optionsPath="/account/passkeys/confirmation/options"
                        separator="Or confirm with password"
                        submitPath="/account/passkeys/confirmation"
                    />
                    <form className="flex flex-col gap-6" onSubmit={submit}>
                        <div className="grid gap-6">
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
                                    autoFocus
                                    className="h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none placeholder:opacity-70 focus-visible:ring-2"
                                    id="password"
                                    onChange={(event) =>
                                        setPassword(event.currentTarget.value)
                                    }
                                    placeholder="Password"
                                    required
                                    style={{
                                        background: 'var(--auth-input-background)',
                                        borderColor:
                                            'var(--auth-input-border-color)',
                                        color: 'var(--auth-label-text-color)',
                                    }}
                                    type="password"
                                    value={password}
                                />
                                {error ? (
                                    <p className="text-sm text-red-300" role="alert">
                                        {error}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                className="h-9 w-full rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                                data-test="confirm-password-button"
                                disabled={submitting}
                                style={{
                                    background: 'var(--auth-button-background)',
                                    color: 'var(--auth-button-text-color)',
                                }}
                                type="submit"
                            >
                                {submitting ? 'Confirming…' : 'Confirm password'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}
