import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

import { request } from '@playwright/test';

const storageStatePath = resolve(
    import.meta.dirname,
    '../test-results/e2e-authenticated-state.json',
);

export default async function globalSetup(): Promise<void> {
    await rm(storageStatePath, { force: true });

    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    if (!email || !password) {
        return;
    }

    await mkdir(resolve(import.meta.dirname, '../test-results'), {
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

        await api.storageState({ path: storageStatePath });
    } finally {
        await api.dispose();
    }
}
