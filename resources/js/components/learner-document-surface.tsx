import type { ReactNode } from 'react';
import { LearningDeskHeader } from '@/features/home/learning-desk-header';
import { cn } from '@/lib/utils';

type LearnerDocumentSurfaceProps = {
    children: ReactNode;
    className?: string;
};

/**
 * Owns the shared frame for learner documents: global navigation and scrolling.
 * Specialized surfaces such as maps, activities and settings keep their own
 * layout because their controls have different fixed-space requirements.
 */
export function LearnerDocumentSurface({
    children,
    className,
}: LearnerDocumentSurfaceProps) {
    return (
        <main
            className={cn(
                'learner-scroll-pane bg-[var(--learner-page-background)] text-[var(--learner-heading-text)]',
                className,
            )}
        >
            <LearningDeskHeader />
            {children}
        </main>
    );
}
