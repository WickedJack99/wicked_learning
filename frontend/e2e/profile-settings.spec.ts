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
    await page.locator('#profile-image-upload').setInputFiles({
        name: 'profile.gif',
        mimeType: 'image/gif',
        buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
    });
    await expect(page.locator('img[src^="/api/v1/profile-images/"]')).toBeVisible();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status')).toHaveText('Profile updated.');
    const savedProfile = await page.request.get('/api/v1/account/profile');
    await expect(savedProfile.json()).resolves.toMatchObject({
        profile_image_url: expect.stringMatching(/^\/api\/v1\/profile-images\//),
    });
    const currentUser = await page.request.get('/api/v1/me');
    await expect(currentUser.json()).resolves.toMatchObject({
        email: updatedEmail,
    });

    await page.goto('/settings?panel=personal&personal=notifications');
    await expect(
        page.getByRole('heading', { name: 'Communication preferences' }),
    ).toBeVisible();

    await page.goto('/settings?panel=personal&personal=language');
    await expect(
        page.getByRole('heading', { name: 'Current language' }),
    ).toBeVisible();
    await expect(page.getByLabel('Current language')).toHaveValue('en');

    const languageToSelect = process.env.E2E_LANGUAGE_TO_SELECT;
    if (languageToSelect) {
        await page.getByLabel('Current language').selectOption(languageToSelect);
        const languageSave = page.waitForResponse((response) =>
            response.url().endsWith('/api/v1/learner/language-preference')
            && response.request().method() === 'PATCH',
        );
        await page.getByRole('button', { name: 'Save language' }).click();
        expect((await languageSave).ok()).toBe(true);
        const savedLanguage = await page.request.get(
            '/api/v1/learner/language-preference',
        );
        await expect(savedLanguage.json()).resolves.toMatchObject({
            locale: languageToSelect,
        });
    }
});
