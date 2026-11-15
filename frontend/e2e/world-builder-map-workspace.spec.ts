import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    map: '00000000-0000-4000-8000-000000000010',
    world: '00000000-0000-4000-8000-000000000001',
};

const graph = {
    maps: [
        {
            access_roles: [],
            description: 'A map opened through the source Graph workspace.',
            id: ids.map,
            node_count: 0,
            nodes: [],
            review_count: 0,
            slug: 'source-map',
            title: 'Source map',
            updated_at: '2026-11-15T12:34:00Z',
        },
    ],
    portal_candidates: [],
    portal_links: [],
    world: {
        description: 'A mocked authoring world.',
        id: ids.world,
        slug: 'mocked-world',
        title: 'Mocked World',
        updated_at: '2026-11-15T12:34:00Z',
    },
};

const editableMap = {
    access_groups: [],
    can_delete_world_maps: false,
    can_manage_map_access: false,
    editable_map: {
        map: {
            access_roles: [],
            background_config: {},
            description: 'A map opened through the source Graph workspace.',
            editing_group_ids: [],
            grid_config: {},
            id: ids.map,
            map_assets: [],
            map_assets_locked: false,
            node_count: 0,
            nodes: [],
            review_count: 0,
            slug: 'source-map',
            title: 'Source map',
            topic_id: null,
            updated_at: '2026-11-15T12:34:00Z',
        },
        world: graph.world,
    },
    items: [],
    learning_groups: [],
    role_options: [],
    sounds: [],
    tools: [],
    topic_options: [],
};

async function installWorldBuilderRoutes(page: Page) {
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
    await page.route(
        `**/api/v1/admin/world-builder/maps/${ids.map}`,
        async (route) => {
            await route.fulfill({
                body: JSON.stringify(editableMap),
                contentType: 'application/json',
            });
        },
    );
}

async function expectBoundedWorkspace(
    page: Page,
    viewport: { height: number; width: number },
) {
    const workspace = page.locator(
        '[data-wl-id="authoring.world-builder.map-workspace"]',
    );
    await expect(workspace).toBeVisible();
    const bounds = await workspace.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);

    return workspace;
}

test('the lifted source Graph map workspace retains its two-view navigator and Rust content slots at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(
        `/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&worldView=nodes`,
    );

    const workspace = await expectBoundedWorkspace(page, {
        height: 900,
        width: 1440,
    });
    await expect(workspace.getByText('Source map', { exact: true })).toBeVisible();
    await expect(
        workspace.getByRole('button', { name: /Configure MapAssets/ }),
    ).toBeVisible();
    await expect(
        workspace.getByText('Edit MapAssets, placement and connected activities.'),
    ).toBeVisible();
    await expect(
        workspace.getByRole('button', { name: /Configure map/ }),
    ).toBeVisible();
    await expect(
        workspace.getByText('Edit map details, visuals and access.'),
    ).toBeVisible();
    await expect(
        workspace.getByText('MapAsset surface', { exact: true }),
    ).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await expectBoundedWorkspace(page, { height: 844, width: 390 });
    await expect(
        workspace.getByRole('button', { name: /Configure MapAssets/ }),
    ).toBeVisible();
    await expect(
        workspace.getByRole('button', { name: /Configure map/ }),
    ).toBeVisible();

    await workspace.getByRole('button', { name: /Configure map/ }).click();
    await expect(page).toHaveURL(
        new RegExp(
            `worldSection=graph&map=${ids.map}&worldView=configure`,
        ),
    );
    await expect(
        workspace.getByRole('button', { name: /Configure map/ }),
    ).toBeVisible();

    await workspace.getByRole('button', { name: /Configure MapAssets/ }).click();
    await expect(page).toHaveURL(
        new RegExp(`worldSection=graph&map=${ids.map}&worldView=nodes`),
    );
});
