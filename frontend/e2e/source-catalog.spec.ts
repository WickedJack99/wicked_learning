import { expect, test } from './authenticated';

test('a local author can maintain the source-adapted reusable source catalog', async ({
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

    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Source catalog' }).click();
    const catalog = page.locator('[data-wl-id="authoring.source-catalog"]');
    await expect(catalog).toBeVisible();

    const title = `Source ${Date.now()}`;
    await catalog.getByLabel('Title').fill(title);
    await catalog.getByLabel('URL').fill('https://example.test/source');
    await catalog.getByLabel('Publisher').fill('Local publisher');
    await catalog.getByLabel('Concepts (comma-separated)').fill('retrieval, practice');
    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/source-records'),
    );
    await catalog.getByRole('button', { name: 'Save source' }).click();
    expect((await created).status()).toBe(201);
    await expect(catalog.getByText(title, { exact: true })).toBeVisible();

    const updatedTitle = `${title} revised`;
    await catalog.getByLabel('Title').fill(updatedTitle);
    const updated = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/admin/source-records/'),
    );
    await catalog.getByRole('button', { name: 'Save source' }).click();
    expect((await updated).status()).toBe(200);
    await expect(catalog.getByText('Source history')).toBeVisible();
    await expect(catalog.getByText(title, { exact: true }).last()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/source-records/') &&
            response.url().includes('/versions/'),
    );
    await catalog.getByRole('button', { name: 'Restore' }).first().click();
    expect((await restored).status()).toBe(200);
    await expect(catalog.getByLabel('Title')).toHaveValue(title);

    page.once('dialog', (dialog) => dialog.accept());
    const deleted = page.waitForResponse(
        (response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes('/api/v1/admin/source-records/'),
    );
    await catalog.getByRole('button', { name: 'Delete' }).click();
    expect((await deleted).status()).toBe(204);
    await expect(catalog.getByText(title, { exact: true })).toBeHidden();
});
