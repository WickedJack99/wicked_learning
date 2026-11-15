import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const mapId = '00000000-0000-4000-8000-000000000010';

function node(index: number, activityReviewCount = 0) {
    return {
        activity_review_count: activityReviewCount,
        description: `Review node ${index} description`,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        position: { q: index, r: 0 },
        slug: `review-node-${index}`,
        state: 'available',
        title: `Review node ${index}`,
        unlock_diagnostics: [],
        visual_config: {},
    };
}

function graphResponse({
    nodes,
    reviewCount,
}: {
    nodes: ReturnType<typeof node>[];
    reviewCount: number;
}) {
    return {
        maps: [
            {
                access_roles: [],
                description: 'A source-derived map inspector fixture.',
                id: mapId,
                node_count: nodes.length,
                nodes,
                review_count: reviewCount,
                slug: 'source-map',
                title: 'Source map',
                updated_at: '2026-11-15T12:34:00Z',
            },
        ],
        portal_candidates: [],
        portal_links: [],
        world: {
            description: 'A mocked authoring world.',
            id: '00000000-0000-4000-8000-000000000001',
            slug: 'mocked-world',
            title: 'Mocked World',
            updated_at: '2026-11-15T12:34:00Z',
        },
    };
}

async function installWorldBuilderRoutes(
    page: Page,
    graph: ReturnType<typeof graphResponse>,
) {
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
                subject_id: '00000000-0000-4000-8000-000000000002',
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ locale: 'test', translations: {} }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            body: JSON.stringify(graph),
            contentType: 'application/json',
        });
    });
}

async function selectMap(
    page: Page,
    viewport: { height: number; width: number },
) {
    await page.setViewportSize(viewport);
    await page.goto('/settings?panel=admin-world-builder');
    await page
        .locator('.react-flow__node')
        .click();

    const inspector = page.locator(
        '[data-wl-id="authoring.world-builder.graph.map-inspector"]',
    );

    await assertInspectorBounds(inspector, viewport);

    return inspector;
}

async function assertInspectorBounds(
    inspector: ReturnType<Page['locator']>,
    viewport: { height: number; width: number },
) {
    await inspector.scrollIntoViewIfNeeded();
    await expect(inspector).toBeVisible();

    const bounds = await inspector.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
}

test('the lifted selected-map inspector preserves the source current-review state at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(
        page,
        graphResponse({ nodes: [node(1)], reviewCount: 0 }),
    );

    const inspector = await selectMap(page, { height: 900, width: 1440 });

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        if (viewport.width !== 1440) {
            await page.setViewportSize(viewport);
            await assertInspectorBounds(inspector, viewport);
        }

        await expect(inspector.getByText('Source map', { exact: true })).toBeVisible();
        await expect(
            inspector.getByText('A source-derived map inspector fixture.'),
        ).toBeVisible();
        await expect(inspector.getByText('Slug', { exact: true })).toBeVisible();
        await expect(inspector.getByText('source-map', { exact: true })).toBeVisible();
        await expect(inspector.getByText('Tiles', { exact: true })).toBeVisible();
        await expect(inspector.getByText('1', { exact: true })).toBeVisible();
        await expect(
            inspector.getByText('No activities are waiting for AI review.'),
        ).toBeVisible();

        await expect(
            inspector.getByRole('link', { name: 'Configure MapAssets' }),
        ).toHaveAttribute(
            'href',
            `/settings?panel=admin-world-builder&worldSection=graph&map=${mapId}&worldView=nodes`,
        );
        await expect(
            inspector.getByRole('link', { name: 'Configure map', exact: true }),
        ).toHaveAttribute(
            'href',
            `/settings?panel=admin-world-builder&worldSection=graph&map=${mapId}&worldView=configure`,
        );
        await expect(
            inspector.getByRole('link', { name: 'Export map', exact: true }),
        ).toHaveAttribute(
            'href',
            `/api/v1/admin/world-builder/maps/${mapId}/export`,
        );
        await expect(
            inspector.getByRole('link', { name: 'Export map with media' }),
        ).toHaveAttribute(
            'href',
            `/api/v1/admin/world-builder/maps/${mapId}/export-package`,
        );
        await expect(
            inspector.getByRole('button', { name: 'Duplicate map' }),
        ).toBeVisible();
    }
});

test('the lifted selected-map inspector paginates source review nodes and exposes the Rust duplicate failure', async ({
    page,
}) => {
    await installWorldBuilderRoutes(
        page,
        graphResponse({
            nodes: [node(1, 1), node(2, 1), node(3, 1), node(4, 1), node(5, 1), node(6, 1)],
            reviewCount: 6,
        }),
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'map-details-test-csrf-token' }),
            contentType: 'application/json',
        });
    });
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}/duplicate`,
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    code: 'invalid_request',
                    title: 'The request is not valid.',
                }),
                contentType: 'application/json',
                status: 400,
            });
        },
    );

    const inspector = await selectMap(page, { height: 900, width: 1440 });

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        if (viewport.width !== 1440) {
            await page.setViewportSize(viewport);
            await assertInspectorBounds(inspector, viewport);
        }

        await expect(
            inspector.getByText(
                '6 activities need AI review before the next authoring pass.',
            ),
        ).toBeVisible();
        await expect(
            inspector.getByRole('link', { name: 'Open review queue' }),
        ).toBeVisible();
        if (viewport.width === 1440) {
            await expect(
                inspector.getByText('Review node 1', { exact: true }),
            ).toBeVisible();
            await expect(
                inspector.getByText('Review node 5', { exact: true }),
            ).toBeVisible();
            await expect(
                inspector.getByText('Review node 6', { exact: true }),
            ).toHaveCount(0);

            await inspector
                .getByRole('button', { name: 'Next items' })
                .click();
            await expect(
                inspector.getByText('Review node 6', { exact: true }),
            ).toBeVisible();
        } else {
            await expect(
                inspector.getByRole('button', { name: 'Previous items' }),
            ).toBeVisible();
        }

        await inspector.getByRole('button', { name: 'Duplicate map' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Duplicate map' }).click();
        await expect(
            dialog.getByText(
                'The map could not be duplicated. Refresh the World Builder and try again.',
            ),
        ).toBeVisible();
        await dialog.getByRole('button', { name: 'Close' }).click();
    }
});
