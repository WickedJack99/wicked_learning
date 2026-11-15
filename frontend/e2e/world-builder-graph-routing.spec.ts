import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    alphaActivity: '00000000-0000-4000-8000-000000000012',
    alphaMap: '00000000-0000-4000-8000-000000000010',
    alphaNode: '00000000-0000-4000-8000-000000000011',
    betaActivity: '00000000-0000-4000-8000-000000000022',
    betaMap: '00000000-0000-4000-8000-000000000020',
    betaNode: '00000000-0000-4000-8000-000000000021',
    gammaActivity: '00000000-0000-4000-8000-000000000042',
    gammaMap: '00000000-0000-4000-8000-000000000040',
    gammaNode: '00000000-0000-4000-8000-000000000041',
    parallelA: '00000000-0000-4000-8000-000000000030',
    parallelB: '00000000-0000-4000-8000-000000000031',
    self: '00000000-0000-4000-8000-000000000032',
    single: '00000000-0000-4000-8000-000000000033',
};

function node(id: string, slug: string, title: string) {
    return {
        activity_review_count: 0,
        description: `${title} description`,
        id,
        position: { q: 0, r: 0 },
        slug,
        state: 'available',
        title,
        unlock_diagnostics: [],
        visual_config: {},
    };
}

const alphaNode = node(ids.alphaNode, 'alpha-node', 'Alpha node');
const betaNode = node(ids.betaNode, 'beta-node', 'Beta node');
const gammaNode = node(ids.gammaNode, 'gamma-node', 'Gamma node');

function map(id: string, slug: string, title: string, nodes: object[]) {
    return {
        access_roles: [],
        description: `${title} description`,
        id,
        node_count: nodes.length,
        nodes,
        review_count: 0,
        slug,
        title,
        updated_at: '2026-11-15T12:34:00Z',
    };
}

function portal({
    id,
    label,
    sourceActivity,
    sourceMapId,
    sourceNode,
    targetActivity,
    targetMapId,
    targetNode,
}: {
    id: string;
    label: string;
    sourceActivity: { id: string; title: string };
    sourceMapId: string;
    sourceNode: object;
    targetActivity: { id: string; title: string };
    targetMapId: string;
    targetNode: object;
}) {
    return {
        description: `${label} description`,
        id,
        label,
        source_activity: {
            ...sourceActivity,
            activity_type: 'portal',
        },
        source_map_id: sourceMapId,
        source_node: sourceNode,
        target_activity: {
            ...targetActivity,
            activity_type: 'portal',
        },
        target_map_id: targetMapId,
        target_node: targetNode,
    };
}

function graphResponse({
    maps = [],
    portalLinks = [],
}: {
    maps?: object[];
    portalLinks?: object[];
}) {
    return {
        maps,
        portal_candidates: [],
        portal_links: portalLinks,
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

test('the lifted Graph keeps the source no-map canvas empty at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page, graphResponse({}));

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        await page.setViewportSize(viewport);
        await page.goto('/settings?panel=admin-world-builder');

        const graph = page.locator(
            '[data-wl-id="authoring.world-builder.graph"]',
        );
        await expect(graph).toBeVisible();
        await expect(
            graph.locator('[data-wl-id="authoring.world-builder.graph.map-card"]'),
        ).toHaveCount(0);
        await expect(
            graph.getByRole('status', { name: 'Preparing graph view' }),
        ).toHaveCount(0);

        const bounds = await graph.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    }
});

test('the lifted Graph retains source routes and fit/loading behavior at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(
        page,
        graphResponse({
            maps: [
                map(ids.alphaMap, 'alpha-map', 'Alpha map', [alphaNode]),
                map(ids.betaMap, 'beta-map', 'Beta map', [betaNode]),
                map(ids.gammaMap, 'gamma-map', 'Gamma map', [gammaNode]),
            ],
            portalLinks: [
                portal({
                    id: ids.parallelA,
                    label: 'First crossing',
                    sourceActivity: {
                        id: ids.alphaActivity,
                        title: 'Enter Alpha',
                    },
                    sourceMapId: ids.alphaMap,
                    sourceNode: alphaNode,
                    targetActivity: {
                        id: ids.betaActivity,
                        title: 'Exit Beta',
                    },
                    targetMapId: ids.betaMap,
                    targetNode: betaNode,
                }),
                portal({
                    id: ids.parallelB,
                    label: 'Second crossing',
                    sourceActivity: {
                        id: ids.alphaActivity,
                        title: 'Enter Alpha again',
                    },
                    sourceMapId: ids.alphaMap,
                    sourceNode: alphaNode,
                    targetActivity: {
                        id: ids.betaActivity,
                        title: 'Exit Beta again',
                    },
                    targetMapId: ids.betaMap,
                    targetNode: betaNode,
                }),
                portal({
                    id: ids.self,
                    label: 'Return loop',
                    sourceActivity: {
                        id: ids.alphaActivity,
                        title: 'Return Alpha',
                    },
                    sourceMapId: ids.alphaMap,
                    sourceNode: alphaNode,
                    targetActivity: {
                        id: ids.alphaActivity,
                        title: 'Restart Alpha',
                    },
                    targetMapId: ids.alphaMap,
                    targetNode: alphaNode,
                }),
                portal({
                    id: ids.single,
                    label: 'Journey onward',
                    sourceActivity: {
                        id: ids.betaActivity,
                        title: 'Leave Beta',
                    },
                    sourceMapId: ids.betaMap,
                    sourceNode: betaNode,
                    targetActivity: {
                        id: ids.gammaActivity,
                        title: 'Arrive Gamma',
                    },
                    targetMapId: ids.gammaMap,
                    targetNode: gammaNode,
                }),
            ],
        }),
    );

    for (const viewport of [
        { height: 900, width: 1440 },
        { height: 844, width: 390 },
    ]) {
        await page.setViewportSize(viewport);
        await page.goto('/settings?panel=admin-world-builder', {
            waitUntil: 'commit',
        });

        const graph = page.locator(
            '[data-wl-id="authoring.world-builder.graph"]',
        );
        const loading = graph.getByRole('status', {
            name: 'Preparing graph view',
        });
        await expect(loading).toBeAttached();
        await expect(loading).toBeHidden();

        const mapCards = graph.locator(
            '[data-wl-id="authoring.world-builder.graph.map-card"]',
        );
        const edges = graph.locator('.react-flow__edge');
        await expect(mapCards).toHaveCount(3);
        await expect(edges).toHaveCount(4);
        await expect(page.getByText('First crossing', { exact: true })).toBeVisible();
        await expect(page.getByText('Second crossing', { exact: true })).toBeVisible();
        await expect(page.getByText('Return loop', { exact: true })).toBeVisible();
        await expect(page.getByText('Journey onward', { exact: true })).toBeVisible();

        const firstParallelPath = graph.locator(
            `.react-flow__edge[data-id$="${ids.parallelA}"] .react-flow__edge-path`,
        );
        const secondParallelPath = graph.locator(
            `.react-flow__edge[data-id$="${ids.parallelB}"] .react-flow__edge-path`,
        );
        const selfPath = graph.locator(
            `.react-flow__edge[data-id$="${ids.self}"] .react-flow__edge-path`,
        );
        const singlePath = graph.locator(
            `.react-flow__edge[data-id$="${ids.single}"] .react-flow__edge-path`,
        );
        await expect(firstParallelPath).toHaveCount(1);
        await expect(secondParallelPath).toHaveCount(1);
        await expect(selfPath).toHaveCount(1);
        await expect(singlePath).toHaveCount(1);
        expect(await firstParallelPath.getAttribute('d')).not.toBe(
            await secondParallelPath.getAttribute('d'),
        );
        expect(await selfPath.getAttribute('d')).not.toBeNull();
        expect(await singlePath.getAttribute('d')).not.toBeNull();

        const graphBounds = await graph.boundingBox();
        expect(graphBounds).not.toBeNull();
        for (const mapCard of await mapCards.all()) {
            const mapCardBounds = await mapCard.boundingBox();
            expect(mapCardBounds).not.toBeNull();
            expect(mapCardBounds!.x).toBeGreaterThanOrEqual(graphBounds!.x);
            expect(mapCardBounds!.x + mapCardBounds!.width).toBeLessThanOrEqual(
                graphBounds!.x + graphBounds!.width,
            );
            if (viewport.width === 1440) {
                expect(mapCardBounds!.y).toBeGreaterThanOrEqual(graphBounds!.y);
                expect(
                    mapCardBounds!.y + mapCardBounds!.height,
                ).toBeLessThanOrEqual(graphBounds!.y + graphBounds!.height);
            }
        }
    }
});
