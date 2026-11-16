import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const unavailableCopy =
    'World builder settings are not available with the current permissions.';
const viewports = [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
];

async function installAuthorRoutes(page: Page, settingsAccess = {
    world_activities: true,
    world_maps: true,
    world_nodes: true,
}) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-admin@example.test',
                roles: ['administrator'],
                settings_access: settingsAccess,
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
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
}

async function expectUnavailableAtBothViewports(page: Page) {
    const unavailable = page.getByText(unavailableCopy, { exact: true });

    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await expect(unavailable).toBeVisible();
        const bounds = await unavailable.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }
}

function selectedNodeGraphResponse() {
    return {
        maps: [
            {
                access_roles: [],
                description: 'A map with a selected activity graph.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                node_count: 1,
                nodes: [
                    {
                        activity_review_count: 0,
                        description: 'A MapAsset with a selected activity graph.',
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                        position: { q: 0, r: 0 },
                        slug: 'selected-map-asset',
                        state: 'available',
                        title: 'Selected MapAsset',
                        unlock_diagnostics: [],
                        visual_config: {},
                    },
                ],
                review_count: 0,
                slug: 'selected-map',
                title: 'Selected map',
                updated_at: '2026-11-15T12:34:00Z',
            },
        ],
        portal_candidates: [],
        portal_links: [],
        world: {
            description: null,
            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
            slug: 'mocked-world',
            title: 'Mocked World',
            updated_at: '2026-11-15T12:34:00Z',
        },
    };
}

async function installSelectedNodeGraphRoutes(page: Page) {
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            body: JSON.stringify(selectedNodeGraphResponse()),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/admin/world-builder/maps/*', async (route) => {
        await route.fulfill({
            status: 503,
        });
    });
}

const selectedNodeUrl =
    '/settings?panel=admin-world-builder&map=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b&node=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c';

test('World Builder keeps the pinned-source unavailable panel while its Rust graph read is loading', async ({
    page,
}) => {
    await installAuthorRoutes(page);
    let releaseGraph: (() => void) | undefined;
    const graphRequest = new Promise<void>((resolve) => {
        releaseGraph = resolve;
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await graphRequest;
        await route.fulfill({
            body: JSON.stringify({
                maps: [],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: null,
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-15T12:34:00Z',
                },
            }),
            contentType: 'application/json',
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    await expectUnavailableAtBothViewports(page);
    releaseGraph?.();
    await expect(page.getByText(unavailableCopy, { exact: true })).toHaveCount(0);
    await expect(
        page.getByRole('heading', { name: 'Select a map or portal' }),
    ).toBeVisible();
});

for (const unavailableResponse of [
    { label: 'unauthenticated', status: 401 },
    { label: 'forbidden', status: 403 },
    { label: 'not found', status: 404 },
    { label: 'service unavailable', status: 503 },
]) {
    test(`World Builder keeps the pinned-source unavailable panel for a Rust ${unavailableResponse.label} graph response`, async ({
        page,
    }) => {
        await installAuthorRoutes(page);
        await page.route('**/api/v1/admin/world-builder', async (route) => {
            await route.fulfill({
                body: JSON.stringify({ code: 'world_builder_unavailable' }),
                contentType: 'application/problem+json',
                status: unavailableResponse.status,
            });
        });

        await page.goto('/settings?panel=admin-world-builder');
        await expectUnavailableAtBothViewports(page);
    });
}

test('World Builder keeps the pinned-source unavailable panel for a Rust graph network failure and no permitted section', async ({
    page,
}) => {
    await installAuthorRoutes(page);
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.abort('failed');
    });

    await page.goto('/settings?panel=admin-world-builder');
    await expectUnavailableAtBothViewports(page);

    await page.unroute('**/api/v1/admin/world-builder');
    await page.unroute('**/api/v1/me');
    await installAuthorRoutes(page, {});
    await page.goto('/settings?panel=admin-world-builder');
    await expectUnavailableAtBothViewports(page);
});

test('World Builder keeps the pinned-source unavailable panel while a selected-node Rust read is pending', async ({
    page,
}) => {
    await installAuthorRoutes(page);
    await installSelectedNodeGraphRoutes(page);
    let releaseNode: (() => void) | undefined;
    const nodeRequest = new Promise<void>((resolve) => {
        releaseNode = resolve;
    });
    await page.route('**/api/v1/admin/world-builder/nodes/*', async (route) => {
        await nodeRequest;
        await route.fulfill({ status: 503 });
    });

    await page.goto(selectedNodeUrl, { waitUntil: 'domcontentloaded' });
    await expectUnavailableAtBothViewports(page);
    releaseNode?.();
});

for (const unavailableResponse of [401, 403, 404, 503]) {
    test(`World Builder keeps the pinned-source unavailable panel for a selected-node Rust ${unavailableResponse} response`, async ({
        page,
    }) => {
        await installAuthorRoutes(page);
        await installSelectedNodeGraphRoutes(page);
        await page.route(
            '**/api/v1/admin/world-builder/nodes/*',
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify({ code: 'selected_node_unavailable' }),
                    contentType: 'application/problem+json',
                    status: unavailableResponse,
                });
            },
        );

        await page.goto(selectedNodeUrl);
        await expectUnavailableAtBothViewports(page);
    });
}

test('World Builder keeps the pinned-source unavailable panel for a selected-node Rust network failure', async ({
    page,
}) => {
    await installAuthorRoutes(page);
    await installSelectedNodeGraphRoutes(page);
    await page.route('**/api/v1/admin/world-builder/nodes/*', async (route) => {
        await route.abort('failed');
    });

    await page.goto(selectedNodeUrl);
    await expectUnavailableAtBothViewports(page);
});
