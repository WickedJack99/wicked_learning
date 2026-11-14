import { expect, test } from './authenticated';

test('map duplication uses fixed platform catalog copy and submits the typed duplicate form', async ({
    page,
}) => {
    const worldId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d31';
    const sourceMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d32';
    const duplicateMapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d33';
    const duplicateTitle = 'Localized copied map';
    let duplicateCreated = false;
    let duplicateRequest: unknown;

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-duplicate-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d34',
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
                        'settings.world_builder.duplicate.open':
                            'Localized duplicate map',
                        'settings.world_builder.duplicate.title':
                            'Localized duplicate authored map',
                        'settings.world_builder.duplicate.description':
                            'Localized duplicate-map guidance.',
                        'settings.world_builder.duplicate.copy_suffix':
                            'localized copy',
                        'settings.world_builder.duplicate.name':
                            'Localized new map title',
                        'settings.world_builder.duplicate.slug':
                            'Localized slug optional',
                        'settings.world_builder.duplicate.title_required':
                            'A localized copied-map title is required.',
                        'settings.world_builder.duplicate.invalid':
                            'Localized duplicate map data is invalid.',
                        'settings.world_builder.duplicate.error':
                            'Localized duplicate map error.',
                        'settings.world_builder.duplicate.network_error':
                            'Localized duplicate map connection error.',
                        'settings.world_builder.duplicate.boundaries':
                            'Localized duplicate-map boundaries.',
                        'settings.world_builder.duplicate.cancel':
                            'Localized cancel map duplication',
                        'settings.world_builder.duplicate.duplicating':
                            'Duplicating localized map…',
                        'settings.world_builder.duplicate.submit':
                            'Submit localized map duplication',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        const maps = [
            {
                access_roles: [],
                description: 'A mocked source map.',
                id: sourceMapId,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: 'source-map',
                title: 'Source map',
                updated_at: '2026-11-14T12:34:00Z',
            },
        ];
        if (duplicateCreated) {
            maps.push({
                access_roles: [],
                description: 'A localized duplicate map.',
                id: duplicateMapId,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: 'localized-copied-map',
                title: duplicateTitle,
                updated_at: '2026-11-14T12:35:00Z',
            });
        }
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps,
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: worldId,
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(
        `**/api/v1/admin/world-builder/maps/${sourceMapId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(mapDocument({
                    description: 'A mocked source map.',
                    mapId: sourceMapId,
                    slug: 'source-map',
                    title: 'Source map',
                    worldId,
                })),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${duplicateMapId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(mapDocument({
                    description: 'A localized duplicate map.',
                    mapId: duplicateMapId,
                    slug: 'localized-copied-map',
                    title: duplicateTitle,
                    worldId,
                })),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${sourceMapId}/duplicate`,
        async (route) => {
            duplicateRequest = route.request().postDataJSON();
            duplicateCreated = true;
            await route.fulfill({
                contentType: 'application/json',
                status: 201,
                body: JSON.stringify({ map_id: duplicateMapId }),
            });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });

    await page.goto(`/settings?panel=admin-world-builder&map=${sourceMapId}`);
    await page
        .getByRole('button', { name: 'Localized duplicate map' })
        .click();

    const dialog = page.getByRole('dialog');
    await expect(
        dialog.getByRole('heading', { name: 'Localized duplicate authored map' }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized duplicate-map guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized duplicate-map boundaries.'),
    ).toBeVisible();
    await expect(dialog.getByLabel('Localized new map title')).toHaveValue(
        'Source map localized copy',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    await dialog.getByLabel('Localized new map title').fill(duplicateTitle);
    const duplicated = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/maps/${sourceMapId}/duplicate`),
    );
    await dialog
        .getByRole('button', { name: 'Submit localized map duplication' })
        .click();
    expect((await duplicated).status()).toBe(201);
    expect(duplicateRequest).toEqual({ slug: null, title: duplicateTitle });
    await expect(page.getByRole('heading', { name: duplicateTitle })).toBeVisible();
});

function mapDocument({
    description,
    mapId,
    slug,
    title,
    worldId,
}: {
    description: string;
    mapId: string;
    slug: string;
    title: string;
    worldId: string;
}) {
    return {
        access_groups: [],
        can_delete_world_maps: false,
        can_manage_map_access: false,
        editable_map: {
            map: {
                access_roles: [],
                background_config: {},
                description,
                editing_group_ids: [],
                grid_config: {},
                id: mapId,
                map_assets: [],
                map_assets_locked: false,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug,
                title,
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: worldId,
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
