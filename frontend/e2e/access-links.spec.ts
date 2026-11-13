import { expect, test } from './authenticated';

test('a local administrator can select source-shaped roles for a registration access link', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-access&access=links');
    await expect(
        page.getByRole('heading', { name: 'Access links', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Purpose').selectOption('registration');
    await expect(page.getByLabel('Roles')).toBeVisible();
    await expect(page.getByLabel('Roles').locator('option')).not.toHaveCount(0);
});
