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
                    'settings.world_builder.graph_inspector.empty.title': 'Localized graph inspector',
                    'settings.world_builder.graph_inspector.empty.description': 'Localized graph-inspector guidance.',
                    'settings.world_builder.graph_inspector.portal.eyebrow': 'Localized portal link',
                    'settings.world_builder.graph_inspector.portal.unnamed': 'Localized unnamed portal',
                    'settings.world_builder.graph_inspector.portal.empty_description': 'Localized portal guidance.',
                    'settings.world_builder.graph_inspector.portal.source': 'Localized source',
                    'settings.world_builder.graph_inspector.portal.target': 'Localized target',
                    'settings.world_builder.graph_inspector.portal.open_source_activity_graph': 'Open localized source activity graph',
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
                        description: null,
                        source_map_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                        source_node: {
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9f',
                            title: 'Mocked source node',
                        },
                        source_activity: null,
                        target_map_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                        target_node: {
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da0',
                            title: 'Mocked target node',
                        },
                        target_activity: null,
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
    await expect(page.getByText('Localized graph inspector')).toBeVisible();
    await expect(
        page.getByText('Localized graph-inspector guidance.'),
    ).toBeVisible();

    await page.locator('.react-flow__edge').first().dispatchEvent('click');
    await expect(page.getByText('Localized portal link')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Localized unnamed portal' })).toBeVisible();
    await expect(page.getByText('Localized portal guidance.')).toBeVisible();
    await expect(page.getByText('Localized source', { exact: true })).toBeVisible();
    await expect(page.getByText('Localized target', { exact: true })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Open localized source activity graph' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const inspector = page.getByText('Localized portal link').locator('..');
    await inspector.scrollIntoViewIfNeeded();
    await expect(inspector).toBeVisible();
    const bounds = await inspector.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});
