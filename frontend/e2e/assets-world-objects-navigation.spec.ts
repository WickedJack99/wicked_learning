import { expect, test } from './authenticated';

test('asset workspaces retain the source Settings hierarchy on desktop and narrow layouts', async ({
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

    await page.goto('/settings?panel=admin-assets-world-objects&asset=dialogue-sounds');
    const sections = page.getByRole('tablist', {
        name: 'Assets and world objects sections',
    });
    await expect(sections).toBeVisible();
    await expect(
        sections.getByRole('tab', { name: 'Dialogue typing' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Letter sound sets' })).toBeVisible();

    await page.getByRole('tab', { name: 'Cursor images' }).click();
    await expect(page).toHaveURL(/asset=cursors/);
    await expect(page.getByRole('heading', { name: 'Cursor images' })).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(
        page.getByLabel('Assets and world objects section', { exact: true }),
    ).toHaveValue('cursors');
    await page
        .getByLabel('Assets and world objects section', { exact: true })
        .selectOption('items');
    await expect(page).toHaveURL(/asset=items/);
    await expect(page.getByRole('heading', { name: 'Edit items' })).toBeVisible();
});
