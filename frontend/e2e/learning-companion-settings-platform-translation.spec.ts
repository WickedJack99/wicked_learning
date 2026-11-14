import { expect, test } from './authenticated';

test('the Learning Companion settings surfaces consume their fixed platform catalog copy', async ({
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
                    'settings.learning_companion.identity.allowed_context':
                        'Localized allowed context',
                    'settings.learning_companion.identity.capabilities.current-context':
                        'Localized current context',
                    'settings.learning_companion.identity.display_name':
                        'Localized display name',
                    'settings.learning_companion.identity.title':
                        'Localized identity policy',
                    'settings.learning_companion.dialogues.description':
                        'Localized graph workspace guidance.',
                    'settings.learning_companion.dialogues.search_label':
                        'Localized graph search',
                    'settings.learning_companion.dialogues.search_placeholder':
                        'Localized search graphs',
                    'settings.learning_companion.dialogues.title':
                        'Localized dialogues workspace',
                    'settings.learning_companion.dialogue_editor.flow_title':
                        'Localized conversation flow',
                    'settings.learning_companion.dialogue_editor.graph_name':
                        'Localized graph name',
                    'settings.learning_companion.dialogue_editor.title':
                        'Localized graph editor',
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
    await page.route(
        '**/api/v1/admin/learning-companion/dialogues**',
        async (route) => {
            const url = new URL(route.request().url());
            const dialogueId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b';
            if (url.pathname.endsWith('/dialogues')) {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: [
                            {
                                assignments_count: 0,
                                id: dialogueId,
                                name: 'Source graph',
                                updated_at: '2026-11-14T12:34:00Z',
                            },
                        ],
                        pagination: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 6,
                            total: 1,
                        },
                    }),
                });
                return;
            }
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    assignments_count: 0,
                    dialogue_graph: {
                        nodes: [
                            {
                                id: 'welcome',
                                message: 'Source authored message',
                                title: 'Welcome',
                                type: 'message',
                            },
                        ],
                        start: 'welcome',
                        version: 1,
                    },
                    id: dialogueId,
                    name: 'Source graph',
                    updated_at: '2026-11-14T12:34:00Z',
                }),
            });
        },
    );

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
    await expect(
        page.getByRole('heading', { name: 'Localized identity policy' }),
    ).toBeVisible();
    await expect(page.getByLabel('Localized display name')).toHaveValue(
        'Guide',
    );
    await expect(page.getByText('Localized allowed context')).toBeVisible();
    await expect(page.getByText('Localized current context')).toBeVisible();

    await navigation.getByRole('tab', { name: 'Localized dialogues' }).click();
    await expect(
        page.getByRole('heading', { name: 'Localized dialogues workspace' }),
    ).toBeVisible();
    await expect(
        page.getByText('Localized graph workspace guidance.'),
    ).toBeVisible();
    await expect(page.getByLabel('Localized graph search')).toHaveAttribute(
        'placeholder',
        'Localized search graphs',
    );
    await page.getByRole('button', { name: 'Source graph' }).click();
    await page.getByRole('button', { name: 'Open graph editor' }).click();
    await expect(
        page.getByRole('heading', { name: 'Localized graph editor' }),
    ).toBeVisible();
    await expect(page.getByLabel('Localized graph name')).toHaveValue(
        'Source graph',
    );
    await expect(
        page.getByText('Localized conversation flow'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const selector = page.getByLabel('Localized Learning Companion selector');
    await expect(selector).toHaveValue('dialogues');
    await expect(selector.locator('option')).toHaveText([
        'Localized identity',
        'Localized dialogues',
    ]);
});
