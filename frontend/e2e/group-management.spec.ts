import { expect, test } from './authenticated';

test('a local platform administrator can create and assign a source-derived learning group', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    const name = `Group administration browser check ${Date.now()}`;
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-access&access=groups');
    await expect(page.getByRole('heading', { name: 'Groups', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'New group' }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Save group' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();

    const firstMember = page.locator('input[type="checkbox"]').first();
    await firstMember.check();
    await page.getByRole('button', { name: 'Save members' }).click();
    await expect(
        page.getByRole('button', { name: `${name} 1 members` }),
    ).toBeVisible();
});
