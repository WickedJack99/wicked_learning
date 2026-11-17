import type { Appearance } from '@/theme/appearance';

declare global {
    interface Window {
        __INITIAL_APPEARANCE__?: Appearance;
        __INITIAL_AUTHENTICATED__?: boolean;
        __INITIAL_RESOLVED_APPEARANCE__?: 'light' | 'dark';
    }
}

export {};
