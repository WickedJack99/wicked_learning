import { expect, test } from '@playwright/test';

test('Personal settings restores the source section navigation', async ({ page }) => {
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
    await page.route('**/api/v1/account/profile', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                name: 'Learner',
                profile_image_id: null,
                profile_image_url: null,
                username: null,
            }),
        });
    });
    await page.route('**/api/v1/account/password/confirmation', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ confirmed: true }),
        });
    });
    await page.route('**/api/v1/learner/language-preference', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                available_languages: [{ code: 'en', name: 'English', native_name: 'English' }],
                locale: 'en',
            }),
        });
    });
    await page.route('**/api/v1/learner/feedback-prompt-preference', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ status: 'enabled' }),
        });
    });
    await page.route('**/api/v1/learner/sound-preferences', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ ambience_volume: 50, effects_volume: 50, muted: false }),
        });
    });

    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(
        page
            .getByRole('navigation', { name: 'Settings navigation' })
            .getByRole('button', { name: 'Personal' }),
    ).toBeVisible();

    const navigation = page.getByRole('tablist', {
        name: 'Personal settings sections',
    });
    await expect(navigation.getByRole('tab')).toHaveText([
        'ProfileIdentity and account details.',
        'AppearanceLight and dark appearance.',
        'LanguagePlatform and learner copy.',
        'NotificationsFuture reminders and quiet hours.',
        'FeedbackShare thoughts about the platform and manage invitations.',
        'SoundSound effects and ambient audio.',
        'SecurityPassword, two-factor and passkeys.',
        'Delete accountPermanently remove your account.',
    ]);
    await expect(navigation.getByRole('tab', { name: /Profile/ })).toHaveAttribute(
        'aria-selected',
        'true',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Settings area')).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 844 });

    await navigation.getByRole('tab', { name: /Profile/ }).press('End');
    await expect(page).toHaveURL(
        /\/settings\?panel=personal&personal=delete-account/,
    );
    await expect(
        page
            .getByRole('tablist', { name: 'Personal settings sections' })
            .getByRole('tab', { name: /Delete account/ }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
        page
            .getByRole('navigation', { name: 'Settings navigation' })
            .getByRole('button', { name: 'Personal' }),
    ).toBeVisible();

    await page.goto('/settings?panel=personal&personal=notifications');
    await expect(
        page.getByRole('heading', { name: 'Communication preferences' }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('navigation', { name: 'Settings navigation' })
            .getByRole('button', { name: 'Personal' }),
    ).toBeVisible();

    for (const [section, heading] of [
        ['appearance', 'Visual mode'],
        ['language', 'Current language'],
        ['feedback', 'Platform feedback'],
        ['sound', 'Audio preferences'],
        ['delete-account', 'Delete account'],
    ]) {
        await test.step(section, async () => {
            await page.goto(`/settings?panel=personal&personal=${section}`);
            await expect(
                page.getByRole('heading', { name: heading }),
            ).toBeVisible();
            await expect(
                page
                    .getByRole('navigation', { name: 'Settings navigation' })
                    .getByRole('button', { name: 'Personal' }),
            ).toBeVisible();
        });
    }

});
