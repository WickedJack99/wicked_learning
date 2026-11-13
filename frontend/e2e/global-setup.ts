import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { request, type APIResponse } from '@playwright/test';

import {
    administratorStorageStatePath,
    collaborationStorageStatePath,
} from './session-state';

// The server's trusted-client limiter replenishes one credential request every
// sixty seconds. Normal repeat runs reuse valid local sessions; this fallback
// handles only an externally exhausted burst or a stale session.
const rateLimitRetryDelayMs = 60_000;
const rateLimitRetryAttempts = 2;

async function retryRateLimitedPost(
    send: () => Promise<APIResponse>,
    description: string,
): Promise<APIResponse> {
    for (let attempt = 0; attempt < rateLimitRetryAttempts; attempt += 1) {
        const response = await send();
        if (response.status() !== 429) {
            return response;
        }

        if (attempt + 1 < rateLimitRetryAttempts) {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, rateLimitRetryDelayMs);
            });
        }
    }

    throw new Error(
        `E2E ${description} remained rate limited after ${rateLimitRetryAttempts} attempts.`,
    );
}

async function hasUsableSession(
    baseURL: string,
    storageStatePath: string,
): Promise<boolean> {
    if (!existsSync(storageStatePath)) {
        return false;
    }

    const collaborator = await request.newContext({
        baseURL,
        storageState: storageStatePath,
    });
    try {
        return (await collaborator.get('/api/v1/me')).ok();
    } catch {
        return false;
    } finally {
        await collaborator.dispose();
    }
}

export default async function globalSetup(): Promise<void> {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    if (!email || !password) {
        return;
    }

    await mkdir(new URL('../.e2e-state/', import.meta.url), {
        recursive: true,
    });

    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
    const hasAdministratorSession = await hasUsableSession(
        baseURL,
        administratorStorageStatePath,
    );
    if (!hasAdministratorSession) {
        await rm(administratorStorageStatePath, { force: true });
    }

    const api = await request.newContext({
        baseURL,
        ...(hasAdministratorSession
            ? { storageState: administratorStorageStatePath }
            : {}),
    });

    try {
        const csrf = await api.get('/api/v1/security/csrf');
        if (!csrf.ok()) {
            throw new Error(
                `E2E session bootstrap CSRF request failed (${csrf.status()}).`,
            );
        }
        const { token } = (await csrf.json()) as { token: string };
        if (!hasAdministratorSession) {
            const login = await retryRateLimitedPost(
                () =>
                    api.post('/api/v1/session/login', {
                        data: { email, password },
                        headers: {
                            Origin: new URL(baseURL).origin,
                            'X-CSRF-Token': token,
                        },
                    }),
                'session bootstrap login',
            );
            if (!login.ok()) {
                throw new Error(
                    `E2E session bootstrap login failed (${login.status()}).`,
                );
            }

            await api.storageState({ path: administratorStorageStatePath });
        }

        const marker = randomUUID();
        for (const identity of ['first', 'second'] as const) {
            const storageStatePath = collaborationStorageStatePath(identity);
            if (await hasUsableSession(baseURL, storageStatePath)) {
                continue;
            }

            await rm(storageStatePath, { force: true });
            const invitation = await retryRateLimitedPost(
                () =>
                    api.post('/api/v1/registration-tokens', {
                        data: {
                            note: `Shared Task E2E ${marker} ${identity}`,
                            roles: ['learner'],
                        },
                        headers: {
                            Origin: new URL(baseURL).origin,
                            'X-CSRF-Token': token,
                        },
                    }),
                `${identity} collaborator invitation`,
            );
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
                const collaboratorCsrf = await collaborator.get(
                    '/api/v1/security/csrf',
                );
                if (!collaboratorCsrf.ok()) {
                    throw new Error(
                        `E2E ${identity} collaborator CSRF request failed (${collaboratorCsrf.status()}).`,
                    );
                }
                const { token: collaboratorCsrfToken } =
                    (await collaboratorCsrf.json()) as {
                        token: string;
                    };
                const password = `Shared-task-${marker}-${identity}`;
                const registration = await retryRateLimitedPost(
                    () =>
                        collaborator.post('/api/v1/registration', {
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
                        }),
                    `${identity} collaborator registration`,
                );
                if (!registration.ok()) {
                    throw new Error(
                        `E2E ${identity} collaborator registration failed (${registration.status()}).`,
                    );
                }
                await collaborator.storageState({
                    path: storageStatePath,
                });
            } finally {
                await collaborator.dispose();
            }
        }
    } finally {
        await api.dispose();
    }
}
