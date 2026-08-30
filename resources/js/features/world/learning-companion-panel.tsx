import { Link } from '@inertiajs/react';
import { ArrowRight, Compass } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePlatformTranslation } from '@/hooks/use-platform-translation';
import { cn } from '@/lib/utils';
import type { LearningCompanion } from '@/types';

type LearningCompanionPlacement = 'default' | 'map-search';

export function LearningCompanionPanel({
    companion,
}: {
    companion: LearningCompanion;
}) {
    const t = usePlatformTranslation();
    const contextEntries = [
        companion.context.topic
            ? [t('learning.companion.context.topic', 'Topic'), companion.context.topic.title]
            : null,
        companion.context.map
            ? [t('learning.companion.context.map', 'Map'), companion.context.map.title]
            : null,
        companion.context.node
            ? [t('learning.companion.context.place', 'Place'), companion.context.node.title]
            : null,
        companion.context.activity
            ? [
                  t('learning.companion.context.activity', 'Activity'),
                  companion.context.activity.title,
              ]
            : null,
        companion.context.route
            ? [t('learning.companion.context.route', 'Route'), companion.context.route.title]
            : null,
    ].filter((entry): entry is [string, string] => entry !== null).slice(0, 4);

    return (
        <div className="grid gap-4">
            <div className="flex items-start gap-3">
                <div
                    className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border"
                    style={{
                        backgroundColor: companion.avatarColor,
                        borderColor: companion.avatarColor,
                    }}
                >
                    {companion.avatarUrl ? (
                        <img
                            alt=""
                            className="size-full object-cover"
                            src={companion.avatarUrl}
                        />
                    ) : (
                        <Compass className="size-5 text-[var(--map-side-control-panel-background)]" />
                    )}
                </div>
                <p className="text-sm leading-6 text-[var(--map-side-control-text-color)]">
                    {companion.message}
                </p>
            </div>

            {contextEntries.length > 0 ? (
                <dl className="grid gap-2 border-t border-[var(--map-side-control-panel-border-color)] pt-3">
                    {contextEntries.map(([label, value]) => (
                        <div className="flex items-baseline justify-between gap-3" key={label}>
                            <dt className="text-xs font-medium tracking-[0.12em] text-[var(--map-side-control-muted-text-color)] uppercase">
                                {label}
                            </dt>
                            <dd className="truncate text-right text-xs font-semibold text-[var(--map-side-control-text-color)]">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
            ) : null}

            <div className="grid gap-2 border-t border-[var(--map-side-control-panel-border-color)] pt-3">
                {companion.context.actions.map((action) => (
                    <Link
                        className="group rounded-lg border px-3 py-2 text-left transition hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                        href={action.href}
                        key={action.key}
                    >
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[var(--map-side-control-text-color)]">
                            {action.label}
                            <ArrowRight className="size-4 shrink-0 text-[var(--map-floating-accent-color)] transition-transform group-hover:translate-x-0.5" />
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--map-side-control-muted-text-color)]">
                            {action.reason}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export function LearningCompanionLauncher({
    companion,
    placement = 'default',
}: {
    companion: LearningCompanion;
    placement?: LearningCompanionPlacement;
}) {
    const t = usePlatformTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const isMapSearchPlacement = placement === 'map-search';

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                window.setTimeout(() => triggerRef.current?.focus(), 0);
            }
        };
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                panelRef.current?.contains(event.target)
            ) {
                return;
            }

            setIsOpen(false);
        };

        document.addEventListener('keydown', closeOnEscape);
        document.addEventListener('pointerdown', closeOnOutsidePointer);

        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
        };
    }, [isOpen]);

    return (
        <div
            className={cn(
                'fixed z-40',
                isMapSearchPlacement
                    ? 'bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 md:bottom-5 md:left-5'
                    : 'bottom-5 left-4 sm:left-6',
            )}
            ref={panelRef}
        >
            {isOpen ? (
                <div
                    aria-labelledby="learning-companion-title"
                    aria-modal="false"
                    className={cn(
                        'absolute bottom-14 left-0 w-[min(21rem,calc(100vw-2rem))] rounded-xl border p-4 shadow-2xl shadow-slate-950/25 backdrop-blur-md dark:shadow-black/45',
                        isMapSearchPlacement && 'md:left-[calc(24rem+0.75rem)]',
                    )}
                    id="learning-companion-panel"
                    role="dialog"
                    style={{
                        background: 'var(--map-side-control-panel-background)',
                        borderColor: 'var(--map-side-control-panel-border-color)',
                        color: 'var(--map-side-control-text-color)',
                    }}
                >
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Compass className="size-4 text-[var(--map-floating-accent-color)]" />
                            <h2
                                className="text-sm font-semibold"
                                id="learning-companion-title"
                            >
                                {companion.displayName}
                            </h2>
                        </div>
                        <button
                            aria-label={t(
                                'learning.companion.close_label',
                                'Close learning companion',
                            )}
                            className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-[var(--map-side-control-hover-background)] focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none"
                            onClick={() => {
                                setIsOpen(false);
                                window.setTimeout(() => triggerRef.current?.focus(), 0);
                            }}
                            type="button"
                        >
                            {t('learning.companion.close', 'Close')}
                        </button>
                    </div>
                    <LearningCompanionPanel companion={companion} />
                </div>
            ) : null}
            <button
                aria-controls="learning-companion-panel"
                aria-expanded={isOpen}
                aria-label={t('learning.companion.open', 'Open :name', {
                    name: companion.displayName,
                })}
                className={cn(
                    'grid size-12 place-items-center overflow-hidden rounded-full border shadow-xl shadow-slate-950/20 transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--map-floating-accent-color)] focus-visible:outline-none dark:shadow-black/35',
                    isMapSearchPlacement &&
                        'ml-[3.75rem] md:ml-[calc(24rem+0.75rem)]',
                )}
                onClick={() => setIsOpen((open) => !open)}
                ref={triggerRef}
                style={{
                    background: companion.avatarColor,
                    borderColor: companion.avatarColor,
                    color: 'var(--map-side-control-panel-background)',
                }}
                title={companion.displayName}
                type="button"
            >
                {companion.avatarUrl ? (
                    <img
                        alt=""
                        className="size-full object-cover"
                        src={companion.avatarUrl}
                    />
                ) : (
                    <Compass className="size-6" />
                )}
            </button>
        </div>
    );
}
