import { ArrowLeft, Brush, Eye, EyeOff, KeyRound, Save, Volume2 } from 'lucide-react';
import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalTwoFactorManagement } from './original-two-factor-management';
import { OriginalPasskeyManagement } from './original-passkey';

/**
 * Source-adapted from the password-confirmed Security settings route and
 * SecuritySettingsPanel.
 * Its password, authenticator-app and passkey controls retain their source
 * ordering; only Laravel/Inertia transport is replaced by typed Rust calls.
 */
export function OriginalPersonalSecurityPage({ appearance }: { appearance: OriginalAppearance }) {
    const navigate = useNavigate();
    const [passwordConfirmed, setPasswordConfirmed] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const changed = currentPassword !== '' || password !== '' || passwordConfirmation !== '';

    useEffect(() => {
        let isCurrent = true;

        void apiClient
            .GET('/account/password/confirmation')
            .then(({ data, response }) => {
                if (!isCurrent) {
                    return;
                }
                if (response.ok && data?.confirmed) {
                    setPasswordConfirmed(true);
                    return;
                }
                navigate(
                    '/confirm-password?next=%2Fsettings%3Fpanel%3Dpersonal%26personal%3Dsecurity',
                    { replace: true },
                );
            })
            .catch(() => {
                if (isCurrent) {
                    navigate(
                        '/confirm-password?next=%2Fsettings%3Fpanel%3Dpersonal%26personal%3Dsecurity',
                        { replace: true },
                    );
                }
            });

        return () => {
            isCurrent = false;
        };
    }, [navigate]);

    if (!passwordConfirmed) {
        return null;
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !changed) return;
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

    const inputType = showPasswords ? 'text' : 'password';
    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
            <header className="flex shrink-0 items-start justify-between gap-4 pb-5"><div><Link className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/home"><ArrowLeft className="size-4" />Settings</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Personal</p><h1 className="mt-2 text-3xl font-semibold tracking-normal">Security</h1></div></header>
            <section className="grid min-h-0 flex-1 gap-4 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                <aside className="h-full min-h-0 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-2"><nav aria-label="Personal settings sections" className="grid gap-2"><Link className="relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=personal&personal=appearance"><Brush className="mt-0.5 size-4" />Appearance</Link><Link className="relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=personal&personal=sound"><Volume2 className="mt-0.5 size-4" />Sound</Link><div aria-current="page" className="relative flex items-start gap-3 overflow-hidden rounded-lg bg-[var(--settings-active-background)] px-3 py-3 text-left text-sm font-medium text-[var(--settings-accent)]"><KeyRound className="mt-0.5 size-4" />Security</div></nav></aside>
                <div className="min-h-0 overflow-auto bg-[var(--settings-panel-background)] p-5 sm:p-7"><section className="grid gap-5"><header><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Security</p><h2 className="mt-2 text-xl font-semibold">Update password</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">Use a long, random password to keep your account secure.</p></header><form className="grid max-w-2xl gap-5 border-t border-[var(--settings-border-color)] pt-5" onSubmit={(event) => void submit(event)}><PasswordField autoComplete="current-password" label="Current password" onChange={setCurrentPassword} type={inputType} value={currentPassword} /><PasswordField autoComplete="new-password" label="New password" onChange={setPassword} type={inputType} value={password} /><PasswordField autoComplete="new-password" label="Confirm password" onChange={setPasswordConfirmation} type={inputType} value={passwordConfirmation} /><button className="inline-flex w-fit items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" data-test="update-password-button" disabled={saving || !changed} type="submit"><Save className="mr-2 size-4" />{saving ? 'Saving...' : 'Save password'}</button></form><button aria-label={showPasswords ? 'Hide password' : 'Show password'} className="inline-flex w-fit items-center gap-2 text-sm text-[var(--settings-muted-text)] hover:text-[var(--settings-accent)]" onClick={() => setShowPasswords((current) => !current)} type="button">{showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{showPasswords ? 'Hide passwords' : 'Show passwords'}</button>{message ? <p className={message === 'Password updated.' ? 'text-sm text-emerald-600 dark:text-emerald-300' : 'text-sm text-red-500'} role="status">{message}</p> : null}</section><OriginalTwoFactorManagement /><section className="mt-5 border-t border-[var(--settings-border-color)] pt-5"><OriginalPasskeyManagement /></section></div>
            </section>
        </div>
    </main>;
}

function PasswordField({ autoComplete, label, onChange, type, value }: { autoComplete: string; label: string; onChange: (value: string) => void; type: 'password' | 'text'; value: string }) {
    const id = label.toLowerCase().replaceAll(' ', '_');
    return <label className="grid gap-2" htmlFor={id}><span className="text-sm font-medium">{label}</span><input autoComplete={autoComplete} className="block w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-active-background)]" id={id} onChange={(event) => onChange(event.target.value)} placeholder={label} required type={type} value={value} /></label>;
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-nested-sidebar-background': dark ? '#111820' : '#ffffff', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
