import { expect, test } from './authenticated';

test('map detail history uses fixed platform catalog copy and preserves the typed restore flow', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d01';
    const versionId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d02';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-history-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d03',
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
                        'settings.map_details_history.open':
                            'Localized previous map versions',
                        'settings.map_details_history.title':
                            'Localized map detail history',
                        'settings.map_details_history.description':
                            'Localized map-history guidance.',
                        'settings.map_details_history.close':
                            'Close localized map detail history',
                        'settings.map_details_history.loading':
                            'Loading localized map history…',
                        'settings.map_details_history.error':
                            'Localized map history error.',
                        'settings.map_details_history.no_description':
                            'No localized description',
                        'settings.map_details_history.restoring':
                            'Restoring localized map version…',
                        'settings.map_details_history.restore':
                            'Restore localized map version',
                        'settings.map_details_history.restore_confirm':
                            'Restore this localized map version?',
                        'settings.map_details_history.empty':
                            'No localized map history.',
                        'settings.map_details_history.pagination':
                            'Localized map history pagination',
                        'settings.map_details_history.previous':
                            'Localized previous page',
                        'settings.map_details_history.page':
                            'Localized map page :page of :last_page',
                        'settings.map_details_history.next':
                            'Localized next page',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: [
                    {
                        access_roles: [],
                        description: 'A mocked authoring map.',
                        id: mapId,
                        node_count: 0,
                        nodes: [],
                        review_count: 0,
                        slug: 'mocked-map',
                        title: 'Current map detail',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d04',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    can_delete_world_maps: false,
                    can_manage_map_access: false,
                    editable_map: {
                        map: {
                            access_roles: [],
                            background_config: {},
                            description: 'A mocked authoring map.',
                            editing_group_ids: [],
                            grid_config: {},
                            id: mapId,
                            map_assets: [],
                            map_assets_locked: false,
                            node_count: 0,
                            nodes: [],
                            review_count: 0,
                            slug: 'mocked-map',
                            title: 'Current map detail',
                            topic_id: null,
                            updated_at: '2026-11-14T12:34:00Z',
                        },
                        world: {
                            description: 'A mocked authoring world.',
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d04',
                            slug: 'mocked-world',
                            title: 'Mocked World',
                            updated_at: '2026-11-14T12:34:00Z',
                        },
                    },
                    access_groups: [],
                    items: [],
                    learning_groups: [],
                    role_options: [],
                    sounds: [],
                    topic_options: [],
                    tools: [],
                }),
            });
        },
    );
    await page.route(
        new RegExp(
            `/api/v1/admin/world-builder/maps/${mapId}/versions(?:\\?.*)?$`,
        ),
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [
                        {
                            created_at: '2026-11-14T12:30:00Z',
                            description: '',
                            id: versionId,
                            map_assets_locked: false,
                            title: 'Original localized detail',
                            topic_id: null,
                        },
                    ],
                    last_page: 2,
                    page: 1,
                    per_page: 4,
                    total: 5,
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}/versions/${versionId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    description: '',
                    map_assets_locked: false,
                    map_id: mapId,
                    title: 'Original localized detail',
                    topic_id: null,
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

    await page.goto(`/settings?panel=admin-world-builder&map=${mapId}`);
    await page.getByRole('button', { name: 'Edit map details' }).click();
    await page
        .getByRole('button', { name: 'Localized previous map versions' })
        .click();

    const history = page.locator(
        '[data-wl-id="authoring.world-builder.map-details-history.dialog"]',
    );
    await expect(
        history.getByRole('heading', {
            name: 'Localized map detail history',
        }),
    ).toBeVisible();
    await expect(
        history.getByText('Localized map-history guidance.'),
    ).toBeVisible();
    await expect(history.getByText('No localized description')).toBeVisible();
    await expect(
        history.getByText('Localized map page 1 of 2'),
    ).toBeVisible();
    await expect(
        history.getByRole('button', { name: 'Localized next page' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await history.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    page.once('dialog', (dialog) => {
        expect(dialog.message()).toBe('Restore this localized map version?');
        void dialog.accept();
    });
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/maps/${mapId}/versions/${versionId}`),
    );
    await history
        .getByRole('button', { name: 'Restore localized map version' })
        .click();
    expect((await restored).status()).toBe(200);
    await expect(page.getByLabel('Title')).toHaveValue(
        'Original localized detail',
    );
    await history
        .getByLabel('Close localized map detail history')
        .click();
});
