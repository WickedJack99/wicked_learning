import { expect, test } from './authenticated';

const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d01';

test('World Builder localizes the source-shaped map details and deletion confirmation', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-details-author@example.test',
                roles: ['administrator'],
                settings_access: { world_activities: true, world_maps: true, world_nodes: true },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d02',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.world_builder.map_details.eyebrow': 'Localized map',
                    'settings.world_builder.map_details.no_description': 'Localized missing description.',
                    'settings.world_builder.map_details.slug': 'Localized slug',
                    'settings.world_builder.map_details.tiles': 'Localized tiles',
                    'settings.world_builder.map_details.edit': 'Edit localized map details',
                    'settings.world_builder.map_details.visuals': 'Configure localized map visuals',
                    'settings.world_builder.map_details.add_tile': 'Add localized map tile',
                    'settings.world_builder.map_details.map_assets': 'Localized MapAssets',
                    'settings.world_builder.map_details.activity_review_one': 'Localized :count activity awaiting review',
                    'settings.world_builder.map_details.position': 'Localized hex :q / :r',
                    'settings.world_builder.map_details.edit_tile': 'Edit localized tile',
                    'settings.world_builder.map_details.place_tile': 'Place localized tile',
                    'settings.world_builder.map_details.delete.heading': 'Delete localized map',
                    'settings.world_builder.map_details.delete.description': 'Localized deletion guidance.',
                    'settings.world_builder.map_details.delete.confirm_title': 'Delete localized world map?',
                    'settings.world_builder.map_details.delete.confirm_description': 'Localized final deletion guidance.',
                    'settings.world_builder.map_details.delete_count_one': 'Localized :count tile deletion.',
                    'settings.world_builder.map_details.cancel': 'Cancel localized deletion',
                    'settings.world_builder.map_details.delete.confirm': 'Delete localized world map',
                },
            }),
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: [
                    {
                        description: null,
                        id: mapId,
                        node_count: 1,
                        nodes: [],
                        review_count: 1,
                        slug: 'mocked-map',
                        title: 'Mocked map detail',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d03',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(`**/api/v1/admin/world-builder/maps/${mapId}`, async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                access_groups: [],
                can_delete_world_maps: true,
                can_manage_map_access: false,
                editable_map: {
                    map: {
                        background_config: {},
                        description: null,
                        id: mapId,
                        map_assets: [],
                        map_assets_locked: false,
                        node_count: 1,
                        nodes: [
                            {
                                activity_review_count: 1,
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d04',
                                position: { q: 2, r: -1 },
                                slug: 'mocked-map-asset',
                                title: 'Mocked MapAsset',
                            },
                        ],
                        review_count: 1,
                        slug: 'mocked-map',
                        title: 'Mocked map detail',
                    },
                    world: {
                        description: 'A mocked authoring world.',
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d03',
                        slug: 'mocked-world',
                        title: 'Mocked World',
                    },
                },
                items: [],
                learning_groups: [],
                role_options: [],
                sounds: [],
                topic_options: [],
                tools: [],
            }),
        });
    });

    await page.goto(`/settings?panel=admin-world-builder&map=${mapId}`);
    await expect(page.getByText('Localized map', { exact: true })).toBeVisible();
    await expect(page.getByText('Localized missing description.')).toBeVisible();
    await expect(page.getByText('Localized slug')).toBeVisible();
    await expect(page.getByText('Localized tiles')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit localized map details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configure localized map visuals' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add localized map tile' })).toBeVisible();
    await expect(page.getByText('Localized MapAssets')).toBeVisible();
    await expect(page.getByText('Localized 1 activity awaiting review')).toBeVisible();
    await expect(page.getByText('Localized hex 2 / -1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit localized tile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place localized tile' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete localized map' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete localized world map?' });
    await expect(dialog.getByText('Localized final deletion guidance.')).toBeVisible();
    await expect(dialog.getByText('Localized 1 tile deletion.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel localized deletion' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Delete localized world map' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});
