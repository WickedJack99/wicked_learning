import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';

export function LearnerPaginatedItems<T>({
    className = 'grid gap-3 sm:grid-cols-2',
    items,
    pageSize,
    renderItem,
}: {
    className?: string;
    items: T[];
    pageSize: number;
    renderItem: (item: T) => ReactNode;
}) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState(0);
    const pageCount = Math.ceil(items.length / pageSize);
    const currentPage = Math.min(page, Math.max(0, pageCount - 1));

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            <div className={className}>
                {items
                    .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                    .map(renderItem)}
            </div>
            {pageCount > 1 ? (
                <div className="mt-5 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3">
                    <button
                        aria-label={t(
                            'common.pagination.previous',
                            'Previous items',
                        )}
                        className="inline-flex items-center gap-1 text-sm text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-40"
                        disabled={currentPage === 0}
                        onClick={() =>
                            setPage((value) => Math.max(0, value - 1))
                        }
                        type="button"
                    >
                        <ChevronLeft className="size-4" />
                        {t('common.pagination.previous_short', 'Previous')}
                    </button>
                    <span
                        aria-live="polite"
                        className="text-xs text-[var(--learner-muted-text)]"
                    >
                        {t(
                            'common.pagination.page',
                            'Page :current of :total',
                            {
                                current: currentPage + 1,
                                total: pageCount,
                            },
                        )}
                    </span>
                    <button
                        aria-label={t('common.pagination.next', 'Next items')}
                        className="inline-flex items-center gap-1 text-sm text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-40"
                        disabled={currentPage === pageCount - 1}
                        onClick={() =>
                            setPage((value) =>
                                Math.min(pageCount - 1, value + 1),
                            )
                        }
                        type="button"
                    >
                        {t('common.pagination.next_short', 'Next')}
                        <ChevronRight className="size-4" />
                    </button>
                </div>
            ) : null}
        </>
    );
}
