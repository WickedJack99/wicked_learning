import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useLayoutEffect, useRef } from 'react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export function PaginationControls({
    currentPage,
    pageCount,
    onPageChange,
    label,
    previousLabel,
    nextLabel,
    className,
    buttonClassName,
    textClassName,
    showSinglePage,
}: {
    currentPage: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    label?: string;
    previousLabel?: string;
    nextLabel?: string;
    className?: string;
    buttonClassName?: string;
    textClassName?: string;
    showSinglePage?: boolean;
}) {
    const t = usePlatformTranslation();
    const inputId = useId();
    const safePageCount = Math.max(1, pageCount);
    const safeCurrentPage = Math.min(Math.max(1, currentPage), safePageCount);
    const pageInputRef = useRef<HTMLInputElement>(null);
    const lastValidInputRef = useRef(String(safeCurrentPage));

    useLayoutEffect(() => {
        lastValidInputRef.current = String(safeCurrentPage);

        if (pageInputRef.current) {
            pageInputRef.current.value = String(safeCurrentPage);
        }
    }, [safeCurrentPage]);

    if (safePageCount <= 1 && !showSinglePage) {
        return null;
    }

    const goToPage = () => {
        const pageInput = pageInputRef.current?.value ?? '';
        const requestedPage = Number(pageInput);

        if (
            !Number.isInteger(requestedPage) ||
            requestedPage < 1 ||
            requestedPage > safePageCount
        ) {
            if (pageInputRef.current) {
                pageInputRef.current.value = String(safeCurrentPage);
            }

            return;
        }

        onPageChange(requestedPage);
    };

    return (
        <nav
            aria-label={
                label ?? t('common.pagination.navigation', 'Pagination')
            }
            className={cn(
                'flex min-h-8 items-center justify-between gap-3',
                className,
            )}
        >
            <button
                aria-label={
                    previousLabel ??
                    t('common.pagination.previous', 'Previous items')
                }
                className={cn(
                    'inline-flex min-w-0 items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)] disabled:pointer-events-none disabled:opacity-40',
                    buttonClassName,
                )}
                disabled={safeCurrentPage === 1}
                onClick={() => onPageChange(safeCurrentPage - 1)}
                type="button"
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {t('common.pagination.previous_short', 'Previous')}
            </button>
            <span
                aria-live="polite"
                className={cn(
                    'inline-flex shrink-0 items-center gap-1 whitespace-nowrap',
                    textClassName,
                )}
            >
                <label className="sr-only" htmlFor={inputId}>
                    {t('common.pagination.current_page', 'Current page')}
                </label>
                <span aria-hidden="true">
                    {t('common.pagination.page_label', 'Page')}
                </span>
                <input
                    aria-label={t(
                        'common.pagination.current_page',
                        'Current page',
                    )}
                    className="h-7 w-12 rounded border border-current/30 bg-transparent px-1 text-center text-inherit outline-none focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)]"
                    id={inputId}
                    inputMode="numeric"
                    max={safePageCount}
                    min={1}
                    defaultValue={safeCurrentPage}
                    onBlur={() => {
                        if (pageInputRef.current?.value === '') {
                            pageInputRef.current.value =
                                String(safeCurrentPage);
                        }
                    }}
                    ref={pageInputRef}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                        const value = event.currentTarget.value;

                        if (value === '') {
                            return;
                        }

                        if (!/^\d+$/.test(value)) {
                            event.currentTarget.value =
                                lastValidInputRef.current;

                            return;
                        }

                        const requestedPage = Number(value);

                        if (
                            requestedPage < 1 ||
                            requestedPage > safePageCount
                        ) {
                            event.currentTarget.value =
                                lastValidInputRef.current;

                            return;
                        }

                        lastValidInputRef.current = value;
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            goToPage();
                        }
                    }}
                    type="number"
                />
                <span aria-hidden="true">
                    {t('common.pagination.of', 'of')} {safePageCount}
                </span>
            </span>
            <button
                aria-label={
                    nextLabel ?? t('common.pagination.next', 'Next items')
                }
                className={cn(
                    'inline-flex min-w-0 items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--learner-action-accent)] disabled:pointer-events-none disabled:opacity-40',
                    buttonClassName,
                )}
                disabled={safeCurrentPage === safePageCount}
                onClick={() => onPageChange(safeCurrentPage + 1)}
                type="button"
            >
                {t('common.pagination.next_short', 'Next')}
                <ChevronRight aria-hidden="true" className="size-4" />
            </button>
        </nav>
    );
}
