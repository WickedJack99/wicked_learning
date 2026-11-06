import { CheckCircle2, MessageSquareText } from 'lucide-react';
import { type CSSProperties, type FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { apiClient, getCsrfToken } from './api/client';
import { OriginalLearnerHeader } from './original-learner-header';

type FeedbackCategory = 'general' | 'idea' | 'problem' | 'praise';

const learnerStyle = {
    '--learner-action-accent': '#5eead4',
    '--learner-accent': '#5eead4',
    '--learner-border-color': 'rgba(255, 255, 255, 0.1)',
    '--learner-heading-text': '#f8fafc',
    '--learner-muted-text': '#cbd5e1',
    '--learner-page-background': '#0b1117',
    '--learner-panel-background': '#111820',
} as CSSProperties;

/** Source-adapted from `pages/feedback.tsx`. */
export function OriginalPlatformFeedbackPage({
    isAuthenticated,
    onSignedOut,
    userEmail,
}: {
    isAuthenticated: boolean;
    onSignedOut: () => void;
    userEmail: string;
}) {
    const [category, setCategory] = useState<FeedbackCategory>('general');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isAuthenticated) {
        return <Navigate replace to="/login" />;
    }

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (submitting || message.trim().length < 10) {
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const token = await getCsrfToken();
            const { response } = await apiClient.POST('/platform-feedback', {
                body: { category, message },
                params: { header: { 'X-CSRF-Token': token } },
            });
            if (!response.ok) {
                throw new Error('feedback unavailable');
            }
            setSubmitted(true);
            setMessage('');
        } catch {
            setError('Your feedback could not be shared. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div
            className="min-h-svh"
            data-wl-id="learner.feedback.page"
            style={{
                ...learnerStyle,
                background: 'var(--learner-page-background)',
                color: 'var(--learner-heading-text)',
            }}
        >
            <OriginalLearnerHeader
                onSignedOut={onSignedOut}
                userEmail={userEmail}
            />
            <main
                className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:py-16"
                data-wl-id="learner.feedback.content"
                id="learner-main-content"
                tabIndex={-1}
            >
                <section
                    className="rounded-2xl border p-6 sm:p-8"
                    data-wl-id="learner.feedback.form"
                    style={{
                        background: 'var(--learner-panel-background)',
                        borderColor: 'var(--learner-border-color)',
                    }}
                >
                    <div className="flex items-start gap-3">
                        <span
                            aria-hidden="true"
                            className="grid size-10 shrink-0 place-items-center rounded-lg"
                            style={{
                                background: 'color-mix(in srgb, var(--learner-action-accent) 18%, transparent)',
                                color: 'var(--learner-action-accent)',
                            }}
                        >
                            <MessageSquareText className="size-5" />
                        </span>
                        <div>
                            <p className="text-sm font-medium tracking-[0.16em] uppercase" style={{ color: 'var(--learner-accent)' }}>
                                Platform feedback
                            </p>
                            <h1 className="mt-2 text-3xl font-medium tracking-tight">
                                Share what you notice
                            </h1>
                        </div>
                    </div>
                    <p className="mt-5 text-sm leading-6" style={{ color: 'var(--learner-muted-text)' }}>
                        Tell the platform team what is helping, confusing or worth exploring next. This message is shared deliberately as platform feedback; it is separate from your journal, activity responses and competence evidence.
                    </p>

                    {submitted ? (
                        <div
                            className="mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm"
                            data-wl-id="learner.feedback.success"
                            role="status"
                            style={{
                                background: 'color-mix(in srgb, var(--learner-action-accent) 14%, transparent)',
                                borderColor: 'var(--learner-action-accent)',
                            }}
                        >
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                            <p>Thanks. Your feedback has been shared with the platform team.</p>
                        </div>
                    ) : null}

                    <form className="mt-8 grid gap-6" onSubmit={(event) => void submit(event)}>
                        <label className="grid gap-2 text-sm font-medium">
                            <span>What kind of feedback is this?</span>
                            <select
                                className="h-11 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                data-wl-id="learner.feedback.category"
                                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                                style={{ borderColor: 'var(--learner-border-color)' }}
                                value={category}
                            >
                                <option value="general">General feedback</option>
                                <option value="idea">Idea or suggestion</option>
                                <option value="problem">Something is difficult or broken</option>
                                <option value="praise">Something works well</option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                            <span>Your feedback</span>
                            <textarea
                                aria-describedby="feedback-message-help"
                                className="min-h-40 w-full resize-y rounded-md border bg-transparent p-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                data-wl-id="learner.feedback.message"
                                maxLength={4000}
                                minLength={10}
                                onChange={(event) => setMessage(event.target.value)}
                                placeholder="What happened, and what would make the experience more useful?"
                                rows={8}
                                style={{ borderColor: 'var(--learner-border-color)' }}
                                value={message}
                            />
                            <span className="text-sm font-normal" id="feedback-message-help" style={{ color: 'var(--learner-muted-text)' }}>
                                At least 10 characters. Please do not include passwords or private information about someone else.
                            </span>
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                className="inline-flex items-center gap-2 rounded-md bg-[var(--learner-action-accent)] px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                                disabled={submitting || message.trim().length < 10}
                                type="submit"
                            >
                                <MessageSquareText className="size-4" />
                                {submitting ? 'Sharing...' : 'Share feedback'}
                            </button>
                            <Link className="text-sm font-medium underline-offset-4 hover:underline" to="/home">
                                Back to learning desk
                            </Link>
                        </div>
                        {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
                    </form>
                </section>
            </main>
        </div>
    );
}
