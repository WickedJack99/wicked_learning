import { expect, test } from './authenticated';

test('World Builder localizes source-shaped graph map cards without changing their overview data', async ({
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
                    'settings.world_builder.graph.tile_count_many': 'Localized :count tiles',
                    'settings.world_builder.activity_graph.portal': 'Localized portal fallback',
                    'settings.world_builder.review.current': 'Localized reviews current',
                    'settings.world_builder.review.waiting_many': 'Localized :count activities awaiting review',
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
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                        node_count: 2,
                        review_count: 2,
                        title: 'Mocked reviewed map',
                    },
                    {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                        node_count: 1,
                        review_count: 0,
                        title: 'Mocked current map',
                    },
                ],
                portal_candidates: [],
                portal_links: [
                    {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9e',
                        label: null,
                        source_map_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                        target_map_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                    },
                ],
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

    await page.goto('/settings?panel=admin-world-builder');
    await expect(page.getByText('Mocked reviewed map')).toBeVisible();
    await expect(page.getByText('Localized 2 tiles')).toBeVisible();
    await expect(
        page.getByText('Localized 2 activities awaiting review'),
    ).toBeVisible();
    await expect(page.getByText('Mocked current map')).toBeVisible();
    await expect(page.getByText('Localized 1 tile')).toBeVisible();
    await expect(page.getByText('Localized reviews current')).toBeVisible();
    await expect(page.getByText('Localized portal fallback')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const reviewedCard = page.getByText('Mocked reviewed map').locator('..');
    await reviewedCard.scrollIntoViewIfNeeded();
    await expect(reviewedCard).toBeVisible();
    const bounds = await reviewedCard.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});
