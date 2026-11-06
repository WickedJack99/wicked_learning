import { MessageSquareText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';

const sessionKey = 'wicked-learning.feedback-prompt-shown';

/** Source-adapted from PlatformFeedbackPrompt. */
export function OriginalPlatformFeedbackPrompt() {
    const location = useLocation();
    const [visible, setVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (
            location.pathname === '/feedback' ||
            location.pathname === '/settings' ||
            sessionStorage.getItem(sessionKey) === 'true'
        ) {
            return;
        }

        let active = true;
        void apiClient
            .GET('/learner/feedback-prompt-preference')
            .then(({ data, response }) => {
                if (
                    !active ||
                    !response.ok ||
                    !data ||
                    data.status !== 'enabled'
                ) {
                    return;
                }

                sessionStorage.setItem(sessionKey, 'true');
                setVisible(true);
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [location.pathname]);

    async function update(action: 'decline' | 'dismiss'): Promise<void> {
        if (saving) return;

        setSaving(true);
        setVisible(false);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.PATCH(
                '/learner/feedback-prompt-preference',
                {
                    body: { action },
                    params: { header: { 'X-CSRF-Token': token } },
                },
            );
            if (!response.ok) setVisible(true);
        } catch {
            setVisible(true);
        } finally {
            setSaving(false);
        }
    }

    if (!visible) return null;

    return (
        <aside
            aria-label="Platform feedback invitation"
            className="fixed right-4 bottom-4 z-[65] w-[min(24rem,calc(100vw-2rem))] animate-in rounded-xl border p-4 shadow-2xl duration-300 slide-in-from-bottom-4 sm:right-6 sm:bottom-6"
            data-wl-id="learner.feedback.prompt"
            style={{
                background: 'var(--learner-panel-background)',
                borderColor: 'var(--learner-action-accent)',
                color: 'var(--learner-heading-text)',
            }}
        >
            <div className="flex items-start gap-3">
                <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-lg"
                    style={{
                        background: 'var(--learner-accent-soft)',
                        color: 'var(--learner-action-accent)',
                    }}
                >
                    <MessageSquareText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                        Help shape Wicked Learning
                    </p>
                    <p
                        className="mt-1 text-sm leading-5"
                        style={{ color: 'var(--learner-muted-text)' }}
                    >
                        What is helping, confusing or worth changing?
                    </p>
                </div>
                <button
                    aria-label="Close"
                    className="shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    disabled={saving}
                    onClick={() => setVisible(false)}
                    type="button"
                >
                    <X className="size-4" />
                </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                    className="rounded-md bg-[var(--learner-action-accent)] px-3 py-1.5 text-sm font-medium text-slate-950"
                    data-wl-id="learner.feedback.prompt.open"
                    onClick={() => setVisible(false)}
                    to="/feedback"
                >
                    Share feedback
                </Link>
                <button
                    className="rounded-md px-2 py-1.5 text-sm font-medium opacity-80 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    disabled={saving}
                    onClick={() => void update('dismiss')}
                    type="button"
                >
                    Not now
                </button>
                <button
                    className="rounded-md px-2 py-1.5 text-sm font-medium opacity-60 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    disabled={saving}
                    onClick={() => void update('decline')}
                    type="button"
                >
                    Don’t ask again
                </button>
            </div>
        </aside>
    );
}
