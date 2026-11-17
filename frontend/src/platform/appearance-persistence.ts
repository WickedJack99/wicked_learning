import type { ResolvedAppearance } from '@/theme/appearance';

import { apiClient, getCsrfToken } from './api/client';

let pendingAppearance: ResolvedAppearance | null = null;
let persistenceIsRunning = false;

/**
 * Exact transport seam for the copied appearance hook. The source UI owns the
 * immediate DOM/local-storage update and intentionally has no save-status
 * surface; this adapter only replaces its Laravel PATCH with the audited Rust
 * CSRF-protected command.
 */
export function persistAppearance(appearance: ResolvedAppearance): void {
    pendingAppearance = appearance;
    flushAppearance();
}

function flushAppearance(): void {
    if (persistenceIsRunning || !pendingAppearance) {
        return;
    }

    const appearance = pendingAppearance;
    pendingAppearance = null;
    persistenceIsRunning = true;

    void (async () => {
        try {
            const csrfToken = await getCsrfToken();
            await apiClient.PATCH('/learner/appearance', {
                body: { appearance },
                params: { header: { 'X-CSRF-Token': csrfToken } },
            });
        } catch {
            // Preserve the inherited source behavior: the UI remains locally
            // updated and exposes no fabricated persistence-success state.
        } finally {
            persistenceIsRunning = false;
            flushAppearance();
        }
    })();
}
