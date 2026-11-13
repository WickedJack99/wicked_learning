import { expect, test } from '@playwright/test';

test('a learner receives the canonical English platform catalog while no alternate locale is enabled', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const catalog = await page.request.get(
        '/api/v1/learner/platform-translations',
    );
    expect(catalog.status()).toBe(200);
    await expect(catalog.json()).resolves.toMatchObject({
        locale: 'en',
        translations: { 'common.cancel': 'Cancel' },
    });
});
