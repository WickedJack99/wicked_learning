import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    LearnerAccountControls,
    LearnerBrand,
} from '@/components/learner-account-controls';
import { PlatformFeedbackPrompt } from '@/components/platform-feedback-prompt';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type LearnerNavigationItem = {
    active: boolean;
    href: string;
    id?: string;
    label: string;
    onClick?: () => void;
    icon?: ReactNode;
};

type LearnerNavigationHeaderProps = {
    centerContent?: ReactNode;
    items: LearnerNavigationItem[];
    mapThemed?: boolean;
    position?: 'fixed' | 'sticky';
};

/** Shared learner header used by the desk and immersive learning surfaces. */
export function LearnerNavigationHeader({
    centerContent,
    items,
    mapThemed = false,
    position = 'sticky',
}: LearnerNavigationHeaderProps) {
    const t = usePlatformTranslation();

    return (
        <header
            className={cn(
                'relative',
                position === 'fixed' && 'fixed top-0 right-0 left-0 z-[70]',
                position === 'sticky' && 'sticky top-0 z-40',
                'border-b backdrop-blur-xl',
            )}
            style={{
                background: 'var(--learner-header-background)',
                borderColor: 'var(--learner-border-color)',
            }}
            data-wl-id="learner.navigation.header"
        >
            <a
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-[80] focus:rounded-md focus:bg-[var(--learner-panel-background)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--learner-heading-text)] focus:ring-2 focus:ring-[var(--learner-action-accent)] focus:outline-none"
                href="#learner-main-content"
            >
                {t(
                    'home.learning_desk.navigation.skip_to_content',
                    'Skip to content',
                )}
            </a>
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:px-6 lg:px-8 xl:flex-nowrap">
                <LearnerBrand />

                {centerContent ? (
                    <div className="order-2 min-w-0 basis-full text-center sm:absolute sm:top-1/2 sm:left-1/2 sm:w-[min(32rem,calc(100%-18rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-2">
                        {centerContent}
                    </div>
                ) : null}

                <nav
                    aria-label={t(
                        'home.learning_desk.navigation.label',
                        'Learner navigation',
                    )}
                    className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full flex-wrap gap-0 overflow-visible border-t px-4 xl:order-none xl:mx-0 xl:min-w-0 xl:flex-1 xl:flex-nowrap xl:overflow-visible xl:border-t-0 xl:px-0 2xl:gap-1"
                    style={{ borderColor: 'var(--learner-border-color)' }}
                    data-wl-id="learner.navigation.primary"
                >
                    {items.map((item) => (
                        <LearnerNavigationItem item={item} key={item.label} />
                    ))}
                </nav>

                <LearnerAccountControls mapThemed={mapThemed} />
            </div>
            <PlatformFeedbackPrompt />
        </header>
    );
}

function LearnerNavigationItem({ item }: { item: LearnerNavigationItem }) {
    const className = cn(
        'relative inline-flex shrink-0 items-center gap-2 px-2 py-3 text-sm transition hover:text-[var(--learner-heading-text)] focus-visible:ring-2 focus-visible:ring-[var(--learner-action-accent)] focus-visible:outline-none xl:py-[1.35rem] 2xl:px-3',
        'text-[var(--learner-muted-text)]',
        item.active &&
            'text-[var(--learner-heading-text)] after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-[var(--learner-accent)]',
    );

    if (item.onClick) {
        return (
            <button
                aria-expanded={item.active}
                className={className}
                onClick={item.onClick}
                type="button"
                data-wl-id={`learner.navigation.item.${item.id ?? 'custom'}`}
            >
                {item.icon}
                {item.label}
            </button>
        );
    }

    return (
        <Link
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            className={className}
            href={item.href}
            style={{ cursor: 'var(--platform-action-cursor)' }}
            data-wl-id={`learner.navigation.item.${item.id ?? 'custom'}`}
        >
            {item.icon}
            {item.label}
        </Link>
    );
}
