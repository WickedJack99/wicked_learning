import type { ReactNode } from 'react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { cn } from '@/lib/utils';

type LearnerDocumentSurfaceProps = {
    children: ReactNode;
    className?: string;
    scrollable?: boolean;
};

/**
 * Owns the shared frame for learner documents: global navigation and scrolling.
 * Specialized surfaces such as maps, activities and settings keep their own
 * layout because their controls have different fixed-space requirements.
 */
export function LearnerDocumentSurface({
    children,
    className,
    scrollable = true,
}: LearnerDocumentSurfaceProps) {
    return (
        <main
            id="learner-main-content"
            tabIndex={-1}
            className={cn(
                scrollable
                    ? 'learner-scroll-pane'
                    : 'flex min-h-0 flex-1 flex-col overflow-hidden',
                'bg-[var(--learner-page-background)] text-[var(--learner-heading-text)] focus:outline-none',
                className,
            )}
        >
            <LearningDeskHeader />
            {children}
        </main>
    );
}
