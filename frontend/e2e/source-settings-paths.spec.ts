import { expect, test } from '@playwright/test';

test('a local administrator can open lifted workspaces at the current Laravel Settings paths', async ({
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

    await page.goto('/settings?panel=admin-assets-world-objects&asset=items');
    await expect(page.getByRole('heading', { name: 'Edit items' })).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=tools');
    await expect(page.getByRole('heading', { name: 'Edit tools' })).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=visuals');
    await expect(
        page.getByRole('heading', { name: 'Visual library' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=sounds');
    await expect(
        page.getByRole('heading', { name: 'Reusable sound library' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=cursors');
    await expect(
        page.getByRole('heading', { name: 'Cursor images' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-public-pages');
    await expect(
        page.getByRole('heading', { name: 'Public presentation' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-color-palettes');
    await expect(
        page.getByRole('heading', { name: 'Color palette' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-translations');
    await expect(
        page.getByRole('heading', { name: 'Language administration' }),
    ).toBeVisible();

    await page.goto('/settings?personal=appearance&support=learning-concepts');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    await page.goto('/settings?panel=appearance');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    await page.goto('/settings?panel=admin-presentation');
    await expect(
        page.getByRole('heading', { name: 'Public presentation' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-users');
    await expect(
        page.getByRole('heading', { level: 1, name: 'Users' }),
    ).toBeVisible();

    await page.goto('/settings?panel=information');
    await expect(
        page.getByRole('heading', { level: 1, name: 'About & legal' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'No settings are available here with the current permissions.',
        ),
    ).toBeVisible();

    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=profile$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Profile' }),
    ).toBeVisible();

    await page.goto('/settings/language');
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=language$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Language' }),
    ).toBeVisible();

    await page.goto('/settings/appearance');
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=appearance$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Appearance' }),
    ).toBeVisible();

    await page.goto('/settings/color-palette');
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-presentation-localization&presentation=palette$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Color palette' }),
    ).toBeVisible();

    await page.goto('/settings/security');
    await expect(page).toHaveURL(/\/confirm-password\?next=%2Fsettings%2Fsecurity$/);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Confirm password' }).click();
    await expect(page).toHaveURL(/\/settings\/security$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Security' }),
    ).toBeVisible();
});
