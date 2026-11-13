import { existsSync, readFileSync } from 'node:fs';

import { expect, test as base } from '@playwright/test';
import type { BrowserContext, Cookie } from '@playwright/test';

import { administratorStorageStatePath } from './session-state';

function hasAuthenticatedState(): boolean {
    return Boolean(
        process.env.E2E_LOGIN_EMAIL &&
            process.env.E2E_LOGIN_PASSWORD &&
            existsSync(administratorStorageStatePath),
    );
}

function authenticatedCookies(): Cookie[] {
    const state = JSON.parse(
        readFileSync(administratorStorageStatePath, 'utf8'),
    ) as { cookies: Cookie[] };

    return state.cookies;
}

export async function installE2eAdminSession(
    context: BrowserContext,
): Promise<void> {
    if (hasAuthenticatedState()) {
        await context.addCookies(authenticatedCookies());
    }
}

/**
 * Acceptance specs that only need the disposable administrator should opt into
 * this fixture. It preserves their anonymous initial state, then supplies an
 * independently copied server-issued session only when the original login
 * form submits. This prevents redundant UI sign-ins from exhausting the real
 * credential rate limit while session-contract specs retain direct calls to
 * the live endpoint.
 */
export const test = base.extend({
    context: async ({ browser }, use) => {
        const context = await browser.newContext();

        if (hasAuthenticatedState()) {
            await context.route('**/api/v1/session/login', async (route) => {
                await installE2eAdminSession(context);
                await route.fulfill({
                    body: JSON.stringify({
                        authenticated: true,
                        subject_id: 'e2e-authenticated-session',
                        two_factor_required: false,
                    }),
                    contentType: 'application/json',
                });
            });
        }

        await use(context);
        await context.close();
    },
});

export { expect };
