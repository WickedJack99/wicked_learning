import {
    ArrowLeft,
    Bell,
    Brush,
    KeyRound,
    Languages,
    MessageSquareText,
    UserRound,
    Volume2,
} from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import type { OriginalAppearance } from './original-appearance';
import { OriginalPersonalSettingsNavigation } from './original-personal-settings-navigation';

type Preference = { status: 'enabled' | 'snoozed' | 'declined' };

/** Source-adapted from PersonalSettingsContent's FeedbackPanel. */
export function OriginalPersonalFeedbackPage({
    appearance,
}: {
    appearance: OriginalAppearance;
}) {
    const [preference, setPreference] = useState<Preference | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void apiClient
            .GET('/learner/feedback-prompt-preference')
            .then(({ data, response }) => {
                if (!response.ok || !data) {
                    throw new Error('feedback preference unavailable');
                }

                setPreference(data);
            })
            .catch(() => setError('Feedback invitations could not be loaded.'));
    }, []);

    const invitationsEnabled = preference?.status !== 'declined';

    async function update(): Promise<void> {
        if (!preference || saving) return;

        setSaving(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { data, response } = await apiClient.PATCH(
                '/learner/feedback-prompt-preference',
                {
                    body: { action: invitationsEnabled ? 'decline' : 'enable' },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok || !data) {
                throw new Error('feedback preference unavailable');
            }

            setPreference(data);
        } catch {
            setError('Feedback invitations could not be saved.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <main
            className="settings-surface min-h-svh bg-[var(--settings-content-background)] px-4 py-5 text-slate-950 dark:text-slate-100"
            style={settingsStyle(appearance)}
        >
            <div className="mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-[92rem] flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 pb-5">
                    <div>
                        <Link
                            className="mb-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--settings-muted-text)] transition hover:bg-[var(--settings-active-background)] hover:text-[var(--settings-accent)]"
                            to="/home"
                        >
                            <ArrowLeft className="size-4" />
                            Settings
                        </Link>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            Personal
                        </p>
                        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                            Feedback
                        </h1>
                    </div>
                </header>
                <section className="grid min-h-0 flex-1 gap-4 overflow-hidden border border-[var(--settings-border-color)] bg-[var(--settings-content-background)] p-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                    <OriginalPersonalSettingsNavigation activeSection="feedback" />
                    <div className="min-h-0 overflow-auto bg-[var(--settings-panel-background)] p-5 sm:p-7">
                        <section className="grid max-w-2xl gap-5">
                            <header>
                                <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                                    Feedback
                                </p>
                                <h2 className="mt-2 text-xl font-semibold">
                                    Platform feedback
                                </h2>
                                <p className="mt-2 text-sm leading-6 text-[var(--settings-muted-text)]">
                                    Share feedback about the platform separately
                                    from journal pages and learning activity
                                    responses.
                                </p>
                            </header>
                            <div className="grid gap-4 border-t border-[var(--settings-border-color)] pt-5">
                                <p className="text-sm leading-6 text-[var(--settings-muted-text)]">
                                    {invitationsEnabled
                                        ? 'Occasional invitations to share feedback are enabled.'
                                        : 'Feedback invitations are turned off. You can turn them back on here at any time.'}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        className="inline-flex items-center rounded-md bg-[var(--settings-accent)] px-4 py-2 text-sm font-semibold text-slate-950"
                                        to="/feedback"
                                    >
                                        <MessageSquareText className="mr-2 size-4" />
                                        Open feedback page
                                    </Link>
                                    <button
                                        className="rounded-md border border-[var(--settings-border-color)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                        disabled={!preference || saving}
                                        onClick={() => void update()}
                                        type="button"
                                    >
                                        {saving
                                            ? 'Saving...'
                                            : invitationsEnabled
                                              ? 'Turn off invitations'
                                              : 'Turn invitations back on'}
                                    </button>
                                </div>
                                {error ? (
                                    <p
                                        className="text-sm text-red-500"
                                        role="alert"
                                    >
                                        {error}
                                    </p>
                                ) : null}
                            </div>
                        </section>
                    </div>
                </section>
            </div>
        </main>
    );
}

function settingsStyle(appearance: OriginalAppearance): CSSProperties {
    const dark = appearance === 'dark';
    return {
        '--settings-accent': dark ? '#2dd4bf' : '#0f766e',
        '--settings-active-background': dark
            ? 'rgba(45, 212, 191, 0.12)'
            : '#ccfbf1',
        '--settings-border-color': dark ? 'rgb(255 255 255 / 10%)' : '#e2e8f0',
        '--settings-content-background': dark ? '#0b1117' : '#f1f5f9',
        '--settings-muted-text': dark ? '#94a3b8' : '#64748b',
        '--settings-nested-sidebar-background': dark ? '#111820' : '#ffffff',
        '--settings-panel-background': dark ? '#111820' : '#ffffff',
    } as CSSProperties;
}
