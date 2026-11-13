import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const stateDirectory = resolve(import.meta.dirname, '../test-results');

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
