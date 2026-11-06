import { expect, test } from '@playwright/test';

test('registration keeps invalid invitations indistinguishable from other rejected details', async ({
    page,
}) => {
    await page.goto('/register');

    await page.getByLabel('Name').fill('Registration attempt');
    await page.getByLabel('Email address').fill('registration-attempt@example.test');
    await page.getByLabel('Registration token').fill('not-a-valid-invitation');
    await page.getByLabel('Password', { exact: true }).fill('a-long-test-password');
    await page.getByLabel('Confirm password').fill('a-long-test-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('alert')).toHaveText(
        'The account could not be created with these details.',
    );
});

test('a one-use local invitation creates a signed-in identity', async ({ page }) => {
    test.skip(
        !process.env.E2E_REGISTRATION_TOKEN,
        'requires a freshly issued local invitation token',
    );
    const email = `registration-e2e-${Date.now()}@example.test`;

    await page.goto('/register');
    await page.getByRole('button', { name: 'Dark' }).click();
    await page.getByLabel('Name').fill('Registration E2E learner');
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Registration token')
        .fill(process.env.E2E_REGISTRATION_TOKEN!);
    await page.getByLabel('Password', { exact: true }).fill('a-long-test-password');
    await page.getByLabel('Confirm password').fill('a-long-test-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/world$/);
    const session = await page.request.get('/api/v1/session');
    await expect(session.json()).resolves.toMatchObject({ authenticated: true });
    await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible();
    const currentUser = await page.request.get('/api/v1/me');
    await expect(currentUser.json()).resolves.toMatchObject({
        appearance: 'dark',
        email,
        roles: ['learner'],
    });
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.goto('/settings?panel=personal&personal=appearance');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
    await page.getByRole('button', { name: 'Light' }).click();
    await expect.poll(async () => (await page.request.get('/api/v1/me')).json()).toMatchObject({
        appearance: 'light',
    });
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.getByRole('link', { name: 'Sound' }).click();
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=sound$/);
    await expect(page.getByRole('heading', { name: 'Sound' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test effects' })).toBeVisible();
    await page.getByLabel('Effects volume').fill('35');
    await page.getByRole('button', { name: 'Save sound preferences' }).click();
    await expect.poll(async () => (await page.request.get('/api/v1/learner/sound-preferences')).json()).toMatchObject({
        effects_volume: 35,
    });

    await page.goto('/register');
    await page.getByLabel('Name').fill('Second registration attempt');
    await page
        .getByLabel('Email address')
        .fill(`registration-reuse-${Date.now()}@example.test`);
    await page
        .getByLabel('Registration token')
        .fill(process.env.E2E_REGISTRATION_TOKEN!);
    await page.getByLabel('Password', { exact: true }).fill('a-long-test-password');
    await page.getByLabel('Confirm password').fill('a-long-test-password');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('alert')).toHaveText(
        'The account could not be created with these details.',
    );
});
