import { expect, test } from '@playwright/test';

test('an asset administrator uses the source-derived item and tool workspace', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    const suffix = Date.now();
    const itemTitle = `Workspace item ${suffix}`;
    const toolTitle = `Workspace tool ${suffix}`;

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-assets&asset=items');
    await expect(page.getByRole('heading', { name: 'Edit items' })).toBeVisible();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Item name').fill(itemTitle);
    await page.getByLabel('Description').fill('Created through the source-derived item workspace.');
    await page.getByRole('button', { name: 'Save item' }).click();
    await expect(page.getByRole('status')).toContainText('Item saved.');
    await expect(page.locator('[data-wl-id="settings.assets.items"]')).toContainText(itemTitle);

    await page.goto('/settings?panel=admin-assets&asset=tools');
    await expect(page.getByRole('heading', { name: 'Edit tools' })).toBeVisible();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Tool name').fill(toolTitle);
    await page.getByLabel('Tool image width %').fill('24');
    await page.getByRole('button', { name: 'Create tool' }).click();
    await expect(page.getByRole('status')).toContainText('Tool saved.');
    await expect(page.locator('[data-wl-id="settings.assets.tools"]')).toContainText(toolTitle);
});
