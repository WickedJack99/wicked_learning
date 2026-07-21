import type { CSSProperties } from 'react';
import { ActivityPanel } from '@/features/world/activity-panel';
import { cn } from '@/lib/utils';
import type { LearningNode } from '@/types';

export type PanelSwipe = {
    isDragging: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
};

type DrawerTheme = {
    accentColor?: string;
    sidePanelBackground?: string;
    sidePanelBorderColor?: string;
    sidePanelHeadingColor?: string;
    sidePanelTextColor?: string;
};

export function NodeDetailDrawer({
    canBookmark,
    isBookmarked,
    isCompleted,
    node,
    onClose,
    onStart,
    onSwipeChange,
    onToggleBookmark,
    swipe,
    theme,
}: {
    canBookmark: boolean;
    isBookmarked: boolean;
    isCompleted: boolean;
    node: LearningNode | null;
    onClose: () => void;
    onStart: (
        node: LearningNode,
        activityId: number | null,
        routeId?: number | null,
    ) => void;
    onSwipeChange: (swipe: PanelSwipe | null) => void;
    onToggleBookmark: (node: LearningNode) => void;
    swipe: PanelSwipe | null;
    theme: DrawerTheme | null;
}) {
    return (
        <aside
            className={cn(
                'absolute inset-0 z-50 w-full touch-pan-y border-l border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-300 ease-out md:left-auto md:max-w-[420px] dark:border-white/10 dark:bg-[#111820] dark:text-slate-100',
                node ? 'translate-x-0' : 'pointer-events-none translate-x-full',
                swipe?.isDragging && 'transition-none',
            )}
            onPointerCancel={() => onSwipeChange(null)}
            onPointerDown={(event) => {
                if (event.pointerType === 'mouse' || event.button !== 0) {
                    return;
                }

                onSwipeChange({
                    isDragging: false,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    offsetX: 0,
                });
            }}
            onPointerMove={(event) => {
                if (!swipe || swipe.pointerId !== event.pointerId) {
                    return;
                }

                const deltaX = event.clientX - swipe.startX;
                const deltaY = event.clientY - swipe.startY;
                const isHorizontalSwipe =
                    Math.abs(deltaX) > 12 &&
                    Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

                if (!swipe.isDragging && !isHorizontalSwipe) {
                    return;
                }

                event.preventDefault();

                onSwipeChange({
                    ...swipe,
                    isDragging: true,
                    offsetX: Math.max(0, deltaX),
                });
            }}
            onPointerUp={(event) => {
                if (!swipe || swipe.pointerId !== event.pointerId) {
                    return;
                }

                if (swipe.offsetX > 96) {
                    onClose();
                } else {
                    onSwipeChange(null);
                }
            }}
            style={
                {
                    '--map-side-panel-heading-color':
                        theme?.sidePanelHeadingColor ?? theme?.accentColor,
                    background: theme?.sidePanelBackground,
                    borderColor: theme?.sidePanelBorderColor,
                    color: theme?.sidePanelTextColor,
                    transform:
                        node && swipe?.offsetX
                            ? `translateX(${swipe.offsetX}px)`
                            : undefined,
                } as CSSProperties
            }
        >
            <ActivityPanel
                canBookmark={canBookmark}
                isBookmarked={isBookmarked}
                isCompleted={isCompleted}
                node={node}
                onClose={onClose}
                onStart={onStart}
                onToggleBookmark={onToggleBookmark}
            />
        </aside>
    );
}
