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
                'flex min-h-svh min-w-0 flex-col overflow-hidden bg-[var(--learner-page-background)] text-[var(--learner-heading-text)] focus:outline-none',
                className,
            )}
        >
            <LearningDeskHeader />
            <div
                className={cn(
                    'min-h-0 flex-1',
                    scrollable
                        ? 'learner-scroll-pane'
                        : 'flex flex-col overflow-hidden',
                )}
            >
                {children}
            </div>
        </main>
    );
}
