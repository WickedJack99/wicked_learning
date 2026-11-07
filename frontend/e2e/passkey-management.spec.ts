import { expect, test } from '@playwright/test';

const currentUser = {
    appearance: 'system',
    capabilities: [],
    email: 'learner@example.test',
    roles: [],
    subject_id: '00000000-0000-0000-0000-000000000001',
};

test('Personal Security keeps the original passkey management structure', async ({ page }) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(currentUser) });
    });
    await page.route('**/api/v1/account/password/confirmation', async (route) => {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ confirmed: true }) });
    });
    await page.route('**/api/v1/account/two-factor', async (route) => {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: false }) });
    });
    await page.route('**/api/v1/account/passkeys', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    authenticator: null,
                    created_at: '2026-11-07T12:00:00.000000Z',
                    id: '00000000-0000-0000-0000-000000000002',
                    last_used_at: null,
                    name: 'Chrome on Mac',
                },
            ]),
        });
    });

    await page.goto('/settings?panel=personal&personal=security');

    await expect(page.getByRole('heading', { name: 'Passkeys' })).toBeVisible();
    await expect(page.getByText('Manage your passkeys for passwordless sign-in')).toBeVisible();
    await expect(page.getByText('Chrome on Mac')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add passkey' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove passkey' }).click();
    await expect(page.getByRole('heading', { name: 'Remove passkey' })).toBeVisible();
    await expect(page.getByText('You will no longer be able to use it to sign in.')).toBeVisible();
});

test('login preserves the original passkey alternative before email sign-in', async ({ page }) => {
    await page.goto('/login');

    const passkeyButton = page.getByRole('button', { name: 'Sign in with a passkey' });
    await expect(passkeyButton).toBeVisible();
    await expect(page.getByText('Or continue with email')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
});
