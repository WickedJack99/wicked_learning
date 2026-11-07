import { expect, test } from '@playwright/test';

test('login preserves the original remembered-session control and contract', async ({ page }) => {
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/session/login', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().postDataJSON()).toEqual({
            email: 'learner@example.test',
            password: 'a sufficiently long password',
            remember: true,
        });
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                authenticated: true,
                subject_id: '00000000-0000-0000-0000-000000000001',
                two_factor_required: false,
            }),
        });
    });

    await page.goto('/login');

    const remember = page.getByLabel('Remember me');
    await expect(remember).not.toBeChecked();
    await remember.check();
    await expect(remember).toBeChecked();

    await page.getByLabel('Email address').fill('learner@example.test');
    await page.getByLabel('Password').fill('a sufficiently long password');
    await page.getByRole('button', { name: 'Log in' }).click();
});
