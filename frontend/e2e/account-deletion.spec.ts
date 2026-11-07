import { expect, test } from '@playwright/test';

test('the source delete-account confirmation sends the current password and returns home', async ({ page }) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'light',
                capabilities: [],
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '00000000-0000-0000-0000-000000000001',
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/account/profile', async (route) => {
        expect(route.request().method()).toBe('DELETE');
        expect(route.request().postDataJSON()).toEqual({
            password: 'current password',
        });
        await route.fulfill({ status: 204 });
    });
    await page.goto('/settings?panel=personal&personal=delete-account');

    await expect(page.getByRole('heading', { name: 'Delete account' }).first()).toBeVisible();
    await expect(page.getByText('Please proceed with caution, this cannot be undone.')).toBeVisible();
    await page.locator('[data-test="delete-user-button"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Password').fill('current password');
    await page.locator('[data-test="confirm-delete-user-button"]').click();
    await expect(page).toHaveURL(/\/$/);
});
