import type { Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    map: '00000000-0000-4000-8000-000000000010',
    world: '00000000-0000-4000-8000-000000000001',
};

const graph = {
    maps: [{
        access_roles: [], description: 'A source-derived map configuration fixture.', id: ids.map,
        node_count: 0, nodes: [], review_count: 0, slug: 'source-map', title: 'Source map', updated_at: '2026-11-15T12:34:00Z',
    }],
    portal_candidates: [], portal_links: [],
    world: { description: 'A mocked authoring world.', id: ids.world, slug: 'mocked-world', title: 'Mocked World', updated_at: '2026-11-15T12:34:00Z' },
};

const editableMap = {
    access_groups: [{ description: 'Learners can open this map.', label: 'Learners', slug: 'learner' }], can_delete_world_maps: true, can_manage_map_access: true,
    editable_map: {
        map: {
            access_roles: [], background_config: {}, description: graph.maps[0].description,
            editing_group_ids: [], grid_config: {}, id: ids.map, map_assets: [], map_assets_locked: false,
            node_count: 0, nodes: [], review_count: 0, slug: 'source-map', title: 'Source map', topic_id: null,
            updated_at: '2026-11-15T12:34:00Z',
        },
        world: graph.world,
    },
    items: [], learning_groups: [{ description: 'Can configure assigned maps.', id: '00000000-0000-4000-8000-000000000011', name: 'Map editors' }], role_options: [], sounds: [], tools: [], topic_options: [],
};

async function installRoutes(page: Page, options: { galleryFails?: boolean } = {}) {
    await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ body: JSON.stringify({ token: 'test-csrf' }), contentType: 'application/json' }));
    await page.route('**/api/v1/me', async (route) => route.fulfill({
        body: JSON.stringify({ appearance: 'dark', avatar_url: null, can_view_media_paths: true, capabilities: [], email: 'world-builder-admin@example.test', name: 'World Builder Admin', roles: ['platform_administrator'], settings_access: { assets: true, world_activities: true, world_maps: true, world_nodes: true }, subject_id: '00000000-0000-4000-8000-000000000002', username: null }),
        contentType: 'application/json',
    }));
    await page.route('**/api/v1/learner/platform-translations', async (route) => route.fulfill({ body: JSON.stringify({ locale: 'test', translations: {} }), contentType: 'application/json' }));
    await page.route('**/api/v1/admin/world-builder', async (route) => route.fulfill({ body: JSON.stringify(graph), contentType: 'application/json' }));
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}`, async (route) => route.fulfill({ body: JSON.stringify(editableMap), contentType: 'application/json' }));
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}/visual-media`, async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                preview_url: `/api/v1/admin/world-builder/maps/${ids.map}/visual-media/00000000-0000-4000-8000-000000000098/content`,
                url: '/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000098/content',
            }),
            contentType: 'application/json', status: 201,
        });
    });
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}/visuals`, async (route) => route.fulfill({ body: JSON.stringify({ background_config: {}, map_id: ids.map }), contentType: 'application/json' }));
    await page.route('**/api/v1/admin/media-assets**', async (route) => {
        if (options.galleryFails) {
            await route.fulfill({ body: JSON.stringify({ detail: 'asset library unavailable' }), contentType: 'application/problem+json', status: 503 });
            return;
        }
        await route.fulfill({
            body: JSON.stringify({
                items: [{ can_delete: true, can_view_path: true, category: 'background', content_type: 'image/svg+xml', display_name: 'Source visual', has_transparency: true, id: '00000000-0000-4000-8000-000000000099', is_animated: false, reference_count: 0, reference_groups: [], tags: ['background'], updated_at: '2026-11-15T12:34:00Z', url: '/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000099/content' }],
                pagination: { last_page: 1, page: 1, per_page: 12, total: 1 },
            }), contentType: 'application/json',
        });
    });
}

test('the pinned-source Map Configuration details, visual picker, and gallery failure state stay bounded at desktop and narrow widths', async ({ page }) => {
    await installRoutes(page);
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(`/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&worldView=configure`);

    await expect(page.getByRole('button', { name: 'Map details', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Map visuals' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Access', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Map details' })).toBeVisible();

    await page.getByRole('button', { name: 'Map visuals' }).click();
    await page.getByRole('button', { name: 'Background image' }).click();
    await expect(page.getByLabel('Dark mode background image')).toBeVisible();
    await page.getByRole('button', { name: 'Select existing' }).click();
    await expect(page.getByRole('heading', { name: 'Select existing image' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Source visual/ })).toBeVisible();
    await page.getByRole('button', { name: /Source visual/ }).click();
    await expect(page.getByRole('link', { name: 'Download' })).toBeVisible();
    const uploaded = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/maps/${ids.map}/visual-media`));
    await page.locator('#dark-map-background-image-upload').setInputFiles({
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        mimeType: 'image/svg+xml', name: 'source-map.svg',
    });
    expect((await uploaded).status()).toBe(201);
    const previewUrl = `/api/v1/admin/world-builder/maps/${ids.map}/visual-media/00000000-0000-4000-8000-000000000098/content`;
    await expect(page.locator(`img[src="${previewUrl}"]`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `${previewUrl}?download=1`);
    const saved = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith(`/maps/${ids.map}/visuals`));
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect(JSON.parse((await saved).postData() ?? '{}')).toMatchObject({
        background_config: { dark: { imageUrl: '/api/v1/admin/media-assets/00000000-0000-4000-8000-000000000098/content' } },
    });

    await page.setViewportSize({ height: 844, width: 390 });
    const workspace = page.locator('[data-wl-id="authoring.world-builder.map-workspace"]');
    await expect(workspace).toBeVisible();
    const bounds = await workspace.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await expect(page.getByRole('button', { name: 'Background image' })).toBeVisible();
});

test('the pinned-source reusable-image gallery retains its bounded unavailable state', async ({ page }) => {
    await installRoutes(page, { galleryFails: true });
    await page.goto(`/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&worldView=configure`);
    await page.getByRole('button', { name: 'Map visuals' }).click();
    await page.getByRole('button', { name: 'Background image' }).click();
    await page.getByRole('button', { name: 'Select existing' }).click();
    await expect(page.getByText('Images could not be loaded.')).toBeVisible();
});

test('the pinned-source details, history, access, and delete controls use their scoped Rust contracts', async ({ page }) => {
    await installRoutes(page);
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}/details`, async (route) => {
        expect(route.request().method()).toBe('PATCH');
        expect(JSON.parse(route.request().postData() ?? '{}')).toMatchObject({
            description: graph.maps[0].description,
            map_assets_locked: false,
            title: 'Changed source map',
            updated_at: graph.maps[0].updated_at,
        });
        await route.fulfill({ body: JSON.stringify({ updated_at: '2026-11-15T13:00:00Z' }), contentType: 'application/json' });
    });
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}/versions**`, async (route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                body: JSON.stringify({ items: [{ created_at: '2026-11-15T12:00:00Z', description: 'Earlier description', id: '00000000-0000-4000-8000-000000000012', map_assets_locked: false, title: 'Earlier source map', topic_id: null }], last_page: 1, page: 1, per_page: 4, total: 1 }),
                contentType: 'application/json',
            });
            return;
        }
        expect(route.request().method()).toBe('POST');
        await route.fulfill({ body: JSON.stringify({ description: 'Earlier description', map_assets_locked: false, title: 'Earlier source map', topic_id: null, updated_at: '2026-11-15T14:00:00Z' }), contentType: 'application/json' });
    });
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}/access`, async (route) => {
        expect(JSON.parse(route.request().postData() ?? '{}')).toEqual({ access_roles: ['user', 'admin', 'learner'] });
        await route.fulfill({ body: JSON.stringify({}), contentType: 'application/json' });
    });
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}/editing-groups`, async (route) => {
        expect(JSON.parse(route.request().postData() ?? '{}')).toEqual({ group_ids: ['00000000-0000-4000-8000-000000000011'] });
        await route.fulfill({ body: JSON.stringify({}), contentType: 'application/json' });
    });
    await page.route(`**/api/v1/admin/world-builder/maps/${ids.map}`, async (route) => {
        if (route.request().method() === 'DELETE') {
            await route.fulfill({ body: JSON.stringify({}), contentType: 'application/json' });
            return;
        }
        await route.fallback();
    });

    await page.goto(`/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&worldView=configure`);
    await page.locator('input[value="Source map"]').fill('Changed source map');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expect(page.getByRole('button', { name: 'Save changes' }).first()).toBeDisabled();

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'Map detail history' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/versions/00000000-0000-4000-8000-000000000012'));
    await page.getByRole('button', { name: 'Restore this version' }).click();
    expect((await restored).headers()['x-csrf-token']).toBe('test-csrf');

    await page.getByRole('button', { name: 'Access', exact: true }).click();
    await page.getByText('Learners', { exact: true }).click();
    await page.getByText('Map editors', { exact: true }).click();
    const accessSaved = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith(`/maps/${ids.map}/access`));
    const groupEditorsSaved = page.waitForRequest((request) => request.method() === 'PATCH' && request.url().endsWith(`/maps/${ids.map}/editing-groups`));
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await Promise.all([accessSaved, groupEditorsSaved]);

    await page.getByRole('button', { name: 'Delete world' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).first().click();
    await expect(page.getByRole('heading', { name: 'Delete world map?' })).toBeVisible();
    const deleted = page.waitForRequest((request) => request.method() === 'DELETE' && request.url().endsWith(`/maps/${ids.map}`));
    await page.getByRole('button', { name: 'Delete world map' }).last().click();
    await deleted;
    await expect(page.getByRole('heading', { name: 'Delete world map?' })).toHaveCount(0);
});
