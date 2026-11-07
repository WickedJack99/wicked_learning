import { expect, test } from '@playwright/test';

test('the two-factor route redirects to login without the source pending session', async ({
    page,
}) => {
    await page.goto('/two-factor-challenge');

    await expect(page).toHaveURL(/\/login$/);
});

test('the two-factor challenge preserves the source authenticator and recovery-code controls', async ({
    page,
}) => {
    await page.route('**/api/v1/session', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                authenticated: false,
                subject_id: null,
                two_factor_required: true,
            }),
        });
    });

    await page.goto('/two-factor-challenge');

    await expect(
        page.getByRole('heading', { name: 'Authentication code' }),
    ).toBeVisible();
    await page.getByLabel('Authentication code').fill('123456');
    await expect(page.getByLabel('Authentication code')).toHaveValue('123456');
    await page.getByRole('button', { name: 'login using a recovery code' }).click();
    await expect(
        page.getByRole('heading', { name: 'Recovery code' }),
    ).toBeVisible();
    await expect(page.getByLabel('Recovery code')).toBeVisible();
    await page.getByRole('button', { name: 'login using an authentication code' }).click();
    await expect(page.getByLabel('Authentication code')).toHaveValue('');

    const challenge = page.locator('[data-wl-id="identity.two-factor-challenge"]');
    const box = await challenge.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);
});
