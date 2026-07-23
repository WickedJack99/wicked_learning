import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const defaultAccentColor =
    'var(--settings-accent, var(--map-floating-accent-color, #0891b2))';

type AccentHeadingProps = {
    action?: ReactNode;
    accentColor?: string;
    className?: string;
    description?: ReactNode;
    descriptionClassName?: string;
    eyebrow: ReactNode;
    icon?: ReactNode;
    title: ReactNode;
    titleClassName?: string;
    titleElement?: Extract<ElementType, 'h1' | 'h2' | 'h3'>;
};

export function AccentHeading({
    accentColor = defaultAccentColor,
    action,
    className,
    description,
    descriptionClassName,
    eyebrow,
    icon,
    title,
    titleClassName,
    titleElement: TitleElement = 'h1',
}: AccentHeadingProps) {
    return (
        <header
            className={cn(
                'flex flex-wrap items-start justify-between gap-4',
                className,
            )}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-3">
                    {icon ? (
                        <span
                            className="shrink-0"
                            style={{ color: accentColor }}
                        >
                            {icon}
                        </span>
                    ) : null}
                    <p
                        className="text-xs font-medium tracking-[0.18em] uppercase"
                        style={{ color: accentColor }}
                    >
                        {eyebrow}
                    </p>
                </div>
                <TitleElement
                    className={cn(
                        'mt-2 text-3xl font-semibold tracking-normal',
                        titleClassName,
                    )}
                >
                    {title}
                </TitleElement>
                {description ? (
                    <p
                        className={cn(
                            'mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300',
                            descriptionClassName,
                        )}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {action}
        </header>
    );
}
