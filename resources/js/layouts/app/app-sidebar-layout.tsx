import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { AppSideActionBar } from '@/components/app-side-action-bar';
import {
    EquippedToolCursorOverlay,
    equippedToolCursorStyle,
} from '@/features/tools/tool-cursor-overlay';
import {
    selectLearningTool,
    useSelectedLearningTool,
} from '@/features/tools/tool-selection';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { platformActionCursor, platformCursor } from '@/theme/cursors';
import { platformGrabCursor } from '@/theme/cursors';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { props } = usePage();
    const { resolvedAppearance } = useAppearance();
    const selectedTool = useSelectedLearningTool();
    useAppearancePageSync(Boolean(props.auth.user), props.appearance);
    useEffect(() => {
        if (!selectedTool) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                selectLearningTool(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTool]);
    void breadcrumbs;
    const presentation = props.publicPresentation;
    const toolCursor = equippedToolCursorStyle(
        selectedTool,
        resolvedAppearance,
    );
    const platformCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursor(presentation);
    const actionCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformActionCursor(presentation);
    const grabCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformGrabCursor(presentation);

    return (
        <div
            className="platform-shell h-svh overflow-hidden bg-background"
            style={
                {
                    '--platform-action-cursor': actionCursorValue,
                    '--platform-grab-cursor': grabCursorValue,
                    '--platform-cursor': platformCursorValue,
                    ...toolCursor,
                } as CSSProperties
            }
        >
            <main className="h-full overflow-hidden">{children}</main>
            <EquippedToolCursorOverlay
                mode={resolvedAppearance}
                tool={selectedTool}
            />
            <AppSideActionBar />
            <AppBottomNav />
        </div>
    );
}
