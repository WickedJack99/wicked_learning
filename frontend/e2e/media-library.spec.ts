import { expect, test } from '@playwright/test';

test('an authorized administrator can upload, describe, replace, preview and remove a reusable visual', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-assets');
    await expect(page.getByRole('heading', { name: 'Visual library' })).toBeVisible();

    const svg = (color: string) => ({
        buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${color}"/></svg>`),
        mimeType: 'image/svg+xml',
        name: 'library-visual.svg',
    });
    const upload = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/admin/media-assets'));
    await page.locator('input[type="file"]').first().setInputFiles(svg('#0f766e'));
    expect((await upload).status()).toBe(201);
    await expect(page.getByRole('button', { name: 'Uploaded visual' }).first()).toBeVisible();

    const name = `Library visual ${Date.now()}`;
    await page.getByLabel('Visual name').fill(name);
    await page.getByLabel('Visual category').fill('E2E scenes');
    await page.getByLabel('Visual tags').fill('e2e, visual');
    const metadata = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('/api/v1/admin/media-assets/'));
    await page.getByRole('button', { name: 'Save details' }).click();
    expect((await metadata).status()).toBe(200);
    await expect(page.getByRole('button', { name }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute('href', /download=true/);

    page.once('dialog', (dialog) => dialog.accept());
    const replacement = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/replace'));
    await page.locator('input[type="file"]').last().setInputFiles(svg('#1d4ed8'));
    expect((await replacement).status()).toBe(200);

    page.once('dialog', (dialog) => dialog.accept());
    const deletion = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes('/api/v1/admin/media-assets/'));
    await page.getByRole('button', { name: 'Delete' }).click();
    expect((await deletion).status()).toBe(204);
    await expect(page.getByRole('button', { name })).toBeHidden();
});
