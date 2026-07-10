import { createInertiaApp } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import '@xyflow/react/dist/style.css';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

// Read the server/browser appearance before React mounts so every component
// resolves the same light or dark theme on its first render.
initializeTheme();

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('info/'):
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name === 'settings/index':
                return AppLayout;
            case name === 'settings/about':
            case name === 'settings/imprint':
            case name === 'settings/data-protection':
                return AppLayout;
            case name.startsWith('settings/assets/'):
                return AppLayout;
            case name.startsWith('settings/worlds/'):
                return AppLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});
