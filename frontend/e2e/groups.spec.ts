import { expect, test } from '@playwright/test';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('a group member opens the source-derived World Groups control and sends a message', async ({
    page,
    request,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const message = `Source group control browser check ${Date.now()}`;
    test.skip(!email || !password, 'requires a disposable local group member');

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const login = await request.post('/api/v1/session/login', {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { email, password },
    });
    expect(login.status()).toBe(200);
    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);

    await page.goto('/world');
    await page.getByRole('button', { name: 'Open groups' }).click();
    await expect(
        page.getByRole('heading', { name: 'Group chats' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Local group contract check' }),
    ).toBeVisible();
    await page.getByLabel('Message the group').fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(message)).toBeVisible();
});
