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
import { usePlatformCursorStyle } from '@/hooks/use-platform-cursors';
import { mapControlCssVariables } from '@/features/world/map-control-theme';
import type { AppLayoutProps } from '@/types';

type PlatformCursorStyle = CSSProperties & {
    '--platform-action-cursor'?: string;
    '--platform-cursor'?: string;
    '--platform-denied-cursor'?: string;
    '--platform-grab-cursor'?: string;
    '--platform-text-cursor'?: string;
};

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
    const platformCursors = usePlatformCursorStyle(
        presentation,
    ) as PlatformCursorStyle;
    const toolCursor = equippedToolCursorStyle(
        selectedTool,
        resolvedAppearance,
    );
    const menuControlVariables = mapControlCssVariables(
        props.menuTheme?.backgroundConfig,
        resolvedAppearance,
    );
    const platformCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors['--platform-cursor'];
    const actionCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors['--platform-action-cursor'];
    const grabCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors['--platform-grab-cursor'];
    const textCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors['--platform-text-cursor'];
    const deniedCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors['--platform-denied-cursor'];

    return (
        <div
            className="platform-shell h-svh overflow-hidden bg-background"
            style={
                {
                    '--platform-action-cursor': actionCursorValue,
                    '--platform-denied-cursor': deniedCursorValue,
                    '--platform-grab-cursor': grabCursorValue,
                    '--platform-text-cursor': textCursorValue,
                    '--platform-cursor': platformCursorValue,
                    ...menuControlVariables,
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
