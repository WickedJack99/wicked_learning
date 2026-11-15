import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    asset: '00000000-0000-4000-8000-000000000030',
    map: '00000000-0000-4000-8000-000000000010',
    neighbor: '00000000-0000-4000-8000-000000000021',
    node: '00000000-0000-4000-8000-000000000020',
    version: '00000000-0000-4000-8000-000000000040',
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
            map_assets: [
                {
                    focusable: true,
                    id: ids.asset,
                    image_url: null,
                    interaction_config: {},
                    interaction_mode: 'focusable',
                    locked: false,
                    node_id: ids.node,
                    opacity: 1,
                    sound_config: {},
                    text: 'Source asset',
                    visual_config: {},
                    width: 14,
                    x: 50,
                    y: 50,
                    z: 0,
                },
            ],
            map_assets_locked: false,
            node_count: 0,
            nodes: [
                {
                    activity_review_count: 0,
                    description: 'A source node attached to this MapAsset.',
                    id: ids.node,
                    position: { q: 0, r: 0 },
                    slug: 'source-node',
                    state: 'available',
                    title: 'Source node',
                    unlock_diagnostics: [],
                    visual_config: {},
                },
                {
                    activity_review_count: 0,
                    description: 'The adjacent source node.',
                    id: ids.neighbor,
                    position: { q: 1, r: 0 },
                    slug: 'neighbor-node',
                    state: 'available',
                    title: 'Neighbor node',
                    unlock_diagnostics: [],
                    visual_config: {},
                },
            ],
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

const emptyEditableMap = {
    ...editableMap,
    editable_map: {
        ...editableMap.editable_map,
        map: {
            ...editableMap.editable_map.map,
            map_assets: [],
        },
    },
};

async function installWorldBuilderRoutes(
    page: Page,
    mapDocument = editableMap,
) {
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'source-map-editor-csrf' }),
            contentType: 'application/json',
        });
    });
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
                body: JSON.stringify(mapDocument),
                contentType: 'application/json',
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${ids.map}/layout-versions?*`,
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    items: [],
                    last_page: 1,
                    page: 1,
                    per_page: 6,
                    total: 0,
                }),
                contentType: 'application/json',
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/assets/${ids.asset}/versions?*`,
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    items: [],
                    last_page: 1,
                    page: 1,
                    per_page: 4,
                    total: 0,
                }),
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
    await expect(workspace.getByText('Source map', { exact: true }).first()).toBeVisible();
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
        workspace.getByRole('button', { name: 'Add Asset' }),
    ).toBeVisible();
    await expect(
        workspace.getByRole('button', { name: 'Import asset' }),
    ).toBeVisible();
    await expect(
        workspace.getByText('MapAsset surface · no dragging'),
    ).toBeVisible();
    await workspace
        .getByRole('button', { name: 'Select Source node to edit' })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Edit MapAsset' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Save MapAsset' }),
    ).toBeVisible();
    await expect(
        page.locator('#map-asset-settings-tab-activities'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(
        page.getByText(
            'No earlier MapAsset configuration yet. The first update will create one.',
        ),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    const restoredAsset = {
        created_at: '2026-11-15T12:00:00Z',
        id: ids.version,
        image_url: null,
        interaction_config: {},
        interaction_mode: 'focusable',
        locked: false,
        opacity: 1,
        position_x: 50,
        position_y: 50,
        position_z: 0,
        sound_config: {},
        text: 'Restorable Source asset',
        visual_config: {},
        width: 14,
    };
    await page.route(
        `**/api/v1/admin/world-builder/assets/${ids.asset}/versions?*`,
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    items: [restoredAsset],
                    last_page: 1,
                    page: 1,
                    per_page: 4,
                    total: 1,
                }),
                contentType: 'application/json',
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/assets/${ids.asset}/versions/${ids.version}`,
        async (route) => {
            const { created_at: _createdAt, id: _versionId, ...restoredForm } =
                restoredAsset;
            await route.fulfill({
                body: JSON.stringify({ ...restoredForm, asset_id: ids.asset }),
                contentType: 'application/json',
            });
        },
    );
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(page.getByText('Restorable Source asset')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(
                `/api/v1/admin/world-builder/assets/${ids.asset}/versions/${ids.version}`,
            ),
    );
    await page.getByRole('button', { name: 'Restore this version' }).click();
    expect((await restored).status()).toBe(200);
    await page.keyboard.press('Escape');
    await page.route(
        `**/api/v1/admin/world-builder/maps/${ids.map}/visual-media`,
        async (route) => {
            await route.fulfill({ status: 503 });
        },
    );
    const failedImageUpload = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(
                `/api/v1/admin/world-builder/maps/${ids.map}/visual-media`,
            ),
    );
    await page
        .locator(`#map-asset-image-${ids.map}-upload`)
        .setInputFiles({
            buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
            mimeType: 'image/svg+xml',
            name: 'unavailable.svg',
        });
    expect((await failedImageUpload).status()).toBe(503);
    await expect(
        page.getByText('The image could not be uploaded.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('radio', { name: 'Change state on click' }).check();
    const statePreview = page.getByRole('group', {
        name: 'Preview MapAsset state',
    });
    await expect(statePreview).toBeVisible();
    await statePreview.getByRole('button', { name: 'State 2' }).click();
    await expect(
        statePreview.getByRole('button', { name: 'State 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(
        page.getByRole('heading', { name: 'Edit MapAsset' }),
    ).toBeHidden();
    await workspace.getByRole('button', { name: 'Layout history' }).click();
    await expect(
        page.getByText(
            'No earlier placement layouts yet. Moving or swapping a node will create one.',
        ),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.route(
        `**/api/v1/admin/world-builder/maps/${ids.map}/layout-versions?*`,
        async (route) => {
            await new Promise<void>((resolve) => setTimeout(resolve, 150));
            await route.fulfill({ status: 503 });
        },
    );
    await workspace.getByRole('button', { name: 'Layout history' }).click();
    await expect(page.getByText('Loading layout history…')).toBeVisible();
    await expect(
        page.getByText(
            'Layout history could not be loaded or restored. Try again.',
        ),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ height: 844, width: 390 });
    await expectBoundedWorkspace(page, { height: 844, width: 390 });
    await expect(
        workspace.getByRole('button', { name: /Configure MapAssets/ }),
    ).toBeVisible();
    await expect(
        workspace.getByRole('button', { name: /Configure map/ }),
    ).toBeVisible();

    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(
                `/api/v1/admin/world-builder/maps/${ids.map}/assets`,
            ),
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${ids.map}/assets`,
        async (route) => {
            await route.fulfill({ status: 201 });
        },
    );
    await workspace.getByRole('button', { name: 'Add Asset' }).click();
    expect((await created).status()).toBe(201);

    const rejected = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(
                `/api/v1/admin/world-builder/maps/${ids.map}/assets`,
            ),
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${ids.map}/assets`,
        async (route) => {
            await route.fulfill({ status: 503 });
        },
    );
    await workspace.getByRole('button', { name: 'Add Asset' }).click();
    expect((await rejected).status()).toBe(503);
    await expect(
        page.getByText('The MapAsset could not be added.', { exact: true }),
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

test('the lifted source MapAsset sound upload keeps the managed Rust media URL when its node is saved', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(
        `/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&worldView=nodes`,
    );

    await page
        .getByRole('button', { name: 'Select Source node to edit' })
        .click();
    await page.locator('#map-asset-settings-tab-sounds').click();
    await expect(
        page.getByRole('heading', { name: 'MapAsset sounds' }),
    ).toBeVisible();
    await page.route('**/api/v1/admin/sounds/media', async (route) => {
        expect(route.request().headers()['x-csrf-token']).toBe(
            'source-map-editor-csrf',
        );
        await route.fulfill({
            body: JSON.stringify({
                asset_id: '00000000-0000-4000-8000-000000000050',
            }),
            contentType: 'application/json',
        });
    });
    const uploadedSound = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/api/v1/admin/sounds/media'),
    );
    await page.locator('#node-sound-click-upload').setInputFiles({
        buffer: Buffer.from('RIFF....WAVEfmt '),
        mimeType: 'audio/wav',
        name: 'source-click.wav',
    });
    expect((await uploadedSound).status()).toBe(200);
    await expect(page.locator('#node-sound-click')).toHaveValue(
        '/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000050/content',
    );
    await page.locator('#node-sound-click-enabled').check();

    let savedAsset: Record<string, unknown> | null = null;
    let savedNode: Record<string, unknown> | null = null;
    await page.route(
        `**/api/v1/admin/world-builder/assets/${ids.asset}`,
        async (route) => {
            savedAsset = route.request().postDataJSON() as Record<
                string,
                unknown
            >;
            await route.fulfill({ status: 204 });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/nodes/${ids.node}`,
        async (route) => {
            savedNode = route.request().postDataJSON() as Record<
                string,
                unknown
            >;
            await route.fulfill({ status: 204 });
        },
    );
    const assetSaved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith(
                `/api/v1/admin/world-builder/assets/${ids.asset}`,
            ),
    );
    const nodeSaved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith(
                `/api/v1/admin/world-builder/nodes/${ids.node}`,
            ),
    );
    await page.getByRole('button', { name: 'Save MapAsset' }).click();
    expect((await assetSaved).status()).toBe(204);
    expect((await nodeSaved).status()).toBe(204);
    expect(savedAsset).not.toBeNull();
    expect(savedNode).not.toBeNull();
    expect(
        (savedNode!.visual_config as { sounds: { click: { url: string } } })
            .sounds.click.url,
    ).toBe(
        '/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000050/content',
    );
});

test('the lifted source MapAsset editor retains its empty canvas at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page, emptyEditableMap);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(
        `/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&worldView=nodes`,
    );

    const workspace = await expectBoundedWorkspace(page, {
        height: 900,
        width: 1440,
    });
    await expect(workspace.getByText('No MapAssets yet')).toBeVisible();
    await expect(
        workspace.getByText(
            'Use Add Asset to place the first visual area on this map. Select it afterwards to configure its image, position and learner-facing behavior.',
        ),
    ).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    await expectBoundedWorkspace(page, { height: 844, width: 390 });
    await expect(workspace.getByText('No MapAssets yet')).toBeVisible();
});
