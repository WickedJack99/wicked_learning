import { expect, test } from './authenticated';

test('World details use fixed platform catalog copy and preserve the typed restore flow', async ({
    page,
}) => {
    const worldId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d21';
    const versionId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d22';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'world-details-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d23',
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/platform-translations',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    locale: 'test',
                    translations: {
                        'settings.world_details.open':
                            'Localized edit world details',
                        'settings.world_details.eyebrow':
                            'Localized World Builder',
                        'settings.world_details.title':
                            'Localized world details',
                        'settings.world_details.description':
                            'Localized world-details guidance.',
                        'settings.world_details.close':
                            'Close localized world details',
                        'settings.world_details.title_label':
                            'Localized world title',
                        'settings.world_details.description_label':
                            'Localized world description',
                        'settings.world_details.title_required':
                            'A localized world title is required.',
                        'settings.world_details.invalid':
                            'Localized world details are invalid.',
                        'settings.world_details.conflict':
                            'Localized world details conflict.',
                        'settings.world_details.save_error':
                            'Localized world details could not be saved.',
                        'settings.world_details.network_error':
                            'Localized world connection error.',
                        'settings.world_details.history_title':
                            'Localized previous world versions',
                        'settings.world_details.history_description':
                            'Localized world-history guidance.',
                        'settings.world_details.history_loading':
                            'Loading localized world history…',
                        'settings.world_details.history_error':
                            'Localized world history error.',
                        'settings.world_details.no_description':
                            'No localized world description',
                        'settings.world_details.restoring':
                            'Restoring localized world version…',
                        'settings.world_details.restore':
                            'Restore localized world version',
                        'settings.world_details.restore_confirm':
                            'Restore this localized world version?',
                        'settings.world_details.history_empty':
                            'No localized world history.',
                        'settings.world_details.previous':
                            'Localized previous page',
                        'settings.world_details.page':
                            'Localized world page :page of :last_page',
                        'settings.world_details.next':
                            'Localized next page',
                        'settings.world_details.cancel':
                            'Localized cancel world details',
                        'settings.world_details.saving':
                            'Saving localized world details…',
                        'settings.world_details.save':
                            'Save localized world details',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: [],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'Current world description.',
                    id: worldId,
                    slug: 'mocked-world',
                    title: 'Current World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(
        new RegExp('/api/v1/admin/world-builder/world/versions(?:\\?.*)?$'),
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [
                        {
                            created_at: '2026-11-14T12:30:00Z',
                            description: '',
                            id: versionId,
                            title: 'Original localized World',
                        },
                    ],
                    last_page: 2,
                    page: 1,
                    per_page: 1,
                    total: 2,
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/world/versions/${versionId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    description: '',
                    id: worldId,
                    title: 'Original localized World',
                    updated_at: '2026-11-14T12:35:00Z',
                }),
            });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    await page
        .getByRole('button', { name: 'Localized edit world details' })
        .click();

    const dialog = page.locator(
        '[data-wl-id="authoring.world-builder.world-details.dialog"]',
    );
    await expect(
        dialog.getByRole('heading', { name: 'Localized world details' }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized world-details guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized previous world versions'),
    ).toBeVisible();
    await expect(dialog.getByText('No localized world description')).toBeVisible();
    await expect(
        dialog.getByText('Localized world page 1 of 2'),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Localized next page' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    page.once('dialog', (confirm) => {
        expect(confirm.message()).toBe('Restore this localized world version?');
        void confirm.accept();
    });
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/world/versions/${versionId}`),
    );
    await dialog
        .getByRole('button', { name: 'Restore localized world version' })
        .click();
    expect((await restored).status()).toBe(200);
    await expect(dialog.getByLabel('Localized world title')).toHaveValue(
        'Original localized World',
    );
    await expect(dialog.getByLabel('Localized world description')).toHaveValue(
        '',
    );
    await dialog
        .getByRole('button', { name: 'Localized cancel world details' })
        .click();
});
