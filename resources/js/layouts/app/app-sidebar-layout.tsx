import { usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import {
    AppSideActionBar,
    equippedToolCursor,
} from '@/components/app-side-action-bar';
import { useSelectedLearningTool } from '@/features/tools/tool-selection';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { platformActionCursor, platformCursor } from '@/theme/cursors';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { props } = usePage();
    const { resolvedAppearance } = useAppearance();
    const selectedTool = useSelectedLearningTool();
    useAppearancePageSync(Boolean(props.auth.user), props.appearance);
    void breadcrumbs;
    const toolCursor = equippedToolCursor(selectedTool, resolvedAppearance);
    const platformCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformCursor;
    const actionCursorValue =
        typeof toolCursor.cursor === 'string'
            ? toolCursor.cursor
            : platformActionCursor;

    return (
        <div
            className="platform-shell h-svh overflow-hidden bg-background"
            style={
                {
                    '--platform-action-cursor': actionCursorValue,
                    '--platform-cursor': platformCursorValue,
                    ...toolCursor,
                } as CSSProperties
            }
        >
            <main className="h-full overflow-hidden">{children}</main>
            <AppSideActionBar />
            <AppBottomNav />
        </div>
    );
}
