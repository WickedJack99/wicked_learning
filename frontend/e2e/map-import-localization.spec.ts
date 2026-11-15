import { expect, test } from './authenticated';

test('the lifted source map-import dialog retains map fields, preflight retry, and Rust import seams at desktop and narrow viewports', async ({
    page,
}) => {
    const sourceMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d71';
    const importedMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d72';
    const importedTitle = 'Localized imported map';
    let imported = false;
    let preflightAttempts = 0;
    let csrfHeaders: string[] = [];

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-import-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d73',
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/platform-translations',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    locale: 'test',
                    translations: {
                        'settings.world_builder.import.open':
                            'Open localized map import',
                        'settings.world_builder.import.title':
                            'Localized authored map import',
                        'settings.world_builder.import.package_description':
                            'Localized map-import guidance.',
                        'settings.world_builder.import.package_file':
                            'Localized map export file',
                        'settings.world_builder.import.name':
                            'Localized imported map title',
                        'settings.world_builder.import.slug':
                            'Localized imported map slug',
                        'settings.world_builder.import.cancel':
                            'Cancel localized map import',
                        'settings.world_builder.import.creating':
                            'Importing localized map…',
                        'settings.world_builder.import.submit':
                            'Import localized map',
                        'settings.world_builder.import.recheck':
                            'Check localized map export again',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        const maps = [mapSummary(sourceMapId, 'Source map')];
        if (imported) {
            maps.push(mapSummary(importedMapId, importedTitle));
        }
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps,
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d74',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(
        '**/api/v1/admin/world-builder/maps/*',
        async (route) => {
            const mapId = route.request().url().split('/').at(-1);
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(
                    mapDocument(
                        mapId === importedMapId ? importedMapId : sourceMapId,
                        mapId === importedMapId ? importedTitle : 'Source map',
                    ),
                ),
            });
        },
    );
    await page.route(
        '**/api/v1/admin/world-builder/map-exports/preflight',
        async (route) => {
            csrfHeaders.push(route.request().headers()['x-csrf-token'] ?? '');
            preflightAttempts += 1;
            if (preflightAttempts === 1) {
                await route.fulfill({
                    body: JSON.stringify({ title: 'Unavailable' }),
                    contentType: 'application/problem+json',
                    status: 503,
                });
                return;
            }
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(preflightResult()),
            });
        },
    );
    await page.route(
        '**/api/v1/admin/world-builder/map-exports/import',
        async (route) => {
            csrfHeaders.push(route.request().headers()['x-csrf-token'] ?? '');
            imported = true;
            await route.fulfill({
                contentType: 'application/json',
                status: 201,
                body: JSON.stringify({ map_id: importedMapId }),
            });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    await page
        .getByRole('button', { name: 'Open localized map import' })
        .click();

    const dialog = page.locator(
        '[data-wl-id="settings.world-builder.map.import.dialog"]',
    );
    await expect(
        dialog.getByRole('heading', { name: 'Localized authored map import' }),
    ).toBeVisible();
    await expect(dialog.getByText('Localized map-import guidance.')).toBeVisible();
    await expect(
        dialog.getByLabel('Localized imported map title'),
    ).toBeVisible();
    await expect(
        dialog.getByLabel('Localized imported map slug'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopBounds = await dialog.boundingBox();
    expect(desktopBounds).not.toBeNull();
    expect(desktopBounds!.x).toBeGreaterThanOrEqual(0);
    expect(desktopBounds!.x + desktopBounds!.width).toBeLessThanOrEqual(1440);
    expect(desktopBounds!.y).toBeGreaterThanOrEqual(0);
    expect(desktopBounds!.y + desktopBounds!.height).toBeLessThanOrEqual(900);
    const fileInput = dialog.getByLabel('Localized map export file');
    await expect(fileInput).toHaveAttribute(
        'accept',
        '.json,.zip,application/json,application/zip,text/plain',
    );
    const unavailablePreflight = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/map-exports/preflight'),
    );
    await fileInput.setInputFiles({
        buffer: Buffer.from('{"format":"wicked-learning-map"}'),
        mimeType: 'application/json',
        name: 'localized-map-export.json',
    });
    expect((await unavailablePreflight).status()).toBe(503);
    await expect(dialog.getByText('The file could not be checked.')).toBeVisible();
    const preflight = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/map-exports/preflight'),
    );
    await dialog
        .getByRole('button', { name: 'Check localized map export again' })
        .click();
    expect((await preflight).status()).toBe(200);
    await expect(dialog.getByRole('status')).toContainText(
        'The mocked export is structurally ready.',
    );
    await expect(dialog.getByRole('status')).toContainText('Referenced media');

    await dialog
        .getByLabel('Localized imported map title')
        .fill(importedTitle);
    const importedResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/map-exports/import'),
    );
    await dialog
        .getByRole('button', { name: 'Import localized map' })
        .click();
    expect((await importedResponse).status()).toBe(201);
    expect(csrfHeaders).toEqual([
        'test-csrf-token',
        'test-csrf-token',
        'test-csrf-token',
    ]);
    await expect(dialog).toBeHidden();
});

test('map creation uses fixed platform catalog copy and the scoped CSRF command', async ({
    page,
}) => {
    const createdMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d75';
    const createdTitle = 'Localized created map';
    let created = false;
    let csrfHeader: string | undefined;

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-create-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d76',
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/platform-translations',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    locale: 'test',
                    translations: {
                        'settings.world_builder.create_map.open':
                            'Open localized map creation',
                        'settings.world_builder.create_map.title':
                            'Localized world node creation',
                        'settings.world_builder.create_map.description':
                            'Localized map-creation guidance.',
                        'settings.world_builder.create_map.title_label':
                            'Localized map title',
                        'settings.world_builder.create_map.slug_label':
                            'Localized map slug',
                        'settings.world_builder.create_map.description_label':
                            'Localized map description',
                        'settings.world_builder.create_map.title_required':
                            'A localized map title is required.',
                        'settings.world_builder.create_map.invalid':
                            'Localized map creation is invalid.',
                        'settings.world_builder.create_map.error':
                            'Localized map creation failed.',
                        'settings.world_builder.create_map.network_error':
                            'Localized map connection failure.',
                        'settings.world_builder.create_map.cancel':
                            'Cancel localized map creation',
                        'settings.world_builder.create_map.creating':
                            'Creating localized map…',
                        'settings.world_builder.create_map.submit':
                            'Create localized map',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: created ? [mapSummary(createdMapId, createdTitle)] : [],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(
        `**/api/v1/admin/world-builder/maps/${createdMapId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(mapDocument(createdMapId, createdTitle)),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder/maps', async (route) => {
        csrfHeader = route.request().headers()['x-csrf-token'];
        created = true;
        await route.fulfill({
            contentType: 'application/json',
            status: 201,
            body: JSON.stringify({ map_id: createdMapId }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    await page
        .getByRole('button', { name: 'Open localized map creation' })
        .click();

    const dialog = page.getByRole('dialog');
    await expect(
        dialog.getByRole('heading', { name: 'Localized world node creation' }),
    ).toBeVisible();
    await expect(dialog.getByText('Localized map-creation guidance.')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    await dialog.getByLabel('Localized map title').fill(createdTitle);
    await dialog.getByLabel('Localized map slug').fill('localized-created-map');
    await dialog
        .getByLabel('Localized map description')
        .fill('A localized map description.');
    const createResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/api/v1/admin/world-builder/maps'),
    );
    await dialog
        .getByRole('button', { name: 'Create localized map' })
        .click();
    expect((await createResponse).status()).toBe(201);
    expect(csrfHeader).toBe('test-csrf-token');
    await expect(dialog).toBeHidden();
});

function mapSummary(id: string, title: string) {
    return {
        access_roles: ['public'],
        description: 'A mocked authoring map.',
        id,
        node_count: 0,
        nodes: [],
        review_count: 0,
        slug: title.toLowerCase().replaceAll(' ', '-'),
        title,
        updated_at: '2026-11-14T12:34:00Z',
    };
}

function mapDocument(mapId: string, title: string) {
    return {
        access_groups: [],
        can_delete_world_maps: false,
        can_manage_map_access: false,
        editable_map: {
            map: {
                access_roles: ['public'],
                background_config: {},
                description: 'A mocked authoring map.',
                editing_group_ids: [],
                grid_config: {},
                id: mapId,
                map_assets: [],
                map_assets_locked: false,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: title.toLowerCase().replaceAll(' ', '-'),
                title,
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d74',
                slug: 'mocked-world',
                title: 'Mocked World',
                updated_at: '2026-11-14T12:34:00Z',
            },
        },
        items: [],
        learning_groups: [],
        role_options: [],
        sounds: [],
        tools: [],
        topic_options: [],
    };
}

function preflightResult() {
    return {
        counts: {
            activities: 0,
            mapAssets: 0,
            mediaReferences: 1,
            nodes: 0,
            portalTargets: 0,
        },
        errors: [],
        map: { exists: false, slug: 'source-map' },
        mediaReferenceDetails: [
            {
                available: true,
                url: '/api/v1/admin/media-assets/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d79/content',
            },
        ],
        summary: 'The mocked export is structurally ready.',
        valid: true,
        warnings: [],
        world: { exists: true, slug: 'mocked-world' },
    };
}
