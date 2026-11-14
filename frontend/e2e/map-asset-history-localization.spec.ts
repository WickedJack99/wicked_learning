import { expect, test } from './authenticated';

test('MapAsset history uses fixed platform catalog copy and preserves the typed restore flow', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d11';
    const assetId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d12';
    const versionId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d13';
    const worldId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d14';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-asset-history-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d15',
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
                        'settings.map_asset_history.open':
                            'Localized previous MapAsset versions',
                        'settings.map_asset_history.title':
                            'Localized MapAsset history',
                        'settings.map_asset_history.description':
                            'Localized MapAsset-history guidance.',
                        'settings.map_asset_history.close':
                            'Close localized MapAsset history',
                        'settings.map_asset_history.loading':
                            'Loading localized MapAsset history…',
                        'settings.map_asset_history.error':
                            'Localized MapAsset history error.',
                        'settings.map_asset_history.untitled':
                            'Untitled localized MapAsset',
                        'settings.map_asset_history.no_image':
                            'No localized image',
                        'settings.map_asset_history.default_interaction':
                            'localized default interaction',
                        'settings.map_asset_history.restoring':
                            'Restoring localized MapAsset version…',
                        'settings.map_asset_history.restore':
                            'Restore localized MapAsset version',
                        'settings.map_asset_history.restore_confirm':
                            'Restore this localized MapAsset version?',
                        'settings.map_asset_history.empty':
                            'No localized MapAsset history.',
                        'settings.map_asset_history.pagination':
                            'Localized MapAsset history pagination',
                        'settings.map_asset_history.previous':
                            'Localized previous page',
                        'settings.map_asset_history.page':
                            'Localized MapAsset page :page of :last_page',
                        'settings.map_asset_history.next':
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
                        title: 'Current map',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: worldId,
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
                            map_assets: [
                                {
                                    focusable: true,
                                    id: assetId,
                                    image_url: null,
                                    interaction_config: {},
                                    interaction_mode: 'focusable',
                                    locked: false,
                                    node_id: null,
                                    opacity: 1,
                                    sound_config: {},
                                    text: 'Current MapAsset detail',
                                    visual_config: {},
                                    width: 20,
                                    x: 50,
                                    y: 50,
                                    z: 0,
                                },
                            ],
                            map_assets_locked: false,
                            node_count: 0,
                            nodes: [],
                            review_count: 0,
                            slug: 'mocked-map',
                            title: 'Current map',
                            topic_id: null,
                            updated_at: '2026-11-14T12:34:00Z',
                        },
                        world: {
                            description: 'A mocked authoring world.',
                            id: worldId,
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
            `/api/v1/admin/world-builder/assets/${assetId}/versions(?:\\?.*)?$`,
        ),
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [
                        {
                            created_at: '2026-11-14T12:30:00Z',
                            id: versionId,
                            image_url: null,
                            interaction_config: {},
                            interaction_mode: 'focusable',
                            locked: false,
                            opacity: 1,
                            position_x: 50,
                            position_y: 50,
                            position_z: 0,
                            sound_config: {},
                            text: null,
                            visual_config: {},
                            width: 20,
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
        `**/api/v1/admin/world-builder/assets/${assetId}/versions/${versionId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    asset_id: assetId,
                    image_url: null,
                    interaction_config: {},
                    interaction_mode: 'focusable',
                    locked: false,
                    opacity: 1,
                    position_x: 50,
                    position_y: 50,
                    position_z: 0,
                    sound_config: {},
                    text: 'Restored localized MapAsset detail',
                    visual_config: {},
                    width: 20,
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
    await page
        .locator(`[data-wl-id="authoring.map-asset.select.${assetId}"]`)
        .click();
    await page
        .getByRole('button', { name: 'Localized previous MapAsset versions' })
        .click();

    const history = page.locator(
        '[data-wl-id="authoring.map-asset-history.dialog"]',
    );
    await expect(
        history.getByRole('heading', {
            name: 'Localized MapAsset history',
        }),
    ).toBeVisible();
    await expect(
        history.getByText('Localized MapAsset-history guidance.'),
    ).toBeVisible();
    await expect(
        history.getByText('Untitled localized MapAsset'),
    ).toBeVisible();
    await expect(
        history.getByText('No localized image · focusable'),
    ).toBeVisible();
    await expect(
        history.getByText('Localized MapAsset page 1 of 2'),
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
        expect(dialog.message()).toBe('Restore this localized MapAsset version?');
        void dialog.accept();
    });
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/assets/${assetId}/versions/${versionId}`),
    );
    await history
        .getByRole('button', { name: 'Restore localized MapAsset version' })
        .click();
    expect((await restored).status()).toBe(200);
    await expect(page.getByLabel('Label shown on the MapAsset')).toHaveValue(
        'Restored localized MapAsset detail',
    );
    await history
        .getByLabel('Close localized MapAsset history')
        .click();
});
