import { expect, test } from './authenticated';

test('the source Journal route redirects to the Learning Desk overlay', async ({
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

    await page.goto('/journal');
    await expect(page).toHaveURL(/\/home\?journal=1$/);
    await expect(page.locator('#learning-journal-panel')).toBeVisible();

    await page.getByRole('button', { name: 'Close journal' }).click();
    await expect(page.locator('#learning-journal-panel')).toHaveCount(0);
    await expect(page).toHaveURL(/\/home$/);
});
