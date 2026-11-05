import { useCallback, useEffect, useState } from 'react';

export type OriginalAppearance = 'dark' | 'light';

const unauthenticatedAppearanceStorageKey = 'theme-preference-unauthenticated';

/**
 * Source-adapted anonymous portion of `useAppearance`. Authenticated
 * persistence belongs to the future Rust learner-preferences contract; this
 * preserves the original public shell's local preference in the meantime.
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
