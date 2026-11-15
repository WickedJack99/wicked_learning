import { expect, test } from './authenticated';

test('World Builder normal Graph workspace retains the pinned-main composition at desktop and narrow viewports', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-admin@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.world_builder.review.current':
                        'Localized reviews current',
                    'settings.world_builder.world.export':
                        'Localized export world',
                },
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                maps: [
                    {
                        access_roles: [],
                        description: 'A map used to check the source graph layout.',
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                        node_count: 1,
                        nodes: [
                            {
                                activity_review_count: 0,
                                description: 'Mocked MapAsset description',
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                                position: { q: 0, r: 0 },
                                slug: 'mocked-map-asset',
                                state: 'available',
                                title: 'Mocked MapAsset',
                                unlock_diagnostics: [],
                                visual_config: {},
                            },
                        ],
                        review_count: 0,
                        slug: 'mocked-world-map',
                        title: 'Mocked current map',
                        updated_at: '2026-11-14T12:34:00Z',
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
            contentType: 'application/json',
        });
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/settings?panel=admin-world-builder');

    const workspace = page.locator(
        '[data-wl-id="authoring.world-builder.graph-workspace"]',
    );
    const graph = page.locator('[data-wl-id="authoring.world-builder.graph"]');
    const mapCard = page.locator(
        '[data-wl-id="authoring.world-builder.graph.map-card"]',
    );

    await expect(workspace).toBeVisible();
    await expect(graph).toBeVisible();
    await expect(mapCard).toContainText('Mocked current map');
    await expect(mapCard).toContainText('Localized reviews current');
    await expect(
        page.getByRole('heading', { name: 'Select a map or portal' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Click a world-map node to edit it, or click a portal edge to see the connected portal activities.',
        ),
    ).toBeVisible();
    await expect(page.getByText('Prepare', { exact: true })).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'New world map' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Create a standalone map now and connect it with portal tiles later.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Create world node' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Localized export world' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Portal routes' }),
    ).toBeVisible();
    await expect(
        page.getByText('Source catalog', { exact: true }),
    ).toHaveCount(0);
    await expect(workspace.locator('summary')).toHaveCount(0);
    await expect(
        page.getByRole('status', { name: 'Preparing graph view' }),
    ).toBeHidden();

    const graphBounds = await graph.boundingBox();
    const mapBounds = await mapCard.boundingBox();
    expect(graphBounds).not.toBeNull();
    expect(mapBounds).not.toBeNull();
    expect(graphBounds!.width).toBeGreaterThan(360);
    expect(mapBounds!.x).toBeGreaterThanOrEqual(graphBounds!.x);
    expect(mapBounds!.x + mapBounds!.width).toBeLessThanOrEqual(
        graphBounds!.x + graphBounds!.width,
    );
    expect(mapBounds!.y).toBeGreaterThanOrEqual(graphBounds!.y);
    expect(mapBounds!.y + mapBounds!.height).toBeLessThanOrEqual(
        graphBounds!.y + graphBounds!.height,
    );

    await page.setViewportSize({ height: 844, width: 390 });
    await workspace.scrollIntoViewIfNeeded();
    await expect(workspace).toBeVisible();
    await expect(graph).toBeVisible();
    await expect(mapCard).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'New world map' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Portal routes' }),
    ).toBeVisible();

    const narrowWorkspaceBounds = await workspace.boundingBox();
    const narrowGraphBounds = await graph.boundingBox();
    const narrowMapBounds = await mapCard.boundingBox();
    expect(narrowWorkspaceBounds).not.toBeNull();
    expect(narrowGraphBounds).not.toBeNull();
    expect(narrowMapBounds).not.toBeNull();
    expect(narrowWorkspaceBounds!.x).toBeGreaterThanOrEqual(0);
    expect(
        narrowWorkspaceBounds!.x + narrowWorkspaceBounds!.width,
    ).toBeLessThanOrEqual(390);
    expect(narrowGraphBounds!.x).toBeGreaterThanOrEqual(0);
    expect(narrowGraphBounds!.x + narrowGraphBounds!.width).toBeLessThanOrEqual(
        390,
    );
    expect(narrowMapBounds!.x).toBeGreaterThanOrEqual(narrowGraphBounds!.x);
    expect(
        narrowMapBounds!.x + narrowMapBounds!.width,
    ).toBeLessThanOrEqual(narrowGraphBounds!.x + narrowGraphBounds!.width);
});
