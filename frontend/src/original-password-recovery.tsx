import { type FormEvent, type ReactNode, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalAppearanceToggle } from './original-appearance-toggle';
import {
    publicPresentationStyle,
    type PublicPresentation,
} from './public-presentation';

type AuthSurfaceProps = {
    appearance: OriginalAppearance;
    children: ReactNode;
    description: string;
    id: string;
    onAppearanceChange: (appearance: OriginalAppearance) => void;
    presentation: PublicPresentation;
    title: string;
};

/**
 * The retained source AuthSimpleLayout hierarchy, shared only by the two
 * source password-recovery pages. The Rust API replaces Fortify form transport
 * but does not create a new recovery presentation.
 */
function OriginalPasswordRecoverySurface({
    appearance,
    children,
    description,
    id,
    onAppearanceChange,
    presentation,
    title,
}: AuthSurfaceProps) {
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
                data-wl-id={id}
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
                            <span className="sr-only">{title}</span>
                        </Link>
                        <div className="space-y-2 text-center">
                            <h1
                                className="text-xl font-medium"
                                style={{ color: 'var(--auth-title-text-color)' }}
                            >
                                {title}
                            </h1>
                            <p
                                className="text-center text-sm"
                                style={{
                                    color: 'var(--auth-description-text-color)',
                                }}
                            >
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </section>
        </main>
    );
}

export function OriginalForgotPasswordPage({
    appearance,
    onAppearanceChange,
    presentation,
}: Omit<AuthSurfaceProps, 'children' | 'description' | 'id' | 'title'>) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        setStatus(null);
        setSubmitting(true);
        try {
            const csrf = await getCsrfToken();
            const { data, response } = await apiClient.POST('/password/forgot', {
                body: { email },
                params: { header: { 'X-CSRF-Token': csrf } },
            });
            if (response.status === 422) {
                setError("We can't find a user with that email address.");
                return;
            }
            if (response.status === 429) {
                setError('Please wait before retrying.');
                return;
            }
            if (!response.ok || !data) {
                setError('Password reset is temporarily unavailable.');
                return;
            }
            setStatus(data.message);
        } catch {
            setError('Password reset is temporarily unavailable.');
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
        <OriginalPasswordRecoverySurface
            appearance={appearance}
            description="Enter your email to receive a password reset link"
            id="identity.forgot-password"
            onAppearanceChange={onAppearanceChange}
            presentation={presentation}
            title="Forgot password"
        >
            <div className="space-y-6">
                {status ? (
                    <p className="text-center text-sm font-medium text-green-600">
                        {status}
                    </p>
                ) : null}
                <form onSubmit={submit}>
                    <div className="grid gap-2">
                        <label
                            className="text-sm font-medium"
                            htmlFor="email"
                            style={{ color: 'var(--auth-label-text-color)' }}
                        >
                            Email address
                        </label>
                        <input
                            autoComplete="off"
                            autoFocus
                            className="h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none placeholder:opacity-70 focus-visible:ring-2"
                            id="email"
                            onChange={(event) => setEmail(event.currentTarget.value)}
                            placeholder="email@example.com"
                            required
                            style={inputStyle}
                            type="email"
                            value={email}
                        />
                        {error ? (
                            <p className="text-sm text-red-300" role="alert">
                                {error}
                            </p>
                        ) : null}
                    </div>
                    <div className="my-6 flex items-center justify-start">
                        <button
                            className="h-9 w-full rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                            data-test="email-password-reset-link-button"
                            disabled={submitting}
                            style={{
                                background: 'var(--auth-button-background)',
                                color: 'var(--auth-button-text-color)',
                            }}
                            type="submit"
                        >
                            {submitting
                                ? 'Emailing password reset link…'
                                : 'Email password reset link'}
                        </button>
                    </div>
                </form>
                <p
                    className="space-x-1 text-center text-sm"
                    style={{ color: 'var(--auth-description-text-color)' }}
                >
                    <span>Or, return to</span>{' '}
                    <Link
                        className="font-medium underline underline-offset-4"
                        style={{ color: 'var(--auth-link-text-color)' }}
                        to="/login"
                    >
                        log in
                    </Link>
                </p>
            </div>
        </OriginalPasswordRecoverySurface>
    );
}

export function OriginalResetPasswordPage({
    appearance,
    onAppearanceChange,
    presentation,
    token,
}: Omit<AuthSurfaceProps, 'children' | 'description' | 'id' | 'title'> & {
    token: string;
}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const email = searchParams.get('email') ?? '';

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            const csrf = await getCsrfToken();
            const { response } = await apiClient.POST('/password/reset', {
                body: {
                    email,
                    password,
                    password_confirmation: passwordConfirmation,
                    token,
                },
                params: { header: { 'X-CSRF-Token': csrf } },
            });
            if (response.status === 422) {
                setError('The password reset link or replacement password is not valid.');
                return;
            }
            if (!response.ok) {
                setError('Password reset is temporarily unavailable.');
                return;
            }
            navigate('/login?status=password-reset', { replace: true });
        } catch {
            setError('Password reset is temporarily unavailable.');
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
        <OriginalPasswordRecoverySurface
            appearance={appearance}
            description="Please enter your new password below"
            id="identity.reset-password"
            onAppearanceChange={onAppearanceChange}
            presentation={presentation}
            title="Reset password"
        >
            <form className="grid gap-6" onSubmit={submit}>
                <PasswordRecoveryField
                    autoComplete="email"
                    id="email"
                    label="Email"
                    readOnly
                    style={inputStyle}
                    type="email"
                    value={email}
                />
                <PasswordRecoveryField
                    autoComplete="new-password"
                    autoFocus
                    id="password"
                    label="Password"
                    onChange={setPassword}
                    placeholder="Password"
                    style={inputStyle}
                    type="password"
                    value={password}
                />
                <PasswordRecoveryField
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
                    className="mt-4 h-9 w-full rounded-md px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
                    data-test="reset-password-button"
                    disabled={submitting}
                    style={{
                        background: 'var(--auth-button-background)',
                        color: 'var(--auth-button-text-color)',
                    }}
                    type="submit"
                >
                    {submitting ? 'Resetting password…' : 'Reset password'}
                </button>
            </form>
        </OriginalPasswordRecoverySurface>
    );
}

function PasswordRecoveryField({
    autoComplete,
    autoFocus = false,
    id,
    label,
    onChange,
    placeholder,
    readOnly = false,
    style,
    type = 'text',
    value,
}: {
    autoComplete: string;
    autoFocus?: boolean;
    id: string;
    label: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
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
                onChange={(event) => onChange?.(event.currentTarget.value)}
                placeholder={placeholder}
                readOnly={readOnly}
                required={!readOnly}
                style={style}
                type={type}
                value={value}
            />
        </div>
    );
}
