import { Head, router, usePage } from '@inertiajs/react';
import { CheckCircle2, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

type FeedbackCategory = 'general' | 'idea' | 'problem' | 'praise';

type FeedbackPageProps = {
    submitted?: boolean;
};

export default function Feedback({ submitted = false }: FeedbackPageProps) {
    const t = usePlatformTranslation();
    const { errors } = usePage().props;
    const [category, setCategory] = useState<FeedbackCategory>('general');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        router.post(
            '/feedback',
            { category, message },
            { onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div
            className="min-h-screen"
            data-wl-id="learner.feedback.page"
            style={{
                background: 'var(--learner-page-background)',
                color: 'var(--learner-heading-text)',
            }}
        >
            <Head title={t('feedback.title', 'Share feedback')} />
            <LearningDeskHeader />
            <main
                className="mx-auto max-w-3xl px-5 py-12 sm:px-8 lg:py-16"
                data-wl-id="learner.feedback.content"
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
                                background: 'var(--learner-accent-soft)',
                                color: 'var(--learner-action-accent)',
                            }}
                        >
                            <MessageSquareText className="size-5" />
                        </span>
                        <div>
                            <p
                                className="text-sm font-medium tracking-[0.16em] uppercase"
                                style={{ color: 'var(--learner-accent)' }}
                            >
                                {t('feedback.eyebrow', 'Platform feedback')}
                            </p>
                            <h1 className="mt-2 text-3xl font-medium tracking-tight">
                                {t('feedback.heading', 'Share what you notice')}
                            </h1>
                        </div>
                    </div>
                    <p
                        className="mt-5 text-sm leading-6"
                        style={{ color: 'var(--learner-muted-text)' }}
                    >
                        {t(
                            'feedback.description',
                            'Tell the platform team what is helping, confusing or worth exploring next. This message is shared deliberately as platform feedback; it is separate from your journal, activity responses and competence evidence.',
                        )}
                    </p>

                    {submitted ? (
                        <div
                            className="mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm"
                            data-wl-id="learner.feedback.success"
                            role="status"
                            style={{
                                background: 'var(--learner-accent-soft)',
                                borderColor: 'var(--learner-action-accent)',
                            }}
                        >
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                            <p>
                                {t(
                                    'feedback.success',
                                    'Thanks. Your feedback has been shared with the platform team.',
                                )}
                            </p>
                        </div>
                    ) : null}

                    <form className="mt-8 grid gap-6" onSubmit={submit}>
                        <label className="grid gap-2 text-sm font-medium">
                            <span>
                                {t(
                                    'feedback.category.label',
                                    'What kind of feedback is this?',
                                )}
                            </span>
                            <select
                                className="h-11 rounded-md border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                data-wl-id="learner.feedback.category"
                                onChange={(event) =>
                                    setCategory(
                                        event.target.value as FeedbackCategory,
                                    )
                                }
                                style={{
                                    borderColor: 'var(--learner-border-color)',
                                }}
                                value={category}
                            >
                                <option value="general">
                                    {t(
                                        'feedback.category.general',
                                        'General feedback',
                                    )}
                                </option>
                                <option value="idea">
                                    {t(
                                        'feedback.category.idea',
                                        'Idea or suggestion',
                                    )}
                                </option>
                                <option value="problem">
                                    {t(
                                        'feedback.category.problem',
                                        'Something is difficult or broken',
                                    )}
                                </option>
                                <option value="praise">
                                    {t(
                                        'feedback.category.praise',
                                        'Something works well',
                                    )}
                                </option>
                            </select>
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                            <span>
                                {t('feedback.message.label', 'Your feedback')}
                            </span>
                            <textarea
                                className="min-h-40 w-full resize-y rounded-md border bg-transparent p-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                                aria-describedby="feedback-message-help"
                                data-wl-id="learner.feedback.message"
                                maxLength={4000}
                                minLength={10}
                                onChange={(event) =>
                                    setMessage(event.target.value)
                                }
                                placeholder={t(
                                    'feedback.message.placeholder',
                                    'What happened, and what would make the experience more useful?',
                                )}
                                rows={8}
                                value={message}
                            />
                            <span
                                className="text-sm font-normal"
                                id="feedback-message-help"
                                style={{ color: 'var(--learner-muted-text)' }}
                            >
                                {t(
                                    'feedback.message.helper',
                                    'At least 10 characters. Please do not include passwords or private information about someone else.',
                                )}
                            </span>
                            {typeof errors.message === 'string' ? (
                                <span className="text-sm text-red-400">
                                    {errors.message}
                                </span>
                            ) : null}
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                disabled={
                                    submitting || message.trim().length < 10
                                }
                                type="submit"
                            >
                                <MessageSquareText className="size-4" />
                                {submitting
                                    ? t('feedback.submitting', 'Sharing...')
                                    : t('feedback.submit', 'Share feedback')}
                            </Button>
                            <button
                                className="text-sm font-medium underline-offset-4 hover:underline"
                                onClick={() => router.visit('/home')}
                                type="button"
                            >
                                {t('feedback.back', 'Back to learning desk')}
                            </button>
                        </div>
                    </form>
                </section>
            </main>
        </div>
    );
}
