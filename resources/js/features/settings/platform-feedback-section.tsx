import { router } from '@inertiajs/react';
import { Check, MessageSquareText } from 'lucide-react';
import { PaginationControls } from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export type PlatformFeedbackSectionProps = {
    items: PlatformFeedbackItem[];
    pagination: {
        currentPage: number;
        lastPage: number;
        perPage: number;
        total: number;
    };
};

type PlatformFeedbackItem = {
    category: 'general' | 'idea' | 'problem' | 'praise' | string;
    id: number;
    message: string;
    reviewedAt: string | null;
    submittedAt: string | null;
    user: { email: string | null; id: number | null; name: string | null };
};

export function PlatformFeedbackSection({
    items,
    pagination,
}: PlatformFeedbackSectionProps) {
    const t = usePlatformTranslation();

    return (
        <section
            className="flex h-full min-h-0 flex-col"
            data-wl-id="settings.learning-support.platform-feedback"
        >
            <header className="shrink-0 border-b border-[var(--settings-border-color)] px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                    <MessageSquareText
                        className="mt-1 size-5 shrink-0 text-[var(--settings-accent)]"
                        aria-hidden="true"
                    />
                    <div>
                        <p className="text-xs font-medium tracking-[0.18em] text-[var(--settings-accent)] uppercase">
                            {t(
                                'settings.platform_feedback.eyebrow',
                                'Platform feedback',
                            )}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold">
                            {t(
                                'settings.platform_feedback.title',
                                'Shared feedback',
                            )}
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--settings-muted-text)]">
                            {t(
                                'settings.platform_feedback.description',
                                'Messages here were deliberately shared by learners about the platform. They are separate from journal content and learning evidence.',
                            )}
                        </p>
                    </div>
                </div>
            </header>
            <div
                className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5"
                data-wl-id="settings.learning-support.platform-feedback.list"
            >
                {items.length > 0 ? (
                    <div className="grid gap-3">
                        {items.map((item) => (
                            <article
                                className="rounded-lg border border-[var(--settings-border-color)] p-4"
                                data-wl-id={`settings.platform-feedback.item.${item.id}`}
                                key={item.id}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold">
                                            {categoryLabel(item.category, t)}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--settings-muted-text)]">
                                            {item.user.name ??
                                                item.user.email ??
                                                t(
                                                    'common.unknown',
                                                    'Unknown',
                                                )}{' '}
                                            · {formatDate(item.submittedAt)}
                                        </p>
                                    </div>
                                    {item.reviewedAt ? (
                                        <span className="inline-flex items-center gap-1 text-xs text-[var(--settings-muted-text)]">
                                            <Check className="size-3" />
                                            {t(
                                                'settings.platform_feedback.reviewed',
                                                'Reviewed',
                                            )}
                                        </span>
                                    ) : (
                                        <Button
                                            data-wl-id={`settings.platform-feedback.review.${item.id}`}
                                            onClick={() =>
                                                router.patch(
                                                    `/settings/learning-support/platform-feedback/${item.id}/review`,
                                                )
                                            }
                                            size="sm"
                                            variant="outline"
                                        >
                                            <Check className="size-3" />
                                            {t(
                                                'settings.platform_feedback.mark_reviewed',
                                                'Mark reviewed',
                                            )}
                                        </Button>
                                    )}
                                </div>
                                <p className="mt-4 text-sm leading-6 whitespace-pre-wrap">
                                    {item.message}
                                </p>
                            </article>
                        ))}
                    </div>
                ) : (
                    <p className="rounded-lg border border-dashed border-[var(--settings-border-color)] p-6 text-sm text-[var(--settings-muted-text)]">
                        {t(
                            'settings.platform_feedback.empty',
                            'No platform feedback has been shared yet.',
                        )}
                    </p>
                )}
            </div>
            <footer className="shrink-0 border-t border-[var(--settings-border-color)] px-4 py-3 sm:px-5">
                <PaginationControls
                    currentPage={pagination.currentPage}
                    label={t(
                        'settings.platform_feedback.pagination',
                        'Platform feedback pagination',
                    )}
                    nextLabel={t(
                        'settings.platform_feedback.next',
                        'Next feedback page',
                    )}
                    onPageChange={(page) => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('support', 'platform-feedback');
                        url.searchParams.set(
                            'platform_feedback_page',
                            String(page),
                        );
                        router.visit(url.toString(), { preserveScroll: true });
                    }}
                    pageCount={pagination.lastPage}
                    previousLabel={t(
                        'settings.platform_feedback.previous',
                        'Previous feedback page',
                    )}
                    showSinglePage
                />
            </footer>
        </section>
    );
}

function categoryLabel(
    category: string,
    t: ReturnType<typeof usePlatformTranslation>,
): string {
    return t(
        `feedback.category.${category}`,
        category.charAt(0).toUpperCase() + category.slice(1),
    );
}

function formatDate(value: string | null): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
