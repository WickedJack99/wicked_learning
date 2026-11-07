import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalAppearanceToggle } from './original-appearance-toggle';
import {
    publicPresentationStyle,
    type PublicPresentation,
} from './public-presentation';

const OTP_MAX_LENGTH = 6;

/**
 * Lifted from `resources/js/pages/auth/two-factor-challenge.tsx` and the
 * original `AuthSimpleLayout`. Only the Inertia form transport is replaced by
 * the typed Rust session challenge contract.
 */
export function OriginalTwoFactorChallengePage({
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
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showRecoveryInput, setShowRecoveryInput] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let isCurrent = true;

        void apiClient.GET('/session').then(({ data, response }) => {
            if (
                isCurrent &&
                (!response.ok || !data || !data.two_factor_required)
            ) {
                navigate('/login', { replace: true });
            }
        }).catch(() => {
            if (isCurrent) {
                navigate('/login', { replace: true });
            }
        });

        return () => {
            isCurrent = false;
        };
    }, [navigate]);

    const authConfigContent = useMemo(() => {
        if (showRecoveryInput) {
            return {
                description:
                    'Please confirm access to your account by entering one of your emergency recovery codes.',
                title: 'Recovery code',
                toggleText: 'login using an authentication code',
            };
        }

        return {
            description:
                'Enter the authentication code provided by your authenticator application.',
            title: 'Authentication code',
            toggleText: 'login using a recovery code',
        };
    }, [showRecoveryInput]);

    function toggleRecoveryMode(): void {
        setShowRecoveryInput((current) => !current);
        setCode('');
        setError(null);
    }

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/session/two-factor', {
                body: showRecoveryInput
                    ? { recovery_code: code }
                    : { code },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 401) {
                setError('The authentication code is not valid.');
                return;
            }
            if (!response.ok || !data || !data.authenticated) {
                setError('Two-factor authentication is temporarily unavailable.');
                return;
            }

            const next = searchParams.get('next');
            navigate(
                next?.startsWith('/') && !next.startsWith('//') ? next : '/world',
                { replace: true },
            );
        } catch {
            setError('Two-factor authentication is temporarily unavailable.');
        } finally {
            setSubmitting(false);
        }
    }

    const inputStyle = {
        background: 'var(--auth-input-background)',
        borderColor: 'var(--auth-input-border-color)',
        color: 'var(--auth-label-text-color)',
    };

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
                data-wl-id="identity.two-factor-challenge"
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
                            <span className="sr-only">
                                {authConfigContent.title}
                            </span>
                        </Link>
                        <div className="space-y-2 text-center">
                            <h1
                                className="text-xl font-medium"
                                style={{ color: 'var(--auth-title-text-color)' }}
                            >
                                {authConfigContent.title}
                            </h1>
                            <p
                                className="text-center text-sm"
                                style={{
                                    color: 'var(--auth-description-text-color)',
                                }}
                            >
                                {authConfigContent.description}
                            </p>
                        </div>
                    </div>
                    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
                        {showRecoveryInput ? (
                            <div className="grid gap-2">
                                <label
                                    className="sr-only"
                                    htmlFor="recovery_code"
                                >
                                    Recovery code
                                </label>
                                <input
                                    autoFocus
                                    className="h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none placeholder:opacity-70 focus-visible:ring-2"
                                    id="recovery_code"
                                    onChange={(event) => setCode(event.currentTarget.value)}
                                    placeholder="Enter recovery code"
                                    required
                                    style={inputStyle}
                                    type="text"
                                    value={code}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center space-y-3 text-center">
                                <div className="flex w-full items-center justify-center">
                                    <div className="relative grid h-14 w-full max-w-[23rem] grid-cols-[repeat(3,minmax(0,1fr))_0.6rem_repeat(3,minmax(0,1fr))] gap-2">
                                        {Array.from({ length: OTP_MAX_LENGTH }, (_, index) => (
                                            <div
                                                aria-hidden="true"
                                                className={`flex items-center justify-center rounded-lg border font-mono text-xl shadow-xs ${index === 3 ? 'col-start-5' : ''}`}
                                                key={index}
                                                style={inputStyle}
                                            >
                                                {code[index] ?? ''}
                                            </div>
                                        ))}
                                        <input
                                            aria-label="Authentication code"
                                            autoComplete="one-time-code"
                                            autoFocus
                                            className="absolute inset-0 h-full border-0 bg-transparent text-transparent caret-transparent shadow-none outline-none selection:bg-transparent placeholder:text-transparent focus-visible:ring-0"
                                            disabled={submitting}
                                            inputMode="numeric"
                                            maxLength={OTP_MAX_LENGTH}
                                            onChange={(event) =>
                                                setCode(
                                                    event.currentTarget.value
                                                        .replace(/\D/g, '')
                                                        .slice(0, OTP_MAX_LENGTH),
                                                )
                                            }
                                            pattern="[0-9]*"
                                            placeholder="000000"
                                            required
                                            type="text"
                                            value={code}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {error ? (
                            <p className="text-sm text-red-300" role="alert">
                                {error}
                            </p>
                        ) : null}
                        <button
                            className="h-9 w-full rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                            disabled={submitting}
                            style={{
                                background: 'var(--auth-button-background)',
                                color: 'var(--auth-button-text-color)',
                            }}
                            type="submit"
                        >
                            {submitting ? 'Continuing…' : 'Continue'}
                        </button>
                        <div
                            className="text-center text-sm"
                            style={{ color: 'var(--auth-description-text-color)' }}
                        >
                            <span>or you can </span>
                            <button
                                className="cursor-pointer underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current dark:decoration-neutral-500"
                                onClick={toggleRecoveryMode}
                                style={{ color: 'var(--auth-link-text-color)' }}
                                type="button"
                            >
                                {authConfigContent.toggleText}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}
