import { expect, test } from '@playwright/test';

test('login restores the original password-recovery link', async ({ page }) => {
    await page.goto('/login');

    await expect(
        page.getByRole('link', { name: 'Forgot your password?' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(
        page.getByRole('heading', { name: 'Forgot password' }),
    ).toBeVisible();
    await expect(
        page.getByText('Enter your email to receive a password reset link'),
    ).toBeVisible();
});

test('forgot-password preserves the original request and reset journeys', async ({ page }) => {
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/password/forgot', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().postDataJSON()).toEqual({
            email: 'learner@example.test',
        });
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                message: 'We have emailed your password reset link.',
            }),
        });
    });
    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill('learner@example.test');
    await page
        .getByRole('button', { name: 'Email password reset link' })
        .click();
    await expect(
        page.getByText('We have emailed your password reset link.'),
    ).toBeVisible();

    await page.route('**/api/v1/password/reset', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().postDataJSON()).toEqual({
            email: 'learner@example.test',
            password: 'a sufficiently long password',
            password_confirmation: 'a sufficiently long password',
            token: 'opaque-reset-token',
        });
        await route.fulfill({ status: 204 });
    });
    await page.goto(
        '/reset-password/opaque-reset-token?email=learner%40example.test',
    );
    await expect(
        page.getByRole('heading', { name: 'Reset password' }),
    ).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('a sufficiently long password');
    await page
        .getByLabel('Confirm password')
        .fill('a sufficiently long password');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(
        page.getByText('Your password has been reset.'),
    ).toBeVisible();
});
