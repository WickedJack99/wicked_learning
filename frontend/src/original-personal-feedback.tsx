import { MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsShell } from './original-personal-settings-shell';
import { usePlatformTranslation } from './original-platform-translation';

type Preference = { status: 'enabled' | 'snoozed' | 'declined' };

/** Source-adapted from PersonalSettingsContent's FeedbackPanel. */
export function OriginalPersonalFeedbackPage({ appearance }: { appearance: OriginalAppearance }) {
    const t = usePlatformTranslation();
    const [preference, setPreference] = useState<Preference | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => { void apiClient.GET('/learner/feedback-prompt-preference').then(({ data, response }) => { if (!response.ok || !data) throw new Error('feedback preference unavailable'); setPreference(data); }).catch(() => setError('Feedback invitations could not be loaded.')); }, []);
    const invitationsEnabled = preference?.status !== 'declined';
    async function update(): Promise<void> { if (!preference || saving) return; setSaving(true); setError(null); try { const token = await getCsrfToken(); const { data, response } = await apiClient.PATCH('/learner/feedback-prompt-preference', { body: { action: invitationsEnabled ? 'decline' : 'enable' }, params: { header: { 'X-CSRF-Token': token } } }); if (!response.ok || !data) throw new Error('feedback preference unavailable'); setPreference(data); } catch { setError('Feedback invitations could not be saved.'); } finally { setSaving(false); } }
    return <OriginalPersonalSettingsShell activeSection="feedback" appearance={appearance}><section className="grid gap-5"><header className="flex flex-col gap-4 border-b border-[var(--settings-border-color)] pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="mb-3 flex items-center gap-3 text-[var(--settings-accent)]"><MessageSquareText className="size-5" /><p className="text-xs font-medium tracking-[0.18em] uppercase">{t('settings.personal.sections.feedback', 'Feedback')}</p></div><h1 className="text-2xl font-semibold tracking-normal text-[var(--settings-primary-text)]">{t('settings.personal.feedback.title', 'Platform feedback')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.personal.feedback.description', 'Share feedback about the platform separately from journal pages and learning activity responses.')}</p></div></header><div className="grid w-full min-w-0 gap-4 lg:max-w-[45%]"><p className="text-sm leading-6 text-[var(--settings-muted-text)]">{t('settings.personal.feedback.reminders', invitationsEnabled ? 'Occasional invitations to share feedback are enabled.' : 'Feedback invitations are turned off. You can turn them back on here at any time.')}</p><div className="flex flex-wrap gap-3"><Link className="inline-flex items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950" to="/feedback"><MessageSquareText className="mr-2 size-4" />{t('settings.personal.feedback.open', 'Open feedback page')}</Link><button className="rounded-md border border-[var(--settings-border-color)] px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={!preference || saving} onClick={() => void update()} type="button">{invitationsEnabled ? t('settings.personal.feedback.turn_off', 'Turn off invitations') : t('settings.personal.feedback.turn_on', 'Turn invitations back on')}</button></div>{error ? <p className="text-sm text-red-500" role="alert">{error}</p> : null}</div></section></OriginalPersonalSettingsShell>;
}
