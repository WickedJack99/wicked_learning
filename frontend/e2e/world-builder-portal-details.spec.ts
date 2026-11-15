import type { Locator, Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    portal: '00000000-0000-4000-8000-000000000030',
    sourceActivity: '00000000-0000-4000-8000-000000000012',
    sourceMap: '00000000-0000-4000-8000-000000000010',
    sourceNode: '00000000-0000-4000-8000-000000000011',
    targetActivity: '00000000-0000-4000-8000-000000000022',
    targetMap: '00000000-0000-4000-8000-000000000020',
    targetNode: '00000000-0000-4000-8000-000000000021',
};

function node({
    description,
    id,
    slug,
    title,
}: {
    description: string | null;
    id: string;
    slug: string;
    title: string;
}) {
    return {
        activity_review_count: 0,
        description,
        id,
        position: { q: 0, r: 0 },
        slug,
        state: 'available',
        title,
        unlock_diagnostics: [],
        visual_config: {},
    };
}

const sourceNode = node({
    description: 'Source endpoint description.',
    id: ids.sourceNode,
    slug: 'source-endpoint',
    title: 'Source endpoint',
});
const targetNode = node({
    description: 'Target endpoint description.',
    id: ids.targetNode,
    slug: 'target-endpoint',
    title: 'Target endpoint',
});

function map(id: string, title: string, nodes: object[]) {
    return {
        access_roles: [],
        description: `${title} description`,
        id,
        node_count: nodes.length,
        nodes,
        review_count: 0,
        slug: title.toLowerCase().replaceAll(' ', '-'),
        title,
        updated_at: '2026-11-15T12:34:00Z',
    };
}

function graphResponse({
    description = 'A source-derived portal description.',
    label = 'Door to the target',
    sourceActivity = {
        activity_type: 'portal',
        id: ids.sourceActivity,
        title: 'Crossing source activity',
    },
    targetActivity = {
        activity_type: 'markdown',
        id: ids.targetActivity,
        title: 'Arrival activity',
    },
}: {
    description?: string | null;
    label?: string | null;
    sourceActivity?: object | null;
    targetActivity?: object | null;
} = {}) {
    return {
        maps: [
            map(ids.sourceMap, 'Source map', [sourceNode]),
            map(ids.targetMap, 'Target map', [targetNode]),
        ],
        portal_candidates: [],
        portal_links: [
            {
                description,
                id: ids.portal,
                label,
                source_activity: sourceActivity,
                source_map_id: ids.sourceMap,
                source_node: sourceNode,
                target_activity: targetActivity,
                target_map_id: ids.targetMap,
                target_node: targetNode,
            },
        ],
        world: {
            description: 'A mocked authoring world.',
            id: '00000000-0000-4000-8000-000000000001',
            slug: 'mocked-world',
            title: 'Mocked World',
            updated_at: '2026-11-15T12:34:00Z',
        },
    };
}

async function installWorldBuilderRoutes(page: Page, graph: object) {
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

async function selectPortal(page: Page): Promise<Locator> {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/settings?panel=admin-world-builder');
    await page
        .getByRole('group', {
            name: `Edge from ${ids.sourceMap} to ${ids.targetMap}`,
        })
        .click();

    const inspector = page.locator(
        '[data-wl-id="authoring.world-builder.graph.portal-inspector"]',
    );
    await assertInspectorBounds(inspector, { height: 900, width: 1440 });

    return inspector;
}

async function assertInspectorBounds(
    inspector: Locator,
    viewport: { height: number; width: number },
) {
    await inspector.scrollIntoViewIfNeeded();
    await expect(inspector).toBeVisible();

    const bounds = await inspector.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
}

test('the lifted selected-portal inspector preserves source endpoint details and its conditional source-activity destination', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page, graphResponse());

    const inspector = await selectPortal(page);

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        if (viewport.width !== 1440) {
            await page.setViewportSize(viewport);
            await assertInspectorBounds(inspector, viewport);
        }

        await expect(
            inspector.getByText('Portal link', { exact: true }),
        ).toBeVisible();
        await expect(
            inspector.getByRole('heading', { name: 'Door to the target' }),
        ).toBeVisible();
        await expect(
            inspector.getByText('A source-derived portal description.'),
        ).toBeVisible();
        await expect(inspector.getByText('From', { exact: true })).toBeVisible();
        await expect(inspector.getByText('To', { exact: true })).toBeVisible();
        await expect(
            inspector.getByText('Source endpoint', { exact: true }),
        ).toBeVisible();
        await expect(
            inspector.getByText('Crossing source activity', { exact: true }),
        ).toBeVisible();
        await expect(
            inspector.getByText('Source endpoint description.'),
        ).toBeVisible();
        await expect(
            inspector.getByText('Target endpoint', { exact: true }),
        ).toBeVisible();
        await expect(
            inspector.getByText('Arrival activity', { exact: true }),
        ).toBeVisible();
        await expect(
            inspector.getByText('Target endpoint description.'),
        ).toBeVisible();
        await expect(
            inspector.getByRole('link', { name: 'Edit source activity' }),
        ).toHaveAttribute(
            'href',
            `/settings?panel=admin-world-builder&worldSection=graph&map=${ids.sourceMap}&node=${ids.sourceNode}&worldView=nodes`,
        );
    }

    await inspector.getByRole('link', { name: 'Edit source activity' }).click();
    await expect(page).toHaveURL(
        new RegExp(
            `worldSection=structural&map=${ids.sourceMap}&node=${ids.sourceNode}&worldView=nodes`,
        ),
    );
});

test('the lifted selected-portal inspector retains source fallbacks when the Rust graph has no source activity', async ({
    page,
}) => {
    const sourceWithoutDescription = {
        ...sourceNode,
        description: null,
    };
    const targetWithoutDescription = {
        ...targetNode,
        description: null,
    };
    const graph = graphResponse({
        description: null,
        label: null,
        sourceActivity: null,
        targetActivity: null,
    });
    graph.maps[0] = map(ids.sourceMap, 'Source map', [sourceWithoutDescription]);
    graph.maps[1] = map(ids.targetMap, 'Target map', [targetWithoutDescription]);
    graph.portal_links[0] = {
        ...graph.portal_links[0],
        source_node: sourceWithoutDescription,
        target_node: targetWithoutDescription,
    };
    await installWorldBuilderRoutes(page, graph);

    const inspector = await selectPortal(page);

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        if (viewport.width !== 1440) {
            await page.setViewportSize(viewport);
            await assertInspectorBounds(inspector, viewport);
        }

        await expect(
            inspector.getByRole('heading', { name: 'Unnamed portal' }),
        ).toBeVisible();
        await expect(
            inspector.getByText('No portal description yet.'),
        ).toBeVisible();
        await expect(inspector.getByText('source-endpoint')).toBeVisible();
        await expect(inspector.getByText('target-endpoint')).toBeVisible();
        await expect(
            inspector.getByRole('link', { name: 'Edit source activity' }),
        ).toHaveCount(0);
    }
});
