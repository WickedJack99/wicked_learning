import { expect, test } from './authenticated';

test('the Learning Companion navigator consumes its fixed platform catalog copy', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'companion-admin@example.test',
                roles: ['administrator'],
                settings_access: { companion: true },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.learning_companion.navigation.dialogues.description':
                        'Localized reusable dialogue graphs.',
                    'settings.learning_companion.navigation.dialogues.label':
                        'Localized dialogues',
                    'settings.learning_companion.navigation.identity.description':
                        'Localized companion identity.',
                    'settings.learning_companion.navigation.identity.label':
                        'Localized identity',
                    'settings.learning_companion.navigation.sections_label':
                        'Localized Learning Companion sections',
                    'settings.learning_companion.navigation.selector_label':
                        'Localized Learning Companion selector',
                },
            }),
        });
    });
    await page.route('**/api/v1/admin/learning-companion', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                ai_capabilities: [],
                ai_enabled: false,
                ai_template_id: null,
                ai_template_options: [],
                avatar_color: '#0891b2',
                avatar_position_x: 50,
                avatar_position_y: 50,
                avatar_scale: 100,
                avatar_url: null,
                display_name: 'Guide',
                enabled: true,
                mode: 'scripted',
                welcome_message: 'Welcome.',
            }),
        });
    });

    await page.goto('/settings?panel=admin-learning-companion');

    const navigation = page.getByRole('tablist', {
        name: 'Localized Learning Companion sections',
    });
    await expect(navigation.getByRole('tab', { name: 'Localized identity' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(
        navigation.getByText('Localized companion identity.'),
    ).toBeVisible();
    await expect(
        navigation.getByRole('tab', { name: 'Localized dialogues' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const selector = page.getByLabel('Localized Learning Companion selector');
    await expect(selector).toHaveValue('identity');
    await expect(selector.locator('option')).toHaveText([
        'Localized identity',
        'Localized dialogues',
    ]);
});
