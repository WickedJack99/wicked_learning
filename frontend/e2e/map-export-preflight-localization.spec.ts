import { expect, test } from './authenticated';

test('map export preflight uses fixed platform catalog copy and submits a CSRF-protected manifest', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d61';
    let csrfHeader: string | undefined;

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'map-export-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d62',
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
                        'settings.world_builder.export_validation.open':
                            'Open localized map export validation',
                        'settings.world_builder.export_validation.eyebrow':
                            'Localized World Builder',
                        'settings.world_builder.export_validation.title':
                            'Localized map export validation',
                        'settings.world_builder.export_validation.description':
                            'Localized map-export guidance.',
                        'settings.world_builder.export_validation.close_aria':
                            'Close localized map export validation',
                        'settings.world_builder.export_validation.file':
                            'Localized JSON export file',
                        'settings.world_builder.export_validation.no_file':
                            'No localized file selected.',
                        'settings.world_builder.export_validation.choose_file':
                            'Choose a localized export file first.',
                        'settings.world_builder.export_validation.failed':
                            'Localized manifest check failure.',
                        'settings.world_builder.export_validation.counts':
                            'Localized counts: :nodes / :activities / :map_assets / :portals / :media_references',
                        'settings.world_builder.export_validation.close':
                            'Close localized map export validation',
                        'settings.world_builder.export_validation.checking':
                            'Checking localized manifest…',
                        'settings.world_builder.export_validation.check':
                            'Check localized manifest',
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
                        description: 'A mocked exportable map.',
                        id: mapId,
                        node_count: 0,
                        nodes: [],
                        review_count: 0,
                        slug: 'exportable-map',
                        title: 'Exportable map',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d63',
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
        '**/api/v1/admin/world-builder/map-exports/preflight',
        async (route) => {
            csrfHeader = route.request().headers()['x-csrf-token'];
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    counts: {
                        activities: 2,
                        mapAssets: 1,
                        mediaReferences: 3,
                        nodes: 1,
                        portalTargets: 0,
                    },
                    errors: [],
                    summary: 'The mocked export is structurally ready.',
                    valid: true,
                    warnings: [],
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
        .getByRole('button', { name: 'Open localized map export validation' })
        .click();

    const dialog = page.locator(
        '[data-wl-id="authoring.world-builder.map-export-preflight.dialog"]',
    );
    await expect(
        dialog.getByRole('heading', { name: 'Localized map export validation' }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized map-export guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByText('No localized file selected.'),
    ).toBeVisible();

    await dialog
        .getByRole('button', { name: 'Check localized manifest' })
        .click();
    await expect(
        dialog.getByText('Choose a localized export file first.'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 900 });
    await dialog.getByLabel('Localized JSON export file').setInputFiles({
        buffer: Buffer.from('{"format":"wicked-learning-map"}'),
        mimeType: 'application/json',
        name: 'localized-map-export.json',
    });
    const checked = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/map-exports/preflight'),
    );
    await dialog
        .getByRole('button', { name: 'Check localized manifest' })
        .click();
    expect((await checked).status()).toBe(200);
    expect(csrfHeader).toBe('test-csrf-token');
    await expect(dialog.getByRole('status')).toContainText(
        'The mocked export is structurally ready.',
    );
    await expect(dialog.getByRole('status')).toContainText(
        'Localized counts: 1 / 2 / 1 / 0 / 3',
    );
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
                description: 'A mocked exportable map.',
                editing_group_ids: [],
                grid_config: {},
                id: mapId,
                map_assets: [],
                map_assets_locked: false,
                node_count: 0,
                nodes: [],
                review_count: 0,
                slug: 'exportable-map',
                title: 'Exportable map',
                topic_id: null,
                updated_at: '2026-11-14T12:34:00Z',
            },
            world: {
                description: 'A mocked authoring world.',
                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d63',
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
