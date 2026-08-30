import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PaginationControls } from '@/components/pagination-controls';
import { cn } from '@/lib/utils';

export function LearnerPaginatedItems<T>({
    className = 'grid gap-3 sm:grid-cols-2',
    emptyState = null,
    items,
    pageSize,
    paginationLabel,
    paginationButtonClassName = 'inline-flex items-center gap-1 text-sm text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)] disabled:pointer-events-none disabled:opacity-40',
    paginationClassName = 'mt-5 flex items-center justify-between border-t border-[var(--learner-border-color)] pt-3',
    paginationTextClassName = 'text-xs text-[var(--learner-muted-text)]',
    renderItem,
}: {
    className?: string;
    emptyState?: ReactNode;
    items: T[];
    pageSize: number;
    paginationLabel?: string;
    paginationButtonClassName?: string;
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

    const changePage = (nextPage: number) => {
        rememberContentHeight();
        setPage(nextPage - 1);
    };

    if (items.length === 0) {
        return emptyState;
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
            <PaginationControls
                buttonClassName={cn(
                    'text-[var(--learner-action-accent)] transition hover:text-[var(--learner-heading-text)]',
                    paginationButtonClassName,
                )}
                className={paginationClassName}
                currentPage={currentPage + 1}
                label={paginationLabel}
                onPageChange={changePage}
                pageCount={pageCount}
                textClassName={cn(
                    'text-[var(--learner-muted-text)]',
                    paginationTextClassName,
                )}
            />
        </>
    );
}
