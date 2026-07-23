import type { Appearance } from '@/theme/appearance';
import type { JournalThemeSettings } from '@/features/journal/theme';
import type { MapMenuTheme } from '@/features/world/map-control-theme';
import type { SoundPreferences } from '@/features/sounds/sound-player';
import type { PublicPresentationSettings } from '@/theme/presentation';
import type { Auth } from '@/types/auth';

declare global {
    interface Window {
        __INITIAL_APPEARANCE__?: Appearance;
        __INITIAL_AUTHENTICATED__?: boolean;
        __INITIAL_RESOLVED_APPEARANCE__?: 'light' | 'dark';
    }
}

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            appearance: Appearance;
            auth: Auth;
            journalTheme: JournalThemeSettings;
            menuTheme: MapMenuTheme | null;
            soundPreferences: SoundPreferences;
            localization: {
                locale: string;
                translations: Record<string, string>;
            };
            publicPresentation: PublicPresentationSettings;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
