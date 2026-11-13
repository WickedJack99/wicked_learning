import { expect, test, type Page } from '@playwright/test';

import { installE2eAdminSession } from './authenticated';

async function sessionCookieExpiry(page: Page): Promise<number> {
    const cookie = (await page.context().cookies()).find(
        ({ name }) => name === 'wicked_learning_session',
    );
    expect(cookie).toBeDefined();

    return cookie!.expires;
}

test('login preserves the original remembered-session control and contract', async ({ page }) => {
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/session/login', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().postDataJSON()).toEqual({
            email: 'learner@example.test',
            password: 'a sufficiently long password',
            remember: true,
        });
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                authenticated: true,
                subject_id: '00000000-0000-0000-0000-000000000001',
                two_factor_required: false,
            }),
        });
    });

    await page.goto('/login');

    const remember = page.getByLabel('Remember me');
    await expect(remember).not.toBeChecked();
    await remember.check();
    await expect(remember).toBeChecked();

    await page.getByLabel('Email address').fill('learner@example.test');
    await page.getByLabel('Password').fill('a sufficiently long password');
    await page.getByRole('button', { name: 'Log in' }).click();
});

test('a normal local server session uses and refreshes the source inactivity window', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await installE2eAdminSession(page.context());
    const initialSession = await page.request.get('/api/v1/session');
    expect(initialSession.status()).toBe(200);
    expect(await initialSession.json()).toMatchObject({ authenticated: true });

    const firstExpiry = await sessionCookieExpiry(page);
    const now = Date.now() / 1000;
    expect(firstExpiry).toBeGreaterThan(now + 7_100);
    expect(firstExpiry).toBeLessThan(now + 7_300);

    await page.waitForTimeout(1_100);
    const session = await page.request.get('/api/v1/session');
    expect(session.status()).toBe(200);
    expect(await session.json()).toMatchObject({ authenticated: true });
    expect(await sessionCookieExpiry(page)).toBeGreaterThan(firstExpiry);
});
