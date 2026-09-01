import { Link, router, usePage } from '@inertiajs/react';
import { MessageSquareText, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

/** Offers an occasional, dismissible invitation without interrupting learning. */
export function PlatformFeedbackPrompt() {
    const { props } = usePage();
    const t = usePlatformTranslation();
    const [visible, setVisible] = useState(props.feedbackPrompt === true);
    const [saving, setSaving] = useState(false);

    if (!visible) {
        return null;
    }

    const updatePrompt = (action: 'decline' | 'dismiss') => {
        setSaving(true);
        setVisible(false);
        router.patch(
            '/settings/feedback-prompt',
            { action: action === 'dismiss' ? 'dismiss' : 'decline' },
            {
                preserveScroll: true,
                preserveState: true,
                onError: () => setVisible(true),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <aside
            aria-label={t(
                'feedback.prompt.aria_label',
                'Platform feedback invitation',
            )}
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
                        {t(
                            'feedback.prompt.title',
                            'Help shape Wicked Learning',
                        )}
                    </p>
                    <p
                        className="mt-1 text-sm leading-5"
                        style={{ color: 'var(--learner-muted-text)' }}
                    >
                        {t(
                            'feedback.prompt.description',
                            'What is helping, confusing or worth changing?',
                        )}
                    </p>
                </div>
                <button
                    aria-label={t('common.close', 'Close')}
                    className="shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    disabled={saving}
                    onClick={() => setVisible(false)}
                    type="button"
                >
                    <X className="size-4" />
                </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button asChild size="sm">
                    <Link
                        data-wl-id="learner.feedback.prompt.open"
                        href="/feedback"
                        onClick={() => setVisible(false)}
                    >
                        {t('feedback.prompt.open', 'Share feedback')}
                    </Link>
                </Button>
                <button
                    className="rounded-md px-2 py-1.5 text-sm font-medium opacity-80 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    disabled={saving}
                    onClick={() => updatePrompt('dismiss')}
                    type="button"
                >
                    {t('feedback.prompt.dismiss', 'Not now')}
                </button>
                <button
                    className="rounded-md px-2 py-1.5 text-sm font-medium opacity-60 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    disabled={saving}
                    onClick={() => updatePrompt('decline')}
                    type="button"
                >
                    {t('feedback.prompt.decline', 'Don’t ask again')}
                </button>
            </div>
        </aside>
    );
}
