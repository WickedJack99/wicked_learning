import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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
import {
    embeddedPlatformCursors,
    platformActionCursor,
    platformCursor,
    platformDeniedCursor,
    platformGrabCursor,
    platformTextCursor,
} from '@/theme/cursors';
import { mapControlCssVariables } from '@/features/world/map-control-theme';
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
    const [platformCursors, setPlatformCursors] = useState(() => ({
        action: platformActionCursor(presentation),
        default: platformCursor(presentation),
        denied: platformDeniedCursor(presentation),
        grab: platformGrabCursor(presentation),
        text: platformTextCursor(presentation),
    }));
    useEffect(() => {
        let isMounted = true;

        setPlatformCursors({
            action: platformActionCursor(presentation),
            default: platformCursor(presentation),
            denied: platformDeniedCursor(presentation),
            grab: platformGrabCursor(presentation),
            text: platformTextCursor(presentation),
        });

        void embeddedPlatformCursors(presentation).then((cursors) => {
            if (isMounted) {
                setPlatformCursors(cursors);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [presentation]);
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
            : platformCursors.default;
    const actionCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors.action;
    const grabCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors.grab;
    const textCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors.text;
    const deniedCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursors.denied;

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
