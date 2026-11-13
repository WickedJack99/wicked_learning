import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { request } from '@playwright/test';

import {
    administratorStorageStatePath,
    collaborationStorageStatePath,
} from './session-state';

export default async function globalSetup(): Promise<void> {
    await Promise.all([
        rm(administratorStorageStatePath, { force: true }),
        rm(collaborationStorageStatePath('first'), { force: true }),
        rm(collaborationStorageStatePath('second'), { force: true }),
    ]);

    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    if (!email || !password) {
        return;
    }

    await mkdir(new URL('../test-results/', import.meta.url), {
        recursive: true,
    });

    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
    const api = await request.newContext({ baseURL });

    try {
        const csrf = await api.get('/api/v1/security/csrf');
        if (!csrf.ok()) {
            throw new Error(`E2E session bootstrap CSRF request failed (${csrf.status()}).`);
        }
        const { token } = (await csrf.json()) as { token: string };
        const login = await api.post('/api/v1/session/login', {
            data: { email, password },
            headers: {
                Origin: new URL(baseURL).origin,
                'X-CSRF-Token': token,
            },
        });
        if (!login.ok()) {
            throw new Error(`E2E session bootstrap login failed (${login.status()}).`);
        }

        await api.storageState({ path: administratorStorageStatePath });

        const marker = randomUUID();
        for (const identity of ['first', 'second'] as const) {
            const invitation = await api.post('/api/v1/registration-tokens', {
                data: {
                    note: `Shared Task E2E ${marker} ${identity}`,
                    roles: ['learner'],
                },
                headers: {
                    Origin: new URL(baseURL).origin,
                    'X-CSRF-Token': token,
                },
            });
            if (!invitation.ok()) {
                throw new Error(
                    `E2E ${identity} collaborator invitation failed (${invitation.status()}).`,
                );
            }
            const { token: registrationToken } = (await invitation.json()) as {
                token: string;
            };
            const collaborator = await request.newContext({ baseURL });
            try {
                const collaboratorCsrf = await collaborator.get('/api/v1/security/csrf');
                if (!collaboratorCsrf.ok()) {
                    throw new Error(
                        `E2E ${identity} collaborator CSRF request failed (${collaboratorCsrf.status()}).`,
                    );
                }
                const { token: collaboratorCsrfToken } = (await collaboratorCsrf.json()) as {
                    token: string;
                };
                const password = `Shared-task-${marker}-${identity}`;
                const registration = await collaborator.post('/api/v1/registration', {
                    data: {
                        email: `shared-task-${marker}-${identity}@wicked-learning.local`,
                        name: `Shared Task ${identity}`,
                        password,
                        password_confirmation: password,
                        registration_token: registrationToken,
                    },
                    headers: {
                        Origin: new URL(baseURL).origin,
                        'X-CSRF-Token': collaboratorCsrfToken,
                    },
                });
                if (!registration.ok()) {
                    throw new Error(
                        `E2E ${identity} collaborator registration failed (${registration.status()}).`,
                    );
                }
                await collaborator.storageState({
                    path: collaborationStorageStatePath(identity),
                });
            } finally {
                await collaborator.dispose();
            }
        }
    } finally {
        await api.dispose();
    }
}
