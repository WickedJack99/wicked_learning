import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalAppearanceToggle } from './original-appearance-toggle';
import {
    publicPresentationStyle,
    type PublicPresentation,
} from './public-presentation';

/**
 * Lifted from `resources/js/pages/auth/register.tsx` and the original
 * AuthSimpleLayout. Only the Inertia form transport is replaced by the typed
 * Rust invitation-registration command.
 */
export function OriginalRegisterPage({
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
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [registrationToken, setRegistrationToken] = useState(
        searchParams.get('registration_token') ?? '',
    );
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.POST('/registration', {
                body: {
                    email,
                    name,
                    password,
                    password_confirmation: passwordConfirmation,
                    registration_token: registrationToken,
                },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (response.status === 422) {
                setError('The account could not be created with these details.');
                return;
            }
            if (!response.ok || !data) {
                setError('Registration is temporarily unavailable.');
                return;
            }

            navigate('/world', { replace: true });
        } catch {
            setError('Registration is temporarily unavailable.');
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
            style={publicPresentationStyle(presentation, appearance, 'register')}
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
                data-wl-id="identity.registration"
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
                            <span className="sr-only">Create an account</span>
                        </Link>
                        <div className="space-y-2 text-center">
                            <h1
                                className="text-xl font-medium"
                                style={{ color: 'var(--auth-title-text-color)' }}
                            >
                                Create an account
                            </h1>
                            <p
                                className="text-center text-sm"
                                style={{
                                    color: 'var(--auth-description-text-color)',
                                }}
                            >
                                Enter your details below to create your account
                            </p>
                        </div>
                    </div>
                    <form className="flex flex-col gap-6" onSubmit={submit}>
                        <div className="grid gap-6">
                            <RegisterField
                                autoComplete="name"
                                autoFocus
                                id="name"
                                label="Name"
                                onChange={setName}
                                placeholder="Full name"
                                style={inputStyle}
                                value={name}
                            />
                            <RegisterField
                                autoComplete="email"
                                id="email"
                                label="Email address"
                                onChange={setEmail}
                                placeholder="email@example.com"
                                style={inputStyle}
                                type="email"
                                value={email}
                            />
                            <RegisterField
                                autoComplete="off"
                                id="registration_token"
                                label="Registration token"
                                onChange={setRegistrationToken}
                                placeholder="Paste your invite token"
                                style={inputStyle}
                                value={registrationToken}
                            />
                            <RegisterField
                                autoComplete="new-password"
                                id="password"
                                label="Password"
                                onChange={setPassword}
                                placeholder="Password"
                                style={inputStyle}
                                type="password"
                                value={password}
                            />
                            <RegisterField
                                autoComplete="new-password"
                                id="password_confirmation"
                                label="Confirm password"
                                onChange={setPasswordConfirmation}
                                placeholder="Confirm password"
                                style={inputStyle}
                                type="password"
                                value={passwordConfirmation}
                            />
                            {error ? (
                                <p className="text-sm text-red-300" role="alert">
                                    {error}
                                </p>
                            ) : null}
                            <button
                                className="mt-2 h-9 w-full rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                                disabled={submitting}
                                style={{
                                    background: 'var(--auth-button-background)',
                                    color: 'var(--auth-button-text-color)',
                                }}
                                type="submit"
                            >
                                {submitting ? 'Creating account…' : 'Create account'}
                            </button>
                        </div>
                    </form>
                    <p className="text-center text-sm text-[var(--auth-description-text-color)]">
                        Already have an account?{' '}
                        <Link
                            className="font-medium underline underline-offset-4"
                            style={{ color: 'var(--auth-link-text-color)' }}
                            to="/login"
                        >
                            Log in
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    );
}

function RegisterField({
    autoComplete,
    autoFocus = false,
    id,
    label,
    onChange,
    placeholder,
    style,
    type = 'text',
    value,
}: {
    autoComplete: string;
    autoFocus?: boolean;
    id: string;
    label: string;
    onChange: (value: string) => void;
    placeholder: string;
    style: Record<string, string>;
    type?: 'email' | 'password' | 'text';
    value: string;
}) {
    return (
        <div className="grid gap-2">
            <label
                className="text-sm font-medium"
                htmlFor={id}
                style={{ color: 'var(--auth-label-text-color)' }}
            >
                {label}
            </label>
            <input
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                className="h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none placeholder:opacity-70 focus-visible:ring-2"
                id={id}
                onChange={(event) => onChange(event.currentTarget.value)}
                placeholder={placeholder}
                required
                style={style}
                type={type}
                value={value}
            />
        </div>
    );
}
