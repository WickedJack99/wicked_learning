import type { ResolvedAppearance } from '@/theme/appearance';

let pendingPersistedAppearance: ResolvedAppearance | null = null;
let persistenceIsRunning = false;

function csrfToken(): string {
    return (
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content ?? ''
    );
}

function flushPersistedAppearance(): void {
    if (persistenceIsRunning || !pendingPersistedAppearance) {
        return;
    }

    const mode = pendingPersistedAppearance;
    pendingPersistedAppearance = null;
    persistenceIsRunning = true;

    void fetch('/settings/appearance', {
        body: JSON.stringify({ appearance: mode }),
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: 'PATCH',
    })
        .catch(() => undefined)
        .finally(() => {
            persistenceIsRunning = false;
            flushPersistedAppearance();
        });
}

export function persistAppearance(mode: ResolvedAppearance): void {
    pendingPersistedAppearance = mode;
    flushPersistedAppearance();
}
