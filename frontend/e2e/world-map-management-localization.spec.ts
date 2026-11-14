import { expect, test } from './authenticated';

test('World Builder localizes the source-shaped structural map management workspace', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-admin@example.test',
                roles: ['administrator'],
                settings_access: { world_activities: true, world_maps: true, world_nodes: true },
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
                    'settings.world_builder.graph.tile_count_one': 'Localized :count tile',
                    'settings.world_builder.map_management.title': 'Localized world maps',
                    'settings.world_builder.map_management.review_one': 'Localized :count activity needs review',
                    'settings.world_builder.map_management.selected_map': 'Localized selected map',
                    'settings.world_builder.map_management.no_description': 'Localized no map description.',
                    'settings.world_builder.map_management.configuration': 'Localized map configuration',
                    'settings.world_builder.map_management.configuration_description': 'Localized map configuration guidance.',
                    'settings.world_builder.map_management.map_assets': 'Localized MapAssets',
                    'settings.world_builder.map_management.selection_guidance': 'Localized MapAsset selection guidance.',
                    'settings.world_builder.map_management.configure': 'Configure localized map',
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
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                        node_count: 1,
                        nodes: [
                            {
                                activity_review_count: 1,
                                description: 'Mocked MapAsset description',
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                                slug: 'mocked-map-asset',
                                title: 'Mocked MapAsset',
                            },
                        ],
                        review_count: 1,
                        title: 'Mocked structural map',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9d',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder&worldSection=structural');
    await expect(page.getByText('Localized world maps')).toBeVisible();
    await expect(page.getByText('Localized 1 tile')).toBeVisible();
    await expect(page.getByText('Localized 1 activity needs review')).toHaveCount(2);
    await expect(page.getByText('Localized selected map')).toBeVisible();
    await expect(page.getByText('Localized no map description.')).toBeVisible();
    await expect(
        page.getByText('Localized map configuration', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Localized map configuration guidance.')).toBeVisible();
    await expect(page.getByText('Localized MapAssets')).toBeVisible();
    await expect(page.getByText('Mocked MapAsset', { exact: true })).toBeVisible();
    await expect(page.getByText('Localized MapAsset selection guidance.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configure localized map' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const guidance = page.getByText('Localized MapAsset selection guidance.');
    await guidance.scrollIntoViewIfNeeded();
    await expect(guidance).toBeVisible();
    const bounds = await guidance.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});
