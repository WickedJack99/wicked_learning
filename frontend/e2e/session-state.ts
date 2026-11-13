import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Playwright clears its test-results output directory after global setup.
// Keep credential-bearing local session state in a separate ignored directory
// so one bootstrap can be shared safely by the focused collaboration specs.
const stateDirectory = resolve(import.meta.dirname, '../.e2e-state');

export const administratorStorageStatePath = resolve(
    stateDirectory,
    'e2e-authenticated-state.json',
);

export type CollaborationIdentity = 'first' | 'second';

export function collaborationStorageStatePath(
    identity: CollaborationIdentity,
): string {
    return resolve(stateDirectory, `e2e-collaboration-${identity}-state.json`);
}

export function hasCollaborationStorageState(): boolean {
    return (
        existsSync(collaborationStorageStatePath('first')) &&
        existsSync(collaborationStorageStatePath('second'))
    );
}
