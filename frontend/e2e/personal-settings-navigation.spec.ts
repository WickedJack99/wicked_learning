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

    await page.goto('/settings');

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

    await navigation.getByRole('tab', { name: /Delete account/ }).click();
    await expect(page).toHaveURL(
        /\/settings\?panel=personal&personal=delete-account/,
    );
});
