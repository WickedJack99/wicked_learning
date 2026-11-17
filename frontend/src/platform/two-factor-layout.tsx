import { useSyncExternalStore } from 'react';

export type TwoFactorLayoutProps = {
    title: string;
    description: string;
};

const authenticationCodeLayout: TwoFactorLayoutProps = {
    title: 'Authentication code',
    description: 'Enter the authentication code provided by your authenticator application.',
};

let currentLayout = authenticationCodeLayout;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function getSnapshot(): TwoFactorLayoutProps {
    return currentLayout;
}

/**
 * The copied challenge calls Inertia's layout-prop helper while it switches
 * between its two source-owned modes. This tiny external-store bridge keeps
 * that presentation state in the platform layer without changing the copied
 * component or turning it into a generic Inertia layout implementation.
 */
export function setTwoFactorLayoutProps(next: Partial<TwoFactorLayoutProps>): void {
    const updated = { ...currentLayout, ...next };

    if (
        updated.title === currentLayout.title &&
        updated.description === currentLayout.description
    ) {
        return;
    }

    currentLayout = updated;
    queueMicrotask(() => listeners.forEach((listener) => listener()));
}

export function resetTwoFactorLayoutProps(): void {
    currentLayout = authenticationCodeLayout;
    listeners.forEach((listener) => listener());
}

export function useTwoFactorLayoutProps(): TwoFactorLayoutProps {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
