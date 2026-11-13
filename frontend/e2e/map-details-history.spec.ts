import { expect, test } from './authenticated';

test('a local author restores a scoped map detail version', async ({ page }) => {
    test.setTimeout(60_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    const original = `Map history ${Date.now()}`;
    const changed = `${original} changed`;
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(original);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Edit map details' }).click();
    await page.getByLabel('Title').fill(changed);
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('heading', { name: changed })).toBeVisible();
    await page.getByRole('button', { name: 'Edit map details' }).click();
    await page.getByRole('button', { name: 'Previous versions' }).click();
    const history = page.locator('[data-wl-id="authoring.world-builder.map-details-history.dialog"]');
    await expect(history.getByText(original, { exact: true })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/versions/'),
    );
    await history.getByRole('button', { name: 'Restore this version' }).click();
    expect((await restored).status()).toBe(200);
    await expect(page.getByLabel('Title')).toHaveValue(original);
    await history.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: original })).toBeVisible();
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
