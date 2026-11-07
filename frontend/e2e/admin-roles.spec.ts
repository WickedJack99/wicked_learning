import { expect, test } from '@playwright/test';

test('a local administrator can open the source-derived role management panel', async ({
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

    await page.goto('/settings?panel=admin-access&access=roles');
    await expect(
        page.getByRole('heading', { name: 'Roles', exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Access management')).toBeVisible();
    await expect(page.getByText('Permission level')).toBeVisible();
});
