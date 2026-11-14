import { expect, test } from '@playwright/test';

test('the password-confirmation route returns an anonymous visitor to login', async ({
    page,
}) => {
    await page.goto('/confirm-password');

    await expect(page).toHaveURL(/\/login\?next=%2Fconfirm-password$/);
});

test('the password-confirmation route preserves the source password form and return path', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'system',
                capabilities: [],
                email: 'learner@example.test',
                roles: [],
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
    await page.route('**/api/v1/account/password/confirmation', async (route) => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ confirmed: true }),
            });
            return;
        }

        await route.fallback();
    });

    await page.goto('/confirm-password?next=%2Fworld');

    await expect(
        page.getByRole('heading', { name: 'Confirm password' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'This is a secure area of the application. Please confirm your password before continuing.',
        ),
    ).toBeVisible();

    const confirmation = page.locator(
        '[data-wl-id="identity.password-confirmation"]',
    );
    const box = await confirmation.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    expect(box!.y + box!.height).toBeLessThanOrEqual(720);

    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Confirm password' }).click();
    await expect(page).toHaveURL(/\/world$/);
});

test('Personal Security requires the source recent-password confirmation', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'system',
                capabilities: [],
                email: 'learner@example.test',
                roles: [],
                subject_id: '00000000-0000-0000-0000-000000000001',
            }),
        });
    });
    await page.route('**/api/v1/account/password/confirmation', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ confirmed: false }),
        });
    });

    await page.goto('/settings?panel=personal&personal=security');

    await expect(page).toHaveURL(
        /\/confirm-password\?next=%2Fsettings%3Fpanel%3Dpersonal%26personal%3Dsecurity$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Confirm password' }),
    ).toBeVisible();
});

test('Personal Security keeps the source per-field password controls', async ({
    page,
}) => {
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
    await page.route('**/api/v1/account/password/confirmation', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ confirmed: true }),
        });
    });
    await page.route('**/api/v1/account/passkeys', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify([]),
        });
    });
    await page.route('**/api/v1/account/two-factor', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ enabled: false }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'common.save': 'Store',
                    'settings.personal.security.confirm_password':
                        'Repeat fresh passphrase',
                    'settings.personal.security.current_password':
                        'Existing passphrase',
                    'settings.personal.security.new_password':
                        'Fresh passphrase',
                    'settings.personal.security.title': 'Renew password',
                },
            }),
        });
    });

    await page.goto('/settings?panel=personal&personal=security');

    await expect(
        page.getByRole('heading', { name: 'Renew password' }),
    ).toBeVisible();
    await expect(page.getByLabel('Existing passphrase', { exact: true })).toHaveAttribute(
        'type',
        'password',
    );
    await expect(page.getByLabel('Fresh passphrase', { exact: true })).toHaveAttribute(
        'type',
        'password',
    );
    await expect(
        page.getByLabel('Repeat fresh passphrase', { exact: true }),
    ).toHaveAttribute(
        'type',
        'password',
    );
    await expect(
        page.getByRole('button', { name: 'Show password' }),
    ).toHaveCount(3);
    await expect(
        page.locator('footer').getByRole('button', { name: 'Store' }),
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Show password' }).nth(1).click();
    await expect(page.getByLabel('Fresh passphrase', { exact: true })).toHaveAttribute(
        'type',
        'text',
    );
    await expect(page.getByLabel('Existing passphrase', { exact: true })).toHaveAttribute(
        'type',
        'password',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
        page.getByRole('heading', { name: 'Renew password' }),
    ).toBeVisible();
});
