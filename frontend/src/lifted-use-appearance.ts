import { useSyncExternalStore } from 'react';

export type ResolvedAppearance = 'dark' | 'light';

const readResolvedAppearance = (): ResolvedAppearance =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';

const subscribe = (callback: () => void): (() => void) => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return () => undefined;
    }

    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
        attributeFilter: ['class'],
        attributes: true,
    });

    return () => observer.disconnect();
};

/**
 * Adapter for source visual fields. App remains the sole appearance preference
 * owner; this hook observes its document-level resolved appearance.
 */
export function useLiftedAppearance(): {
    readonly resolvedAppearance: ResolvedAppearance;
} {
    const resolvedAppearance = useSyncExternalStore(
        subscribe,
        readResolvedAppearance,
        (): ResolvedAppearance => 'light',
    );

    return { resolvedAppearance };
}
