import { expect, test, type BrowserContext } from '@playwright/test';

// Credentials and native session cookies must not enter browser traces.
test.use({ trace: 'off' });

test('copied Login succeeds on the first click after a real client limit expires at both viewports', async ({ browser, baseURL }, info) => {
    test.skip(!process.env.E2E_LOGIN_EXPIRY_PASSWORD, 'Requires the local test account password through the test environment.');
    test.setTimeout(180_000);
    const origin = new URL(baseURL!).origin;
    expect(new URL(origin).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const seed = await browser.newContext({ baseURL });
    try {
        const csrf = await seed.request.get('/api/v1/security/csrf');
        const result = await seed.request.post('/api/v1/session/login', {
            headers: { Origin: origin, 'X-CSRF-Token': (await csrf.json()).token },
            data: { email: 'e2e-admin@wicked-learning.local', password: process.env.E2E_LOGIN_EXPIRY_PASSWORD },
        });
        expect(result.status()).toBe(200);
        await logout(seed, origin);
    } finally { await seed.close(); }

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        // This is the condition under test: allow the real one-minute durable
        // window to expire. Do not clear rows, spoof IPs or retry failed logins.
        await new Promise((resolve) => setTimeout(resolve, 61_000));
        const context = await browser.newContext({ baseURL, viewport });
        try {
            const page = await context.newPage();
            await page.goto('/login');
            const submit = page.getByRole('button', { name: 'Log in', exact: true });
            await expect(submit).toBeVisible();
            const box = await submit.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.y).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
            expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
            await info.attach(`public-login-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
            await page.getByLabel('Email address').fill('e2e-admin@wicked-learning.local');
            await page.locator('input[name="password"]').fill(process.env.E2E_LOGIN_EXPIRY_PASSWORD!);
            let requests = 0;
            page.on('request', (request) => { if (request.url().endsWith('/api/v1/session/login')) requests++; });
            const response = page.waitForResponse((response) => response.url().endsWith('/api/v1/session/login'));
            await submit.click();
            expect((await response).status()).toBe(200);
            await expect(page).toHaveURL(/\/world(?:\?|$)/);
            expect(requests).toBe(1);
            expect((await context.request.get('/api/v1/me')).status()).toBe(200);
            await expect(page.getByText('Login is currently unavailable.', { exact: true })).toHaveCount(0);
            await logout(context, origin);
        } finally { await context.close(); }
    }
});

async function logout(context: BrowserContext, origin: string) {
    const csrf = await context.request.get('/api/v1/security/csrf');
    expect((await context.request.post('/api/v1/session/logout', {
        headers: { Origin: origin, 'X-CSRF-Token': (await csrf.json()).token },
    })).status()).toBe(204);
}
