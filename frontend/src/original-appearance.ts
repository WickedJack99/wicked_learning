import { useCallback, useEffect, useState } from 'react';

export type OriginalAppearance = 'dark' | 'light';

const unauthenticatedAppearanceStorageKey = 'theme-preference-unauthenticated';

/**
 * Source-adapted anonymous portion of `useAppearance`. This local value keeps
 * the public shell responsive; App replaces it with the signed-in learner's
 * application-side preference once the current-user contract is available.
 */
export function useOriginalAppearance(): [
    OriginalAppearance,
    (appearance: OriginalAppearance) => void,
] {
    const [appearance, setAppearance] = useState<OriginalAppearance>(
        readInitialAppearance,
    );

    useEffect(() => applyAppearance(appearance), [appearance]);

    const updateAppearance = useCallback((nextAppearance: OriginalAppearance) => {
        // The source hook changes the document and persistence synchronously so
        // an immediately-following client navigation cannot lose the choice.
        applyAppearance(nextAppearance);
        setAppearance(nextAppearance);
    }, []);

    return [appearance, updateAppearance];
}

function applyAppearance(appearance: OriginalAppearance): void {
    document.documentElement.classList.toggle('dark', appearance === 'dark');
    document.documentElement.style.colorScheme = appearance;

    try {
        window.localStorage.setItem(
            unauthenticatedAppearanceStorageKey,
            appearance,
        );
    } catch {
        // Storage can be unavailable; rendering still follows the choice.
    }
}

function readInitialAppearance(): OriginalAppearance {
    try {
        const stored = window.localStorage.getItem(
            unauthenticatedAppearanceStorageKey,
        );
        if (stored === 'dark' || stored === 'light') {
            return stored;
        }
    } catch {
        // Fall through to the same system resolution used by the source hook.
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}
