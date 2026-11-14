import { expect, test } from '@playwright/test';

test('Personal settings restores the source section navigation', async ({ page }) => {
    const settingsPalette = (accent: string) => ({
        accent,
        accent_foreground: '#ffffff',
        accent_foreground_opacity: 100,
        accent_opacity: 100,
        active_background: accent,
        active_background_opacity: 10,
        appearance_switch_active_background: '#ffffff',
        appearance_switch_active_background_opacity: 100,
        appearance_switch_active_text: '#0f172a',
        appearance_switch_active_text_opacity: 100,
        appearance_switch_background: '#e2e8f0',
        appearance_switch_background_opacity: 80,
        appearance_switch_inactive_text: '#64748b',
        appearance_switch_inactive_text_opacity: 100,
        border_color: '#e2e8f0',
        border_color_opacity: 100,
        content_background: '#f1f5f9',
        content_background_opacity: 100,
        input_background: '#ffffff',
        input_background_opacity: 100,
        input_border_color: '#cbd5e1',
        input_border_color_opacity: 100,
        muted_text: '#64748b',
        muted_text_opacity: 100,
        nested_sidebar_background: '#f8fafc',
        nested_sidebar_background_opacity: 96,
        panel_background: '#ffffff',
        panel_background_opacity: 100,
        scrollbar_thumb: '#64748b',
        scrollbar_thumb_opacity: 54,
        sidebar_background: '#ffffff',
        sidebar_background_opacity: 90,
    });
    await page.route('**/api/v1/public/presentation', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                cursors: {},
                settings_palette: {
                    dark: settingsPalette('#b45309'),
                    light: settingsPalette('#9f1239'),
                },
            }),
        });
    });
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
    let profile = {
        email: 'learner@example.test',
        name: 'Learner',
        profile_image_id: null,
        profile_image_url: null,
        username: null,
    };
    await page.route('**/api/v1/account/profile', async (route) => {
        if (route.request().method() === 'PATCH') {
            const body = route.request().postDataJSON() as {
                email: string;
                name: string;
                profile_image_id: string | null;
                username: string | null;
            };
            profile = {
                email: body.email,
                name: body.name,
                profile_image_id: body.profile_image_id,
                profile_image_url: null,
                username: body.username,
            };
        }

        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(profile),
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
    let feedbackPreference = { status: 'enabled' };
    await page.route('**/api/v1/learner/feedback-prompt-preference', async (route) => {
        if (route.request().method() === 'PATCH') {
            const { action } = route.request().postDataJSON() as { action: string };
            feedbackPreference = {
                status: action === 'decline' ? 'declined' : 'enabled',
            };
        }

        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(feedbackPreference),
        });
    });
    let soundPreferences = {
        ambience_volume: 50,
        effects_volume: 50,
        muted: false,
    };
    await page.route('**/api/v1/learner/sound-preferences', async (route) => {
        if (route.request().method() === 'PATCH') {
            soundPreferences = route.request().postDataJSON() as typeof soundPreferences;
        }

        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify(soundPreferences),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'en',
                translations: {
                    'common.appearance.dark': 'Night',
                    'common.appearance.light': 'Day',
                    'common.clear': 'Remove image',
                    'common.download': 'Get image',
                    'common.upload': 'Attach image',
                    'settings.personal.profile.name': 'Learner name',
                    'settings.personal.profile.name.placeholder': 'Your full learner name',
                    'settings.personal.language.current': 'Current locale',
                    'settings.personal.language.save': 'Store locale',
                    'settings.personal.feedback.reminders': 'Catalog feedback reminder',
                    'settings.personal.delete_account.title': 'Remove my account',
                    'settings.personal.sound.effects': 'Effects level',
                    'settings.personal.sound.mute': 'Disable all sounds',
                    'settings.personal.sound.save': 'Store audio choices',
                    'settings.personal.sound.title': 'Audio choices',
                },
            }),
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
    await expect(page.getByLabel('Learner name')).toHaveAttribute(
        'placeholder',
        'Your full learner name',
    );
    await expect
        .poll(() =>
            page.locator('.settings-surface').evaluate((element) =>
                element.style.getPropertyValue('--settings-accent'),
            ),
        )
        .toBe('#9f1239');
    await expect(
        page.locator('footer').getByRole('button', { name: 'Save' }),
    ).toBeVisible();
    await expect(
        page
            .locator('#personal-profile-form')
            .getByRole('button', { name: 'Save' }),
    ).toHaveCount(0);
    await page.getByLabel('Learner name').fill('Footer save learner');
    await page.locator('footer').getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => profile.name).toBe('Footer save learner');

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
        ['language', 'Current locale'],
        ['feedback', 'Platform feedback'],
        ['delete-account', 'Remove my account'],
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

            if (section === 'appearance') {
                await expect(page.getByRole('button', { name: 'Day' })).toBeVisible();
                await expect(page.getByRole('button', { name: 'Night' })).toBeVisible();
            }

            if (section === 'language') {
                await expect(
                    page.locator('footer').getByRole('button', { name: 'Save' }),
                ).toBeDisabled();
            }
        });
    }

    await page.goto('/settings?panel=personal&personal=feedback');
    await expect(page.getByText('Catalog feedback reminder')).toBeVisible();
    await page
        .getByRole('button', { name: 'Turn off invitations' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Turn invitations back on' }),
    ).toBeVisible();
    await expect(page.getByText('Catalog feedback reminder')).toBeVisible();

    await page.goto('/settings?panel=personal&personal=sound');
    await expect(page.getByRole('heading', { name: 'Audio choices' })).toBeVisible();
    await page
        .getByRole('button', { name: 'Disable all sounds' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Disable all sounds' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('slider', { name: 'Effects level' }).fill('36');
    await page
        .locator('footer')
        .getByRole('button', { name: 'Save' })
        .click();
    await expect.poll(() => soundPreferences).toEqual({
        ambience_volume: 50,
        effects_volume: 36,
        muted: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Audio choices' })).toBeVisible();

});
