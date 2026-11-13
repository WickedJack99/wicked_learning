import { expect, installE2eAdminSession, test } from './authenticated';

test('a group member opens the source-derived World Groups control and sends a message', async ({
    page,
    request,
}) => {
    const message = `Source group control browser check ${Date.now()}`;
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires a disposable local group member',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);

    await page.goto('/world');
    await page.getByRole('button', { name: 'Open groups' }).click();
    await expect(
        page.getByRole('heading', { name: 'Group chats' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
    await page.getByLabel('Message the group').fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(message)).toBeVisible();
});
