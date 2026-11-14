import { Building2, Flag, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiClient, getCsrfToken } from './api/client';
import type { components } from './api/schema';
import { LearningSupportSettingsShell } from './extracted-learning-support-navigation';
import type { OriginalAppearance } from './original-appearance';

type Report = components['schemas']['OrganizationIconReport'];

/** Source-adapted from the Organization Icons administration panel. */
export function OriginalOrganizationIconModerationPage({
    appearance,
    onSignedOut,
    settingsAccess,
}: {
    appearance: OriginalAppearance;
    onSignedOut: () => void;
    settingsAccess: Record<string, boolean>;
}) {
    const [reports, setReports] = useState<Report[]>([]);
    const [limit, setLimit] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    useEffect(() => {
        let active = true;
        void apiClient.GET('/admin/organization-icon-reports').then(({ data, response }) => {
            if (!active) return;
            if (!response.ok || !data) { setError('Organization icon moderation is temporarily unavailable.'); return; }
            setReports(data.reports);
            setLimit(String(data.policy.max_memberships_per_user));
        }).catch(() => active && setError('Organization icon moderation is temporarily unavailable.')).finally(() => active && setLoading(false));
        return () => { active = false; };
    }, []);
    async function resolve(report: Report, removeIcon: boolean) {
        if (savingId) return;
        setSavingId(report.id); setError('');
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH('/admin/organization-icon-reports/{report_id}', { body: { remove_icon: removeIcon }, params: { header: { 'X-CSRF-Token': token }, path: { report_id: report.id } } });
            if (!response.ok) throw new Error('report unavailable');
            setReports((current) => current.filter((entry) => entry.id !== report.id));
        } catch { setError('The icon report could not be resolved. Please try again.'); }
        finally { setSavingId(null); }
    }
    async function saveLimit() {
        const parsed = Number.parseInt(limit, 10);
        if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100 || savingId) return;
        setSavingId('policy'); setError('');
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH('/admin/organization-policy', { body: { max_memberships_per_user: parsed }, params: { header: { 'X-CSRF-Token': token } } });
            if (!response.ok || !data) throw new Error('policy unavailable');
            setLimit(String(data.max_memberships_per_user));
        } catch { setError('The organization membership limit could not be saved.'); }
        finally { setSavingId(null); }
    }
    return <LearningSupportSettingsShell activeSection="organization-icons" appearance={appearance} onSignedOut={onSignedOut} settingsAccess={settingsAccess}><section className="flex h-full min-h-0 flex-col p-4 sm:p-5" data-wl-id="settings.learning-support.organization-icons"><header className="shrink-0 border-b border-[var(--settings-border-color)] pb-5"><p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">Organizations</p><h1 className="mt-2 text-3xl font-semibold">Organization Icons</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">Review reported icons and organization limits.</p></header><div className="mt-5 grid gap-3 border-b border-[var(--settings-border-color)] pb-4 md:grid-cols-[minmax(0,1fr)_10rem] md:items-end"><div><div className="flex items-center gap-2"><Building2 className="size-4 text-[var(--settings-accent)]" /><h2 className="font-semibold">Organization membership limit</h2></div><p className="mt-1 text-sm text-[var(--settings-muted-text)]">Applies globally to every user.</p></div><div className="flex gap-2"><input aria-label="Organization membership limit" className="w-full rounded-md border border-[var(--settings-border-color)] bg-white px-3 py-2 text-sm text-slate-950 dark:bg-slate-950 dark:text-slate-100" max={100} min={1} onChange={(event) => setLimit(event.target.value)} type="number" value={limit} /><button className="rounded-md bg-[var(--settings-accent)] px-3 py-2 text-sm font-medium text-[var(--settings-accent-foreground)] disabled:opacity-50" disabled={savingId !== null} onClick={() => void saveLimit()} type="button">Save</button></div></div><div className="flex items-center gap-2 border-b border-[var(--settings-border-color)] py-4"><Flag className="size-5 text-[var(--settings-accent)]" /><h2 className="text-lg font-semibold">Pending icon reports</h2></div>{loading ? <p className="py-8 text-sm text-[var(--settings-muted-text)]">Loading organization icon reports...</p> : null}{error ? <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200" role="alert">{error}</p> : null}{!loading && reports.length === 0 ? <p className="border-b border-dashed border-[var(--settings-border-color)] py-5 text-sm text-[var(--settings-muted-text)]">No pending organization icon reports.</p> : null}<div className="min-h-0 flex-1 overflow-y-auto">{reports.map((report) => <article className="grid gap-4 border-b border-[var(--settings-border-color)] py-4 md:grid-cols-[5rem_minmax(0,1fr)_max-content]" key={report.id}><Icon report={report} /><div className="min-w-0"><h3 className="font-semibold">{report.organization.name}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reported by {report.reporter.name ?? 'unknown user'}{report.reporter.email ? ` (${report.reporter.email})` : ''}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Icon set by {report.icon_setter ? `${report.icon_setter.name ?? 'unknown user'}${report.icon_setter.email ? ` (${report.icon_setter.email})` : ''}` : 'unknown user'}</p>{report.reason ? <p className="mt-2 text-sm leading-6">{report.reason}</p> : null}</div><div className="flex flex-wrap gap-2 md:flex-col"><button className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={savingId !== null} onClick={() => void resolve(report, true)} type="button"><ShieldCheck className="size-4" />Remove icon</button><button className="inline-flex items-center gap-2 rounded-md border border-[var(--settings-border-color)] px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] disabled:opacity-50" disabled={savingId !== null} onClick={() => void resolve(report, false)} type="button"><X className="size-4" />Dismiss</button></div></article>)}</div></section></LearningSupportSettingsShell>;
}

function Icon({ report }: { report: Report }) { return <div className="grid size-20 overflow-hidden rounded-xl border border-[var(--settings-border-color)] bg-slate-100 text-slate-500 dark:bg-white/10">{report.icon_url ? <img alt={`${report.organization.name} icon`} className="size-full object-cover" draggable={false} src={report.icon_url} /> : <span className="grid size-full place-items-center"><Building2 className="size-7" /></span>}</div>; }
