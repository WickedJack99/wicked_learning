import { expect, test } from './authenticated';

test('presentation and localization workspaces retain the source Settings hierarchy on desktop and narrow layouts', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-presentation-localization&presentation=palette');
    const sections = page.getByRole('tablist', { name: 'Presentation and localization sections' });
    await expect(sections).toBeVisible();
    await expect(sections.getByRole('tab', { name: 'Color palette' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Languages' }).click();
    await expect(page).toHaveURL(/presentation=languages/);

    await page.setViewportSize({ height: 844, width: 390 });
    const mobileSections = page.getByLabel('Presentation and localization section', { exact: true });
    await expect(mobileSections).toHaveValue('languages');
    await mobileSections.selectOption('public');
    await expect(page).toHaveURL(/presentation=public/);
    await expect(page.getByRole('heading', { name: 'Public presentation', exact: true })).toBeVisible();
});
