import { ArrowLeft, Brush, KeyRound, Save, UserRound, Volume2 } from 'lucide-react';
import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';

/** Source-adapted from PersonalSettingsContent and ProfileSettingsPanel. */
export function OriginalPersonalProfilePage({ appearance }: { appearance: OriginalAppearance }) {
    const [profile, setProfile] = useState<{ email: string; name: string; username: string }>({ email: '', name: '', username: '' });
    const [saved, setSaved] = useState(profile);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const changed = JSON.stringify(profile) !== JSON.stringify(saved);

    useEffect(() => {
        void apiClient.GET('/account/profile').then(({ data, response }) => {
            if (!response.ok || !data) {
                setMessage('Profile details could not be loaded.');
                return;
            }
            const next = { email: data.email, name: data.name, username: data.username ?? '' };
            setProfile(next);
            setSaved(next);
        }).catch(() => setMessage('Profile details could not be loaded.')).finally(() => setLoading(false));
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving || !changed) return;
        setSaving(true);
        setMessage(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/account/profile', {
                body: { email: profile.email, name: profile.name, username: profile.username || null },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok || !data) {
                setMessage('The profile could not be updated with these details.');
                return;
            }
            const next = { email: data.email, name: data.name, username: data.username ?? '' };
            setProfile(next);
            setSaved(next);
            setMessage('Profile updated.');
        } catch {
            setMessage('The profile could not be updated right now.');
        } finally {
            setSaving(false);
        }
    }

    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}><div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col"><header className="flex shrink-0 items-start justify-between gap-4 pb-5"><div><Link className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/home"><ArrowLeft className="size-4" />Settings</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Personal</p><h1 className="mt-2 text-3xl font-semibold tracking-normal">Profile</h1></div></header><section className="grid min-h-0 flex-1 gap-4 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 md:grid-cols-[16rem_minmax(0,1fr)]"><aside className="h-full min-h-0 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-2"><nav aria-label="Personal settings sections" className="grid gap-2"><div aria-current="page" className="relative flex items-start gap-3 overflow-hidden rounded-lg bg-[var(--settings-active-background)] px-3 py-3 text-left text-sm font-medium text-[var(--settings-accent)]"><UserRound className="mt-0.5 size-4" />Profile</div><Link className="relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=personal&personal=appearance"><Brush className="mt-0.5 size-4" />Appearance</Link><Link className="relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=personal&personal=sound"><Volume2 className="mt-0.5 size-4" />Sound</Link><Link className="relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=personal&personal=security"><KeyRound className="mt-0.5 size-4" />Security</Link></nav></aside><div className="min-h-0 overflow-auto bg-[var(--settings-panel-background)] p-5 sm:p-7"><section className="grid gap-5"><header><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Profile</p><h2 className="mt-2 text-xl font-semibold">Profile details</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">Update account details and the public identity shown to other people later on.</p></header>{loading ? <p className="text-sm text-[var(--settings-muted-text)]">Loading profile details...</p> : <form className="grid max-w-2xl gap-5 border-t border-[var(--settings-border-color)] pt-5" onSubmit={(event) => void submit(event)}><Field autoComplete="name" label="Name" onChange={(value) => setProfile((current) => ({ ...current, name: value }))} required value={profile.name} /><Field autoComplete="nickname" hint="Optional. Use letters, numbers, dashes and underscores. This is the name intended for public learning spaces." label="Public username" onChange={(value) => setProfile((current) => ({ ...current, username: value }))} value={profile.username} /><Field autoComplete="username" label="Email address" onChange={(value) => setProfile((current) => ({ ...current, email: value }))} required type="email" value={profile.email} /><button className="inline-flex w-fit items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" data-test="update-profile-button" disabled={saving || !changed} type="submit"><Save className="mr-2 size-4" />{saving ? 'Saving...' : 'Save profile'}</button></form>}{message ? <p className={message === 'Profile updated.' ? 'text-sm text-emerald-600 dark:text-emerald-300' : 'text-sm text-red-500'} role="status">{message}</p> : null}</section></div></section></div></main>;
}

function Field({ autoComplete, hint, label, onChange, required, type = 'text', value }: { autoComplete: string; hint?: string; label: string; onChange: (value: string) => void; required?: boolean; type?: 'email' | 'text'; value: string }) {
    const id = label.toLowerCase().replaceAll(' ', '_');
    return <label className="grid gap-2" htmlFor={id}><span className="text-sm font-medium">{label}</span><input autoComplete={autoComplete} className="block w-full rounded-md border border-[var(--settings-border-color)] bg-[var(--settings-panel-background)] px-3 py-2 text-sm outline-none focus:border-[var(--settings-accent)] focus:ring-2 focus:ring-[var(--settings-active-background)]" id={id} onChange={(event) => onChange(event.target.value)} placeholder={label === 'Name' ? 'Full name' : label} required={required} type={type} value={value} />{hint ? <span className="text-xs leading-5 text-[var(--settings-muted-text)]">{hint}</span> : null}</label>;
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-nested-sidebar-background': dark ? '#111820' : '#ffffff', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
