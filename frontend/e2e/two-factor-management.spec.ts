import { expect, test } from '@playwright/test';

const currentUser = {
    appearance: 'system',
    capabilities: [],
    email: 'learner@example.test',
    roles: [],
    subject_id: '00000000-0000-0000-0000-000000000001',
};

async function authenticateSecurityRoute(page: import('@playwright/test').Page): Promise<void> {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(currentUser),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/account/password/confirmation', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ confirmed: true }),
        });
    });
}

test('Personal Security preserves the source TOTP setup and verification journey', async ({
    page,
}) => {
    await authenticateSecurityRoute(page);
    await page.route('**/api/v1/account/two-factor', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ enabled: false }),
        });
    });
    await page.route('**/api/v1/account/two-factor/setup', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                manual_setup_key: 'JBSWY3DPEHPK3PXP',
                provisioning_url:
                    'otpauth://totp/Wicked%20Learning:learner%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Wicked%20Learning',
            }),
        });
    });
    await page.route('**/api/v1/account/two-factor/confirm', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                recovery_codes: ['first-recovery-code', 'second-recovery-code'],
            }),
        });
    });

    await page.goto('/settings?panel=personal&personal=security');

    await expect(
        page.getByRole('heading', { name: 'Two-factor authentication' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Enable 2FA' }).click();
    await expect(
        page.getByRole('heading', { name: 'Enable two-factor authentication' }),
    ).toBeVisible();
    await expect(
        page.getByRole('img', { name: 'Authenticator setup QR code' }),
    ).toBeVisible();
    await expect(page.getByLabel('Manual setup key')).toHaveValue(
        'JBSWY3DPEHPK3PXP',
    );
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Authentication code').fill('123456');
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('button', { name: 'Disable 2FA' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide recovery codes' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Recovery codes' })).toContainText(
        'first-recovery-code',
    );
});

test('Personal Security preserves the source recovery-code view, replacement, and disable controls', async ({
    page,
}) => {
    await authenticateSecurityRoute(page);
    await page.route('**/api/v1/account/two-factor', async (route) => {
        if (route.request().method() === 'DELETE') {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ enabled: false }),
            });
            return;
        }
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ enabled: true }),
        });
    });
    await page.route('**/api/v1/account/two-factor/recovery-codes', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                recovery_codes:
                    route.request().method() === 'POST'
                        ? ['replacement-recovery-code']
                        : ['stored-recovery-code'],
            }),
        });
    });

    await page.goto('/settings?panel=personal&personal=security');

    await page.getByRole('button', { name: 'View recovery codes' }).click();
    await expect(page.getByRole('list', { name: 'Recovery codes' })).toContainText(
        'stored-recovery-code',
    );
    await page.getByRole('button', { name: 'Regenerate codes' }).click();
    await expect(page.getByRole('list', { name: 'Recovery codes' })).toContainText(
        'replacement-recovery-code',
    );
    await page.getByRole('button', { name: 'Disable 2FA' }).click();
    await expect(page.getByRole('button', { name: 'Enable 2FA' })).toBeVisible();
});
