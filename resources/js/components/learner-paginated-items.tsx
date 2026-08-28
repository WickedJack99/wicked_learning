import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export function LearnerPaginatedItems<T>({
    className = 'grid gap-3 sm:grid-cols-2',
    emptyState = null,
    items,
    pageSize,
    paginationButtonClassName = 'inline-flex items-center gap-1 text-sm text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-40',
    paginationClassName = 'mt-5 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3',
    paginationTextClassName = 'text-xs text-[var(--learner-muted-text)]',
    renderItem,
}: {
    className?: string;
    emptyState?: ReactNode;
    items: T[];
    pageSize: number;
    paginationButtonClassName?: string;
    paginationClassName?: string;
    paginationTextClassName?: string;
    renderItem: (item: T) => ReactNode;
}) {
    const t = usePlatformTranslation();
    const [page, setPage] = useState(0);
    const pageCount = Math.ceil(items.length / pageSize);
    const currentPage = Math.min(page, Math.max(0, pageCount - 1));

    if (items.length === 0) {
        return emptyState;
    }

    return (
        <>
            <div className={className}>
                {items
                    .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                    .map(renderItem)}
            </div>
            {pageCount > 1 ? (
                <nav
                    aria-label={t('common.pagination.navigation', 'Pagination')}
                    className={paginationClassName}
                >
                    <button
                        aria-label={t(
                            'common.pagination.previous',
                            'Previous items',
                        )}
                        className={cn(
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)]',
                            paginationButtonClassName,
                        )}
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
                        role="status"
                        className={paginationTextClassName}
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
                        className={cn(
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)]',
                            paginationButtonClassName,
                        )}
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
                </nav>
            ) : null}
        </>
    );
}
