export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export const authenticatedAppearanceStorageKey = 'appearance';
export const unauthenticatedAppearanceStorageKey =
    'theme-preference-unauthenticated';

export type StoredAppearanceResult = {
    readonly appearance: Appearance;
    readonly hasStoredPreference: boolean;
};

export function isAppearance(value: unknown): value is Appearance {
    return value === 'light' || value === 'dark' || value === 'system';
}

export function normalizeAppearance(value: unknown): Appearance | null {
    return isAppearance(value) ? value : null;
}

export function isAuthenticatedSession(isAuthenticated?: boolean): boolean {
    if (typeof isAuthenticated === 'boolean') {
        return isAuthenticated;
    }

    return (
        typeof window !== 'undefined' &&
        window.__INITIAL_AUTHENTICATED__ === true
    );
}

export function getAppearanceStorageKey(isAuthenticated?: boolean): string {
    return isAuthenticatedSession(isAuthenticated)
        ? authenticatedAppearanceStorageKey
        : unauthenticatedAppearanceStorageKey;
}

export function prefersDark(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveAppearance(appearance: Appearance): ResolvedAppearance {
    return appearance === 'dark' || (appearance === 'system' && prefersDark())
        ? 'dark'
        : 'light';
}

export function readDocumentAppearance(): ResolvedAppearance | null {
    if (typeof document === 'undefined') {
        return null;
    }

    return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
}

export function readStoredAppearance(): StoredAppearanceResult {
    if (typeof window === 'undefined') {
        return { appearance: 'system', hasStoredPreference: false };
    }

    const initialAppearance = normalizeAppearance(
        window.__INITIAL_APPEARANCE__,
    );

    if (initialAppearance && initialAppearance !== 'system') {
        return { appearance: initialAppearance, hasStoredPreference: false };
    }

    let storedAppearance: Appearance | null = null;

    try {
        storedAppearance = normalizeAppearance(
            localStorage.getItem(getAppearanceStorageKey()),
        );
    } catch {
        storedAppearance = null;
    }

    return {
        appearance: storedAppearance ?? initialAppearance ?? 'system',
        hasStoredPreference: Boolean(storedAppearance),
    };
}

export function readInitialResolvedAppearance(
    currentAppearance: Appearance,
): ResolvedAppearance {
    if (typeof window === 'undefined') {
        return 'light';
    }

    return (
        window.__INITIAL_RESOLVED_APPEARANCE__ ??
        readDocumentAppearance() ??
        resolveAppearance(currentAppearance)
    );
}

export function applyAppearanceToDocument(
    appearance: Appearance,
): ResolvedAppearance {
    const resolvedAppearance = resolveAppearance(appearance);

    if (typeof document === 'undefined') {
        return resolvedAppearance;
    }

    const isDark = resolvedAppearance === 'dark';

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    window.__INITIAL_APPEARANCE__ = appearance;
    window.__INITIAL_RESOLVED_APPEARANCE__ = resolvedAppearance;

    return resolvedAppearance;
}

export function setAppearanceCookie(
    name: string,
    value: string,
    days = 365,
): void {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
}

export function storeAppearance(
    mode: Appearance,
    isAuthenticated?: boolean,
): void {
    try {
        localStorage.setItem(getAppearanceStorageKey(isAuthenticated), mode);
    } catch {
        // Browsers can block storage; callers still update cookies and the DOM.
    }
}
