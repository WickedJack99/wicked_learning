import { expect, test } from './authenticated';

test('map access uses fixed platform catalog copy while preserving separate viewer and editor updates', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d51';
    const editorGroupId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d52';
    let accessRequest: unknown;
    let editorGroupsRequest: unknown;

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-access-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d53',
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
                        'settings.world_builder.map_access.open':
                            'Open localized map access',
                        'settings.world_builder.map_access.title':
                            'Localized access permissions',
                        'settings.world_builder.map_access.description':
                            'Localized map-access guidance.',
                        'settings.world_builder.map_access.groups':
                            'Localized map access groups',
                        'settings.world_builder.map_access.access_required':
                            'A localized map visitor group is required.',
                        'settings.world_builder.map_access.access_invalid':
                            'Localized map visitor groups are invalid.',
                        'settings.world_builder.map_access.access_error':
                            'Localized map access save error.',
                        'settings.world_builder.map_access.access_network_error':
                            'Localized map access connection error.',
                        'settings.world_builder.map_access.editors_title':
                            'Localized group editors',
                        'settings.world_builder.map_access.editors_description':
                            'Localized map-editor guidance.',
                        'settings.world_builder.map_access.editors_groups':
                            'Localized map editor groups',
                        'settings.world_builder.map_access.editors_empty':
                            'Localized no editable groups.',
                        'settings.world_builder.map_access.editors_invalid':
                            'Localized map editors are invalid.',
                        'settings.world_builder.map_access.editors_error':
                            'Localized map editor save error.',
                        'settings.world_builder.map_access.editors_network_error':
                            'Localized map editor connection error.',
                        'settings.world_builder.map_access.saving':
                            'Saving localized map access…',
                        'settings.world_builder.map_access.editors_save':
                            'Save localized map editors',
                        'settings.world_builder.map_access.cancel':
                            'Cancel localized map access',
                        'settings.world_builder.map_access.save':
                            'Save localized map access',
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
                        description: 'A mocked access-controlled map.',
                        id: mapId,
                        node_count: 0,
                        nodes: [],
                        review_count: 0,
                        slug: 'access-controlled-map',
                        title: 'Access-controlled map',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d54',
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
                body: JSON.stringify(mapDocument({ editorGroupId, mapId })),
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}/access`,
        async (route) => {
            accessRequest = route.request().postDataJSON();
            await route.fulfill({ status: 204 });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/maps/${mapId}/editing-groups`,
        async (route) => {
            editorGroupsRequest = route.request().postDataJSON();
            await route.fulfill({ status: 204 });
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
        .getByRole('button', { name: 'Open localized map access' })
        .click();

    const dialog = page.locator(
        '[data-wl-id="authoring.world-builder.map-access.dialog"]',
    );
    await expect(
        dialog.getByRole('heading', { name: 'Localized access permissions' }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized map-access guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByRole('heading', { name: 'Localized group editors' }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized map-editor guidance.'),
    ).toBeVisible();

    const accessGroups = dialog.getByRole('group', {
        name: 'Localized map access groups',
    });

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    await accessGroups.getByRole('checkbox').nth(1).check();
    const accessSaved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes(`/maps/${mapId}/access`),
    );
    await dialog
        .getByRole('button', { name: 'Save localized map access' })
        .click();
    expect((await accessSaved).status()).toBe(204);
    expect(accessRequest).toEqual({
        access_roles: ['public', 'platform_administrator'],
    });
    await expect(dialog).toBeHidden();

    await page
        .getByRole('button', { name: 'Open localized map access' })
        .click();
    const editorGroups = dialog.getByRole('group', {
        name: 'Localized map editor groups',
    });
    await editorGroups.getByRole('checkbox').check();
    const editorsSaved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes(`/maps/${mapId}/editing-groups`),
    );
    await dialog
        .getByRole('button', { name: 'Save localized map editors' })
        .click();
    expect((await editorsSaved).status()).toBe(204);
    expect(editorGroupsRequest).toEqual({ group_ids: [editorGroupId] });
    await expect(dialog).toBeHidden();
});

function mapDocument({ editorGroupId, mapId }: { editorGroupId: string; mapId: string }) {
    return {
        access_groups: [
            {
                description: 'Anyone may open this map.',
                label: 'Public visitors',
                slug: 'public',
            },
            {
                description: 'Platform administrators may open this map.',
                label: 'Platform administrators',
                slug: 'platform_administrator',
            },
        ],
        can_delete_world_maps: false,
        can_manage_map_access: true,
        editable_map: {
            map: {
                access_roles: ['public'],
                background_config: {},
                description: 'A mocked access-controlled map.',
                editing_group_ids: [],
                grid_config: {},
                id: mapId,
                map_assets: [],
                map_assets_locked: false,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: 'access-controlled-map',
                title: 'Access-controlled map',
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d54',
                slug: 'mocked-world',
                title: 'Mocked World',
                updated_at: '2026-11-14T12:34:00Z',
            },
        },
        items: [],
        learning_groups: [
            {
                description: 'A group that can edit this map.',
                id: editorGroupId,
                name: 'Map editors',
            },
        ],
        role_options: [],
        sounds: [],
        tools: [],
        topic_options: [],
    };
}
