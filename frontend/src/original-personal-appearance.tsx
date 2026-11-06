import { ArrowLeft, Brush, Moon, Sun, Volume2 } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { Link } from 'react-router';

import type { OriginalAppearance } from './original-appearance';

/** Source-adapted from AppearanceSettingsPanel and its single-section settings shell. */
export function OriginalPersonalAppearancePage({ appearance, onAppearanceChange }: {
    appearance: OriginalAppearance;
    onAppearanceChange: (appearance: OriginalAppearance) => Promise<void>;
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modes = [{ icon: Sun, label: 'Light', value: 'light' as const }, { icon: Moon, label: 'Dark', value: 'dark' as const }];
    async function select(next: OriginalAppearance) {
        if (next === appearance || saving) return;
        setSaving(true); setError(null);
        try { await onAppearanceChange(next); } catch { setError('The appearance preference could not be saved.'); } finally { setSaving(false); }
    }
    return <main className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100" style={settingsStyle(appearance)}>
        <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
            <header className="flex shrink-0 items-start justify-between gap-4 pb-5"><div><Link className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/home"><ArrowLeft className="size-4" />Settings</Link><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Personal</p><h1 className="mt-2 text-3xl font-semibold tracking-normal">Appearance</h1></div></header>
            <section className="grid min-h-0 flex-1 gap-4 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                <aside className="h-full min-h-0 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-nested-sidebar-background)] p-2"><nav className="grid gap-2"><button aria-current="page" className="relative flex items-start gap-3 overflow-hidden rounded-lg bg-[var(--settings-active-background)] px-3 py-3 text-left text-sm font-medium text-[var(--settings-accent)]" type="button"><Brush className="mt-0.5 size-4" /> Appearance</button><Link className="relative flex items-start gap-3 overflow-hidden rounded-lg px-3 py-3 text-left text-sm font-medium text-[var(--settings-muted-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]" to="/settings?panel=personal&personal=sound"><Volume2 className="mt-0.5 size-4" />Sound</Link></nav></aside>
                <div className="min-h-0 overflow-auto bg-[var(--settings-panel-background)] p-5 sm:p-7"><section className="grid gap-5"><header><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Appearance</p><h2 className="mt-2 text-xl font-semibold">Visual mode</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--settings-muted-text)]">Choose the appearance used after signing in.</p></header><div className="max-w-2xl border-t border-[var(--settings-border-color)] pt-5"><div className="settings-rounded-control inline-flex gap-1 rounded-lg border border-[var(--settings-border-color)] bg-[var(--settings-appearance-switch-background)] p-1">{modes.map(({ icon: Icon, label, value }) => <button aria-pressed={appearance === value} className={`flex items-center rounded-md px-3.5 py-1.5 transition-colors ${appearance === value ? 'bg-[var(--settings-appearance-switch-active-background)] text-[var(--settings-appearance-switch-active-text)] shadow-xs' : 'text-[var(--settings-appearance-switch-inactive-text)] hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]'}`} disabled={saving} key={value} onClick={() => void select(value)} type="button"><Icon className="-ml-1 size-4" /><span className="ml-1.5 text-sm">{label}</span></button>)}</div>{saving ? <p className="mt-3 text-sm text-[var(--settings-muted-text)]">Saving appearance…</p> : null}{error ? <p className="mt-3 text-sm text-red-500" role="alert">{error}</p> : null}</div></section></div>
            </section>
        </div>
    </main>;
}
function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return { '--settings-accent': dark ? '#2dd4bf' : '#0f766e', '--settings-active-background': dark ? 'rgba(45, 212, 191, 0.12)' : '#ccfbf1', '--settings-appearance-switch-active-background': dark ? '#111820' : '#ffffff', '--settings-appearance-switch-active-text': dark ? '#5eead4' : '#0f766e', '--settings-appearance-switch-background': dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', '--settings-appearance-switch-inactive-text': dark ? '#94a3b8' : '#64748b', '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0', '--settings-content-background': dark ? '#0b1117' : '#f1f5f9', '--settings-muted-text': dark ? '#94a3b8' : '#64748b', '--settings-nested-sidebar-background': dark ? '#111820' : '#ffffff', '--settings-panel-background': dark ? '#111820' : '#ffffff' } as CSSProperties;
}
