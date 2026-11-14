import { Eye, EyeOff, KeyRound, Save } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPasskeyManagement } from './original-passkey';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { usePlatformTranslation } from './original-platform-translation';
import { OriginalTwoFactorManagement } from './original-two-factor-management';

/** Source-adapted from the password-confirmed Security settings route and SecuritySettingsPanel. */
export function OriginalPersonalSecurityPage({
    appearance,
    confirmationReturnPath = '/settings?panel=personal&personal=security',
}: {
    appearance: OriginalAppearance;
    confirmationReturnPath?: string;
}) {
    const navigate = useNavigate();
    const t = usePlatformTranslation();
    const [confirmed, setConfirmed] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const changed =
        currentPassword !== '' || password !== '' || passwordConfirmation !== '';
    const confirmationPath = `/confirm-password?next=${encodeURIComponent(confirmationReturnPath)}`;

    useEffect(() => {
        let active = true;

        void apiClient
            .GET('/account/password/confirmation')
            .then(({ data, response }) => {
                if (!active) {
                    return;
                }

                if (response.ok && data?.confirmed) {
                    setConfirmed(true);
                    return;
                }

                navigate(confirmationPath, { replace: true });
            })
            .catch(() => {
                if (active) {
                    navigate(confirmationPath, { replace: true });
                }
            });

        return () => {
            active = false;
        };
    }, [confirmationPath, navigate]);

    if (!confirmed) {
        return null;
    }

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        if (saving || !changed) {
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH('/account/password', {
                body: {
                    current_password: currentPassword,
                    password,
                    password_confirmation: passwordConfirmation,
                },
                params: { header: { 'X-CSRF-Token': token } },
            });

            if (!response.ok) {
                setMessage('The password could not be updated with these details.');
                return;
            }

            setCurrentPassword('');
            setPassword('');
            setPasswordConfirmation('');
            setMessage('Password updated.');
        } catch {
            setMessage('The password could not be updated right now.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <OriginalPersonalSettingsShell
            activeSection="security"
            appearance={appearance}
            footerAction={
                <div className="w-full lg:max-w-[45%]">
                    <button
                        className="inline-flex w-full items-center justify-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                        data-test="update-password-button"
                        disabled={saving || !changed}
                        form="personal-security-form"
                        type="submit"
                    >
                        <Save className="mr-2 size-4" />
                        {saving
                            ? t('common.saving', 'Saving...')
                            : t('common.save', 'Save')}
                    </button>
                </div>
            }
        >
            <div className="grid gap-5">
                <section className="grid gap-5">
                    <header className="border-b border-[var(--settings-border-color)] pb-5">
                        <div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]">
                            <KeyRound className="size-5" />
                            <p className="text-xs font-medium tracking-[.18em] uppercase">
                                {t('settings.personal.security.eyebrow', 'Security')}
                            </p>
                        </div>
                        <h1 className="text-2xl font-semibold text-[var(--settings-primary-text)]">
                            {t(
                                'settings.personal.security.title',
                                'Update password',
                            )}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.personal.security.description',
                                'Use a long, random password to keep your account secure.',
                            )}
                        </p>
                    </header>
                    <form
                        className="grid w-full min-w-0 gap-5 lg:max-w-[45%]"
                        id="personal-security-form"
                        onSubmit={(event) => void submit(event)}
                    >
                        <PasswordField
                            autoComplete="current-password"
                            id="current_password"
                            label={t(
                                'settings.personal.security.current_password',
                                'Current password',
                            )}
                            onChange={setCurrentPassword}
                            value={currentPassword}
                        />
                        <PasswordField
                            autoComplete="new-password"
                            id="password"
                            label={t(
                                'settings.personal.security.new_password',
                                'New password',
                            )}
                            onChange={setPassword}
                            value={password}
                        />
                        <PasswordField
                            autoComplete="new-password"
                            id="password_confirmation"
                            label={t(
                                'settings.personal.security.confirm_password',
                                'Confirm password',
                            )}
                            onChange={setPasswordConfirmation}
                            value={passwordConfirmation}
                        />
                    </form>
                    {message ? (
                        <p
                            className={
                                message === 'Password updated.'
                                    ? 'text-sm text-emerald-600 dark:text-emerald-300'
                                    : 'text-sm text-red-500'
                            }
                            role="status"
                        >
                            {message}
                        </p>
                    ) : null}
                </section>
                <div className="w-full min-w-0 lg:max-w-[45%]">
                    <section className="border-t border-[var(--settings-border-color)] pt-5">
                        <OriginalTwoFactorManagement />
                    </section>
                </div>
                <div className="w-full min-w-0 lg:max-w-[45%]">
                    <section className="border-t border-[var(--settings-border-color)] pt-5">
                        <OriginalPasskeyManagement />
                    </section>
                </div>
            </div>
        </OriginalPersonalSettingsShell>
    );
}

function PasswordField({
    autoComplete,
    id,
    label,
    onChange,
    value,
}: {
    autoComplete: string;
    id: string;
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <label className="grid gap-2" htmlFor={id}>
            <span className="text-sm font-medium">{label}</span>
            <span className="relative">
                <input
                    autoComplete={autoComplete}
                    className="block w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 pr-10 text-sm outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-active-background)]"
                    id={id}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={label}
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                />
                <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-[var(--settings-muted-text)] hover:text-[var(--settings-primary-text)] focus-visible:ring-2 focus-visible:ring-[var(--settings-accent)] focus-visible:outline-none"
                    onClick={() => setShowPassword((shown) => !shown)}
                    tabIndex={-1}
                    type="button"
                >
                    {showPassword ? (
                        <EyeOff className="size-4" />
                    ) : (
                        <Eye className="size-4" />
                    )}
                </button>
            </span>
        </label>
    );
}
