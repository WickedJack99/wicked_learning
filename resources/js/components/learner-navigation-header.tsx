import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import {
    LearnerAccountControls,
    LearnerBrand,
} from '@/components/learner-account-controls';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';

export type LearnerNavigationItem = {
    active: boolean;
    href: string;
    label: string;
    onClick?: () => void;
    icon?: ReactNode;
};

type LearnerNavigationHeaderProps = {
    items: LearnerNavigationItem[];
    mapThemed?: boolean;
    position?: 'fixed' | 'sticky';
};

/** Shared learner header used by the desk and immersive learning surfaces. */
export function LearnerNavigationHeader({
    items,
    mapThemed = false,
    position = 'sticky',
}: LearnerNavigationHeaderProps) {
    const t = usePlatformTranslation();

    return (
        <header
            className={cn(
                position === 'fixed' && 'fixed top-0 right-0 left-0 z-[70]',
                position === 'sticky' && 'sticky top-0 z-40',
                'border-b border-slate-200/80 bg-slate-50/94 backdrop-blur-xl dark:border-white/10 dark:bg-[#08111b]/94',
            )}
        >
            <div className="flex min-h-16 flex-wrap items-center gap-x-5 px-4 sm:flex-nowrap sm:px-6 lg:px-8">
                <LearnerBrand />

                <nav
                    aria-label={t(
                        'home.learning_desk.navigation.label',
                        'Learner navigation',
                    )}
                    className="order-3 -mx-4 flex w-[calc(100%+2rem)] basis-full gap-1 overflow-x-auto border-t border-slate-200/70 px-4 sm:order-none sm:mx-0 sm:w-auto sm:basis-auto sm:border-t-0 sm:px-0 dark:border-white/8"
                >
                    {items.map((item) => (
                        <LearnerNavigationItem item={item} key={item.label} />
                    ))}
                </nav>

                <LearnerAccountControls mapThemed={mapThemed} />
            </div>
        </header>
    );
}

function LearnerNavigationItem({ item }: { item: LearnerNavigationItem }) {
    const className = cn(
        'relative inline-flex shrink-0 items-center gap-2 px-3 py-3 text-sm text-slate-500 transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none sm:py-[1.35rem] dark:text-slate-400 dark:hover:text-white',
        item.active &&
            'text-slate-950 after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-violet-500 dark:text-white',
    );

    if (item.onClick) {
        return (
            <button
                aria-expanded={item.active}
                className={className}
                onClick={item.onClick}
                type="button"
            >
                {item.icon}
                {item.label}
            </button>
        );
    }

    return (
        <Link
            aria-label={item.label}
            className={className}
            href={item.href}
            style={{ cursor: 'var(--platform-action-cursor)' }}
        >
            {item.icon}
            {item.label}
        </Link>
    );
}
