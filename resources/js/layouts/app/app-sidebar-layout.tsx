import { AppBottomNav } from '@/components/app-bottom-nav';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    void breadcrumbs;

    return (
        <div className="h-svh overflow-hidden bg-background">
            <main className="h-full overflow-hidden">{children}</main>
            <AppBottomNav />
        </div>
    );
}
