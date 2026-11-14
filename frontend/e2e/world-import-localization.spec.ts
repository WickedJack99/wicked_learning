import { expect, test } from './authenticated';

test('World import uses fixed platform catalog copy and accepts a scoped portable package', async ({
    page,
}) => {
    const sourceMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d91';
    const importedMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d92';
    let imported = false;
    let importCsrfHeader: string | undefined;

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'world-import-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d93',
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
                        'settings.world_builder.import.world_open':
                            'Open localized world import',
                        'settings.world_builder.world.export':
                            'Export localized world',
                        'settings.world_builder.world.export_package':
                            'Export localized world package',
                        'settings.world_builder.world_import.eyebrow':
                            'Localized World Builder',
                        'settings.world_builder.world_import.title':
                            'Localized authored world import',
                        'settings.world_builder.world_import.description':
                            'Localized world-import guidance.',
                        'settings.world_builder.world_import.close_aria':
                            'Close localized world import',
                        'settings.world_builder.world_import.file':
                            'Localized world package',
                        'settings.world_builder.world_import.no_file':
                            'No localized world package selected.',
                        'settings.world_builder.world_import.checking':
                            'Checking localized world package…',
                        'settings.world_builder.world_import.check':
                            'Check localized world package',
                        'settings.world_builder.world_import.maps_ready':
                            'Localized ready maps: :maps',
                        'settings.world_builder.world_import.cancel':
                            'Cancel localized world import',
                        'settings.world_builder.world_import.creating':
                            'Importing localized world…',
                        'settings.world_builder.world_import.submit':
                            'Import localized world',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        const maps = [mapSummary(sourceMapId, 'Source map')];
        if (imported) {
            maps.push(mapSummary(importedMapId, 'Imported map'));
        }
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps,
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d94',
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
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(mapDocument(importedMapId)),
            });
        },
    );
    await page.route(
        '**/api/v1/admin/world-builder/world-exports/preflight',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    errors: [],
                    maps: 2,
                    summary:
                        'The mocked World package is structurally ready for transfer.',
                    valid: true,
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/admin/world-builder/world-exports/import',
        async (route) => {
            importCsrfHeader = route.request().headers()['x-csrf-token'];
            imported = true;
            await route.fulfill({
                contentType: 'application/json',
                status: 201,
                body: JSON.stringify({ map_ids: [importedMapId] }),
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
        .getByRole('button', { name: 'Open localized world import' })
        .click();

    const dialog = page.locator(
        '[data-wl-id="authoring.world-builder.world-import.dialog"]',
    );
    await expect(
        dialog.getByRole('heading', {
            name: 'Localized authored world import',
        }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized world-import guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByText('No localized world package selected.'),
    ).toBeVisible();
    await expect(
        page.getByRole('link', {
            exact: true,
            name: 'Export localized world',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Export localized world package' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    const fileInput = dialog.getByLabel('Localized world package');
    await expect(fileInput).toHaveAttribute(
        'accept',
        '.json,.zip,application/json,application/zip,text/plain',
    );
    await fileInput.setInputFiles({
        buffer: Buffer.from('portable-world-package'),
        mimeType: 'application/zip',
        name: 'localized-world.zip',
    });
    const preflight = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/world-exports/preflight'),
    );
    await dialog
        .getByRole('button', { name: 'Check localized world package' })
        .click();
    expect((await preflight).status()).toBe(200);
    await expect(dialog.getByRole('status')).toContainText(
        'Localized ready maps: 2',
    );

    const importedResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/world-exports/import'),
    );
    await dialog
        .getByRole('button', { name: 'Import localized world' })
        .click();
    expect((await importedResponse).status()).toBe(201);
    expect(importCsrfHeader).toBe('test-csrf-token');
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

function mapDocument(mapId: string) {
    return {
        access_groups: [],
        can_delete_world_maps: false,
        can_manage_map_access: false,
        editable_map: {
            map: {
                access_roles: ['public'],
                background_config: {},
                description: 'A mocked imported map.',
                editing_group_ids: [],
                grid_config: {},
                id: mapId,
                map_assets: [],
                map_assets_locked: false,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: 'imported-map',
                title: 'Imported map',
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d94',
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
