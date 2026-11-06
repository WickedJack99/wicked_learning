import { expect, test } from '@playwright/test';

test('a disposable local identity updates source-shaped profile details', async ({ page }) => {
    const email = process.env.E2E_PROFILE_EMAIL;
    const password = process.env.E2E_PROFILE_PASSWORD;
    const updatedEmail = process.env.E2E_PROFILE_UPDATED_EMAIL;
    test.skip(
        !email || !password || !updatedEmail,
        'requires a disposable local identity and a replacement email address',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings');
    await expect(
        page.getByRole('heading', { name: 'Profile details' }),
    ).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('Profile settings browser check');
    await page.getByLabel('Public username').fill(`profile_${Date.now()}`);
    await page.getByLabel('Email address').fill(updatedEmail!);
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status')).toHaveText('Profile updated.');
    const currentUser = await page.request.get('/api/v1/me');
    await expect(currentUser.json()).resolves.toMatchObject({
        email: updatedEmail,
    });
});
