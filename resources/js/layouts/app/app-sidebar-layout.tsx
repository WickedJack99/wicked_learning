import { usePage } from '@inertiajs/react';
import type { CSSProperties } from 'react';
import { AppBottomNav } from '@/components/app-bottom-nav';
import { useAppearancePageSync } from '@/hooks/use-appearance';
import { platformActionCursor, platformCursor } from '@/theme/cursors';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { props } = usePage();
    useAppearancePageSync(Boolean(props.auth.user), props.appearance);
    void breadcrumbs;

    return (
        <div
            className="platform-shell h-svh overflow-hidden bg-background"
            style={
                {
                    '--platform-action-cursor': platformActionCursor,
                    '--platform-cursor': platformCursor,
                } as CSSProperties
            }
        >
            <main className="h-full overflow-hidden">{children}</main>
            <AppBottomNav />
        </div>
    );
}
