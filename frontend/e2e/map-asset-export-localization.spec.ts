import { expect, test } from './authenticated';

test('MapAsset transfer exports use fixed platform catalog copy and source download routes', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da1';
    const assetId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da2';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-asset-export-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da3',
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
                        'settings.world_builder.map_asset.export':
                            'Export localized MapAsset',
                        'settings.world_builder.map_asset.export_package':
                            'Export localized MapAsset package',
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
                        title: 'Mocked map',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da4',
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
                body: JSON.stringify(mapDocument(mapId, assetId)),
            });
        },
    );

    await page.goto(`/settings?panel=admin-world-builder&map=${mapId}`);
    await page
        .locator(`[data-wl-id="authoring.map-asset.select.${assetId}"]`)
        .click();

    const editor = page.getByRole('dialog');
    await expect(
        editor.getByRole('heading', { name: 'Mocked MapAsset detail' }),
    ).toBeVisible();
    const jsonExport = editor.getByRole('link', {
        exact: true,
        name: 'Export localized MapAsset',
    });
    const packageExport = editor.getByRole('link', {
        name: 'Export localized MapAsset package',
    });
    await expect(jsonExport).toHaveAttribute(
        'href',
        `/api/v1/admin/world-builder/assets/${assetId}/export`,
    );
    await expect(jsonExport).toHaveAttribute('download', '');
    await expect(packageExport).toHaveAttribute(
        'href',
        `/api/v1/admin/world-builder/assets/${assetId}/export-package`,
    );
    await expect(packageExport).toHaveAttribute('download', '');

    await page.setViewportSize({ width: 390, height: 844 });
    await jsonExport.scrollIntoViewIfNeeded();
    await packageExport.scrollIntoViewIfNeeded();
    const jsonBounds = await jsonExport.boundingBox();
    const packageBounds = await packageExport.boundingBox();
    expect(jsonBounds).not.toBeNull();
    expect(packageBounds).not.toBeNull();
    expect(jsonBounds!.x).toBeGreaterThanOrEqual(0);
    expect(jsonBounds!.x + jsonBounds!.width).toBeLessThanOrEqual(390);
    expect(packageBounds!.x).toBeGreaterThanOrEqual(0);
    expect(packageBounds!.x + packageBounds!.width).toBeLessThanOrEqual(390);
});

function mapDocument(mapId: string, assetId: string) {
    return {
        access_groups: [],
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
                        text: 'Mocked MapAsset detail',
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
                title: 'Mocked map',
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da4',
                slug: 'mocked-world',
                title: 'Mocked World',
                updated_at: '2026-11-14T12:34:00Z',
            },
        },
        items: [],
        learning_groups: [],
        role_options: [],
        sounds: [],
        tools: [],
        topic_options: [],
    };
}
