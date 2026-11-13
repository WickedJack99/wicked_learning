import { expect, test } from './authenticated';

test('a local support worker can read scoped collective and individual signals', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    await page.goto('/settings?panel=admin-learning-support&support=support-signals');
    await expect(page.getByRole('heading', { name: 'Learning Support' })).toBeVisible();
    await expect(page.getByText('Collective overview')).toBeVisible();
});
