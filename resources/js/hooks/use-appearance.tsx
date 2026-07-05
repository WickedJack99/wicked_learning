import { useEffect, useSyncExternalStore } from 'react';
import {
    applyAppearanceToDocument,
    authenticatedAppearanceStorageKey,
    isAuthenticatedSession,
    normalizeAppearance,
    readDocumentAppearance,
    readInitialResolvedAppearance,
    readStoredAppearance,
    resolveAppearance,
    setAppearanceCookie,
    storeAppearance,
} from '@/theme/appearance';
import type { Appearance, ResolvedAppearance } from '@/theme/appearance';
import { persistAppearance } from '@/theme/appearance-persistence';

export type { Appearance, ResolvedAppearance } from '@/theme/appearance';

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly updateAppearance: (mode: Appearance) => void;
};

const listeners = new Set<() => void>();
const resolvedListeners = new Set<() => void>();
const initialStoredAppearance = readStoredAppearance();

let currentAppearance: Appearance = initialStoredAppearance.appearance;
let currentResolvedAppearance: ResolvedAppearance =
    readInitialResolvedAppearance(currentAppearance);
let documentThemeObserver: MutationObserver | null = null;

const getResolvedAppearanceSnapshot = (): ResolvedAppearance => {
    return currentResolvedAppearance;
};

const notify = (): void => listeners.forEach((listener) => listener());
const notifyResolved = (): void =>
    resolvedListeners.forEach((listener) => listener());

const applyTheme = (appearance: Appearance): void => {
    currentResolvedAppearance = applyAppearanceToDocument(appearance);
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const subscribeResolvedAppearance = (callback: () => void) => {
    resolvedListeners.add(callback);

    if (
        typeof document !== 'undefined' &&
        typeof MutationObserver !== 'undefined' &&
        !documentThemeObserver
    ) {
        documentThemeObserver = new MutationObserver(() => {
            currentResolvedAppearance =
                readDocumentAppearance() ?? currentResolvedAppearance;
            notifyResolved();
        });
        documentThemeObserver.observe(document.documentElement, {
            attributeFilter: ['class'],
            attributes: true,
        });
    }

    return () => resolvedListeners.delete(callback);
};

const mediaQuery = (): MediaQueryList | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = (): void => {
    applyTheme(currentAppearance);
    notify();
    notifyResolved();
};

export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    const storedAppearance = readStoredAppearance();
    currentAppearance = storedAppearance.appearance;

    if (isAuthenticatedSession() && currentAppearance === 'system') {
        currentAppearance = resolveAppearance(currentAppearance);
    }

    if (isAuthenticatedSession() || storedAppearance.hasStoredPreference) {
        storeAppearance(currentAppearance);
    }

    if (isAuthenticatedSession()) {
        setAppearanceCookie(
            authenticatedAppearanceStorageKey,
            currentAppearance,
        );
    }

    applyTheme(currentAppearance);
    notifyResolved();

    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

export function syncAppearanceWithPage(
    isAuthenticated: boolean,
    serverAppearanceValue: unknown,
): void {
    const serverAppearance = normalizeAppearance(serverAppearanceValue);

    if (typeof window !== 'undefined') {
        window.__INITIAL_AUTHENTICATED__ = isAuthenticated;
    }

    if (!isAuthenticated) {
        return;
    }

    if (currentAppearance === 'system' && serverAppearance) {
        currentAppearance =
            serverAppearance === 'system'
                ? resolveAppearance(serverAppearance)
                : serverAppearance;
        storeAppearance(currentAppearance, true);
        setAppearanceCookie(
            authenticatedAppearanceStorageKey,
            currentAppearance,
        );
        applyTheme(currentAppearance);
        notify();
        notifyResolved();

        return;
    }

    const persistedAppearance =
        currentAppearance === 'system'
            ? resolveAppearance(currentAppearance)
            : currentAppearance;

    storeAppearance(persistedAppearance, true);
    setAppearanceCookie(authenticatedAppearanceStorageKey, persistedAppearance);

    if (
        (persistedAppearance === 'light' || persistedAppearance === 'dark') &&
        serverAppearance !== persistedAppearance
    ) {
        persistAppearance(persistedAppearance);
    }
}

export function useAppearancePageSync(
    isAuthenticated: boolean,
    serverAppearance: unknown,
): void {
    useEffect(() => {
        syncAppearanceWithPage(isAuthenticated, serverAppearance);
    }, [isAuthenticated, serverAppearance]);
}

export function useAppearance(): UseAppearanceReturn {
    const appearance: Appearance = useSyncExternalStore(
        subscribe,
        () => currentAppearance,
        () => 'system',
    );

    const resolvedAppearance: ResolvedAppearance = useSyncExternalStore(
        subscribeResolvedAppearance,
        getResolvedAppearanceSnapshot,
        getResolvedAppearanceSnapshot,
    );

    const updateAppearance = (mode: Appearance): void => {
        const isAuthenticated = isAuthenticatedSession();
        const persistedAppearance =
            mode === 'system' ? resolveAppearance(mode) : mode;

        currentAppearance = persistedAppearance;
        storeAppearance(persistedAppearance, isAuthenticated);

        if (isAuthenticated) {
            setAppearanceCookie(
                authenticatedAppearanceStorageKey,
                persistedAppearance,
            );
        }

        applyTheme(persistedAppearance);
        notify();
        notifyResolved();

        if (isAuthenticated) {
            persistAppearance(persistedAppearance);
        }
    };

    return { appearance, resolvedAppearance, updateAppearance } as const;
}
