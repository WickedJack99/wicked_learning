import { expect, test } from '@playwright/test';

test('a disposable local identity updates its password in the source-derived security form', async ({
    page,
}) => {
    const email = process.env.E2E_PASSWORD_CHANGE_EMAIL;
    const currentPassword = process.env.E2E_PASSWORD_CHANGE_CURRENT_PASSWORD;
    const replacementPassword = process.env.E2E_PASSWORD_CHANGE_REPLACEMENT_PASSWORD;
    test.skip(
        !email || !currentPassword || !replacementPassword,
        'requires a disposable local identity and two supplied test passwords',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(currentPassword!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=personal&personal=security');
    await expect(
        page.getByRole('heading', { name: 'Update password' }),
    ).toBeVisible();
    await page.getByLabel('Current password').fill(currentPassword!);
    await page.getByLabel('New password').fill(replacementPassword!);
    await page.getByLabel('Confirm password').fill(replacementPassword!);
    await page.getByRole('button', { name: 'Save password' }).click();
    await expect(page.getByRole('status')).toHaveText('Password updated.');
});
