import { expect, test } from '@playwright/test';

test('a content API author can inspect the live contract and send a documented read request', async ({
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

    await page.goto('/settings?panel=admin-api&api=console');
    const console = page.locator('[data-wl-id="settings.content-api.console"]');
    await expect(console).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Content API' })).toBeVisible();
    await expect(console.getByLabel('Operation')).toHaveValue('maps.index');
    await expect(console.getByLabel('Request path')).toHaveValue('/api/content/v1/maps');

    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(console.getByText('HTTP 200')).toBeVisible();

    await console.getByLabel('Request path').fill('/api/content/v1/contract');
    await console.getByRole('button', { name: 'Send request' }).click();
    await expect(
        console.getByText(
            'The request path must match the selected documented operation.',
        ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'API Documentation' }).click();
    const documentation = page.locator('[data-wl-id="settings.content-api.documentation"]');
    await expect(documentation).toBeVisible();
    await expect(documentation.getByText('AI ContentPlan v1.5')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const docsBox = await documentation.boundingBox();
    expect(docsBox).not.toBeNull();
    expect(docsBox!.x).toBeGreaterThanOrEqual(0);
    expect(docsBox!.x + docsBox!.width).toBeLessThanOrEqual(390);
});
