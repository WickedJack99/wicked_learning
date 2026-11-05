import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Lifted from `components/learner-paginated-items.tsx` and its pagination
 * control.  It intentionally retains the original one-at-a-time Journal
 * invitation pagination instead of introducing a scrolling substitute.
 */
export function OriginalPaginatedItems<T>({
    className = 'grid gap-3 sm:grid-cols-2',
    items,
    pageSize,
    paginationButtonClassName = 'inline-flex items-center gap-1 text-sm text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-40',
    paginationLabel,
    paginationClassName = 'mt-5 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3',
    paginationTextClassName = 'text-xs text-[var(--learner-muted-text)]',
    renderItem,
}: {
    className?: string;
    items: T[];
    pageSize: number;
    paginationButtonClassName?: string;
    paginationLabel: string;
    paginationClassName?: string;
    paginationTextClassName?: string;
    renderItem: (item: T) => ReactNode;
}) {
    const [page, setPage] = useState(0);
    const [reservedContentHeight, setReservedContentHeight] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const pageCount = Math.ceil(items.length / pageSize);
    const currentPage = Math.min(page, Math.max(0, pageCount - 1));

    const rememberContentHeight = useCallback(() => {
        const contentHeight =
            contentRef.current?.getBoundingClientRect().height;

        if (contentHeight === undefined) {
            return;
        }

        setReservedContentHeight((currentHeight) =>
            Math.max(currentHeight, contentHeight),
        );
    }, []);

    useLayoutEffect(() => {
        rememberContentHeight();
    }, [currentPage, rememberContentHeight]);

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            <div
                className={className}
                ref={contentRef}
                style={{
                    minHeight:
                        reservedContentHeight > 0
                            ? reservedContentHeight
                            : undefined,
                }}
            >
                {items
                    .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                    .map(renderItem)}
            </div>
            <OriginalPaginationControls
                buttonClassName={paginationButtonClassName}
                className={paginationClassName}
                currentPage={currentPage + 1}
                label={paginationLabel}
                onPageChange={(nextPage) => {
                    rememberContentHeight();
                    setPage(nextPage - 1);
                }}
                pageCount={pageCount}
                textClassName={paginationTextClassName}
            />
        </>
    );
}

export function OriginalPaginationControls({
    buttonClassName,
    className,
    currentPage,
    focusOutlineClassName = 'focus-visible:outline-[var(--journal-accent)]',
    focusRingClassName = 'focus-visible:ring-[var(--journal-accent)]',
    label,
    onPageChange,
    pageCount,
    textClassName,
}: {
    buttonClassName: string;
    className: string;
    currentPage: number;
    focusOutlineClassName?: string;
    focusRingClassName?: string;
    label: string;
    onPageChange: (page: number) => void;
    pageCount: number;
    textClassName: string;
}) {
    const inputId = `pagination-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
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

    if (safePageCount <= 1) {
        return null;
    }

    const goToPage = () => {
        const requestedPage = Number(pageInputRef.current?.value ?? '');

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
            aria-label={label}
            className={`flex min-h-8 items-center justify-between gap-3 ${className}`}
        >
            <button
                aria-label="Previous items"
                className={`inline-flex min-w-0 items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 ${focusOutlineClassName} ${buttonClassName}`}
                disabled={safeCurrentPage === 1}
                onClick={() => onPageChange(safeCurrentPage - 1)}
                type="button"
            >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Previous
            </button>
            <span
                aria-live="polite"
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap ${textClassName}`}
            >
                <label className="sr-only" htmlFor={inputId}>
                    Current page
                </label>
                <span aria-hidden="true">Page</span>
                <input
                    aria-label="Current page"
                    className={`h-7 w-12 rounded border border-current/30 bg-transparent px-1 text-center text-inherit outline-none focus-visible:ring-2 ${focusRingClassName}`}
                    defaultValue={safeCurrentPage}
                    id={inputId}
                    inputMode="numeric"
                    max={safePageCount}
                    min={1}
                    onBlur={() => {
                        if (pageInputRef.current?.value === '') {
                            pageInputRef.current.value =
                                String(safeCurrentPage);
                        }
                    }}
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
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            goToPage();
                        }
                    }}
                    ref={pageInputRef}
                    type="number"
                />
                <span aria-hidden="true">of {safePageCount}</span>
            </span>
            <button
                aria-label="Next items"
                className={`inline-flex min-w-0 items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 ${focusOutlineClassName} ${buttonClassName}`}
                disabled={safeCurrentPage === safePageCount}
                onClick={() => onPageChange(safeCurrentPage + 1)}
                type="button"
            >
                Next
                <ChevronRight aria-hidden="true" className="size-4" />
            </button>
        </nav>
    );
}
