import { expect, test } from './authenticated';

test('MapAsset import uses fixed platform catalog copy and accepts a scoped portable package', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d81';
    let importCsrfHeader: string | undefined;

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-asset-import-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d82',
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
                        'settings.world_builder.map_asset_import.open':
                            'Open localized MapAsset import',
                        'settings.world_builder.map_asset_import.eyebrow':
                            'Localized World Builder',
                        'settings.world_builder.map_asset_import.title':
                            'Localized authored MapAsset import',
                        'settings.world_builder.map_asset_import.description':
                            'Localized MapAsset-import guidance.',
                        'settings.world_builder.map_asset_import.close_aria':
                            'Close localized MapAsset import',
                        'settings.world_builder.map_asset_import.file':
                            'Localized MapAsset package',
                        'settings.world_builder.map_asset_import.no_file':
                            'No localized MapAsset package selected.',
                        'settings.world_builder.map_asset_import.checking':
                            'Checking localized MapAsset package…',
                        'settings.world_builder.map_asset_import.check':
                            'Check localized MapAsset package',
                        'settings.world_builder.map_asset_import.cancel':
                            'Cancel localized MapAsset import',
                        'settings.world_builder.map_asset_import.creating':
                            'Importing localized MapAsset…',
                        'settings.world_builder.map_asset_import.submit':
                            'Import localized MapAsset',
                        'settings.world_builder.map_asset_import.counts':
                            'Localized MapAsset counts: :nodes / :activities / :map_assets / :media_references',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: [
                    {
                        access_roles: ['public'],
                        description: 'A mocked destination map.',
                        id: mapId,
                        node_count: 0,
                        nodes: [],
                        review_count: 0,
                        slug: 'destination-map',
                        title: 'Destination map',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d83',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(mapDocument(mapId)),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}/asset-exports/preflight`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(preflightResult()),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}/asset-exports/import`,
        async (route) => {
            importCsrfHeader = route.request().headers()['x-csrf-token'];
            await route.fulfill({
                contentType: 'application/json',
                status: 201,
                body: JSON.stringify({
                    asset_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d84',
                }),
            });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });

    await page.goto(`/settings?panel=admin-world-builder&map=${mapId}`);
    await page
        .getByRole('button', { name: 'Open localized MapAsset import' })
        .click();

    const dialog = page.locator('[data-wl-id="authoring.map-asset.import.dialog"]');
    await expect(
        dialog.getByRole('heading', {
            name: 'Localized authored MapAsset import',
        }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized MapAsset-import guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByText('No localized MapAsset package selected.'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    const fileInput = dialog.getByLabel('Localized MapAsset package');
    await expect(fileInput).toHaveAttribute(
        'accept',
        '.json,.zip,application/json,application/zip,text/plain',
    );
    await fileInput.setInputFiles({
        buffer: Buffer.from('portable-map-asset-package'),
        mimeType: 'application/zip',
        name: 'localized-map-asset.zip',
    });
    const preflight = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/maps/${mapId}/asset-exports/preflight`),
    );
    await dialog
        .getByRole('button', { name: 'Check localized MapAsset package' })
        .click();
    expect((await preflight).status()).toBe(200);
    await expect(dialog.getByRole('status')).toContainText(
        'Localized MapAsset counts: 1 / 2 / 1 / 3',
    );

    const imported = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/maps/${mapId}/asset-exports/import`),
    );
    await dialog
        .getByRole('button', { name: 'Import localized MapAsset' })
        .click();
    expect((await imported).status()).toBe(201);
    expect(importCsrfHeader).toBe('test-csrf-token');
    await expect(dialog).toBeHidden();
});

function mapDocument(mapId: string) {
    return {
        access_groups: [],
        can_delete_world_maps: false,
        can_manage_map_access: false,
        editable_map: {
            map: {
                access_roles: ['public'],
                background_config: {},
                description: 'A mocked destination map.',
                editing_group_ids: [],
                grid_config: {},
                id: mapId,
                map_assets: [],
                map_assets_locked: false,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: 'destination-map',
                title: 'Destination map',
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d83',
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
            activities: 2,
            mapAssets: 1,
            mediaReferences: 3,
            nodes: 1,
            portalTargets: 0,
        },
        errors: [],
        summary: 'The mocked MapAsset package is structurally ready.',
        valid: true,
        warnings: [],
    };
}
