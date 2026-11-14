import { expect, test } from './authenticated';

test('the reusable activity template library consumes fixed platform catalog copy', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d01';
    const nodeId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d02';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'template-library-admin@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d03',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.world_builder.activity_templates.description':
                        'Localized reusable-template guidance.',
                    'settings.world_builder.activity_templates.empty':
                        'No localized reusable templates are saved.',
                    'settings.world_builder.activity_templates.open':
                        'Localized activity templates',
                    'settings.world_builder.activity_templates.search_label':
                        'Localized reusable-template search',
                    'settings.world_builder.activity_templates.title':
                        'Localized reusable-template library',
                },
            }),
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                maps: [
                    {
                        access_roles: [],
                        description: 'A mocked authoring map.',
                        id: mapId,
                        node_count: 1,
                        nodes: [
                            {
                                activity_review_count: 0,
                                description: 'A mocked authoring node.',
                                id: nodeId,
                                position: { q: 0, r: 0 },
                                slug: 'mocked-node',
                                state: 'available',
                                title: 'Mocked node',
                                unlock_diagnostics: [],
                                visual_config: {},
                            },
                        ],
                        review_count: 0,
                        slug: 'mocked-map',
                        title: 'Mocked map',
                        updated_at: '2026-11-14T12:34:00Z',
                    },
                ],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d04',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
        });
    });
    await page.route(`**/api/v1/admin/world-builder/nodes/${nodeId}`, async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                activity_graph: {
                    activities: [],
                    activity_types: [],
                    ai_review_templates: [],
                    can_manage_ai_review: false,
                    competence_topic_options: [],
                    evidence_concept_options: [],
                    map: { id: mapId, slug: 'mocked-map', title: 'Mocked map' },
                    message_topics: [],
                    node: {
                        description: 'A mocked authoring node.',
                        graph_layout: {},
                        id: nodeId,
                        slug: 'mocked-node',
                        start_activity_id: null,
                        start_routes: [],
                        title: 'Mocked node',
                    },
                    portal_candidates: [],
                    source_records: {
                        items: [],
                        pagination: {
                            current_page: 1,
                            last_page: 1,
                            per_page: 12,
                            total: 0,
                        },
                    },
                    transitions: [],
                    world: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d04',
                        slug: 'mocked-world',
                        title: 'Mocked World',
                    },
                },
                items: [],
                sounds: [],
                tools: [],
            }),
        });
    });
    await page.route('**/api/v1/admin/activity-templates**', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                items: [],
                pagination: { last_page: 1, page: 1, per_page: 8, total: 0 },
                share_targets: [],
            }),
        });
    });

    await page.goto(
        `/settings?panel=admin-world-builder&map=${mapId}&node=${nodeId}`,
    );
    await page
        .getByRole('button', { name: 'Localized activity templates' })
        .click();

    const dialog = page.locator('[data-wl-id="authoring.activity-templates"]');
    await expect(
        dialog.getByRole('heading', {
            name: 'Localized reusable-template library',
        }),
    ).toBeVisible();
    await expect(
        dialog.getByText('Localized reusable-template guidance.'),
    ).toBeVisible();
    await expect(
        dialog.getByLabel('Localized reusable-template search'),
    ).toBeVisible();
    await expect(
        dialog.getByText('No localized reusable templates are saved.'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});

test('a local author can save, revise, restore and copy a reusable activity template', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const map = graph.maps.find((candidate) => candidate.nodes.length > 0);
    expect(map).toBeDefined();
    if (!map) {
        throw new Error('the disposable World Builder has no readable node');
    }

    const nodeResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${map.nodes[0].id}`,
    );
    expect(nodeResponse.ok()).toBeTruthy();
    const node = (await nodeResponse.json()) as {
        activity_graph: {
            activities: Array<{
                activity_type: string;
                id: string;
                position: { x: number | null; y: number | null };
                title: string;
            }>;
        };
    };
    const activity = node.activity_graph.activities.find(
        (candidate) => candidate.activity_type === 'open_practice',
    );
    expect(activity).toBeDefined();
    if (!activity) {
        throw new Error(
            'the disposable World Builder has no Open practice activity',
        );
    }
    const graphPosition = Math.max(
        0,
        ...node.activity_graph.activities.flatMap((candidate) => [
            candidate.position.x ?? 0,
            candidate.position.y ?? 0,
        ]),
    ) + 1_000;
    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };
    const positionedResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activity.id}/graph-position`,
        {
            data: { position: { x: graphPosition, y: graphPosition } },
            headers: {
                Origin: new URL(page.url()).origin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(positionedResponse.status()).toBe(200);

    await page.goto(
        `/settings?panel=admin-world-builder&map=${map.id}&node=${map.nodes[0].id}`,
    );
    const activityCard = page.locator(`[data-id="${activity.id}"]`);
    await expect(activityCard).toBeVisible();

    const copyButton = activityCard.getByRole('button', {
        name: `Use ${activity.title} as a template`,
    });
    await expect(copyButton).toBeVisible();
    const copyButtonBox = await copyButton.boundingBox();
    expect(copyButtonBox).not.toBeNull();
    expect(copyButtonBox!.width).toBeGreaterThan(0);
    await copyButton.click();
    await expect(
        page.getByRole('heading', { name: 'Copy Open practice template' }),
    ).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue(
        `${activity.title} (copy)`,
    );
    await expect(page.getByLabel('Copy into MapAsset')).toHaveValue(
        map.nodes[0].id,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const copyDialog = page.getByRole('dialog', {
        name: 'Copy Open practice template',
    });
    const copyDialogBox = await copyDialog.boundingBox();
    expect(copyDialogBox).not.toBeNull();
    expect(copyDialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(copyDialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(copyDialogBox!.x + copyDialogBox!.width).toBeLessThanOrEqual(390);
    expect(copyDialogBox!.y + copyDialogBox!.height).toBeLessThanOrEqual(844);
    const createActivity = page.getByRole('button', {
        name: 'Create activity',
    });
    await createActivity.scrollIntoViewIfNeeded();
    const createActivityBox = await createActivity.boundingBox();
    expect(createActivityBox).not.toBeNull();
    expect(createActivityBox!.x).toBeGreaterThanOrEqual(0);
    expect(createActivityBox!.y).toBeGreaterThanOrEqual(0);
    expect(
        createActivityBox!.x + createActivityBox!.width,
    ).toBeLessThanOrEqual(390);
    expect(
        createActivityBox!.y + createActivityBox!.height,
    ).toBeLessThanOrEqual(844);
    const copied = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/nodes/${map.nodes[0].id}/open-practice-activities`,
                ),
    );
    await createActivity.click();
    const copiedResponse = await copied;
    expect(copiedResponse.status()).toBe(201);
    const copiedActivity = (await copiedResponse.json()) as {
        activity_id: string;
    };
    const deleteCsrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(deleteCsrfResponse.ok()).toBeTruthy();
    const deleteCsrf = (await deleteCsrfResponse.json()) as { token: string };
    const deletedCopy = await page.request.delete(
        `/api/v1/admin/world-builder/activities/${copiedActivity.activity_id}`,
        {
            headers: {
                Origin: new URL(page.url()).origin,
                'X-CSRF-Token': deleteCsrf.token,
            },
        },
    );
    expect(deletedCopy.status()).toBe(204);

    const templateName = `Template ${Date.now()}`;
    await activityCard
        .getByRole('button', {
            name: `Save ${activity.title} as a reusable template`,
        })
        .click();
    const dialog = page.locator('[data-wl-id="authoring.activity-templates"]');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Template name').fill(templateName);
    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/activities/${activity.id}/templates`,
                ),
    );
    await dialog
        .getByRole('button', { name: 'Save reusable template' })
        .click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const createdTemplate = (await createdResponse.json()) as {
        template: { id: string };
    };
    const detailsResponse = await page.request.get(
        `/api/v1/admin/activity-templates/${createdTemplate.template.id}`,
    );
    expect(detailsResponse.ok()).toBeTruthy();
    expect((await detailsResponse.json()).template.media_references).toEqual(
        [],
    );
    await expect(
        dialog.getByText(templateName, { exact: true }).first(),
    ).toBeVisible();

    await dialog
        .getByRole('button', { name: 'Close activity template library' })
        .click();
    await activityCard
        .getByRole('button', {
            name: `Update a saved template from ${activity.title}`,
        })
        .click();
    await expect(dialog).toBeVisible();
    page.once('dialog', (prompt) => prompt.accept());
    const updated = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/admin/activity-templates/') &&
            response.url().includes(`/from-activity/${activity.id}`),
    );
    await dialog
        .locator('article', { hasText: templateName })
        .getByRole('button', { name: 'Update', exact: true })
        .click();
    expect((await updated).status()).toBe(200);

    await dialog.getByRole('button', { name: 'Load history' }).click();
    await expect(dialog.getByText('Template history')).toBeVisible();
    page.once('dialog', (prompt) => prompt.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/activity-templates/') &&
            response.url().includes('/revisions/'),
    );
    await dialog.getByRole('button', { name: 'Restore' }).first().click();
    expect((await restored).status()).toBe(200);

    await dialog.getByRole('button', { name: 'Create editable copy' }).click();
    await expect(
        page.getByRole('heading', { name: 'Copy Open practice template' }),
    ).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue(
        `${activity.title} (copy)`,
    );
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Activity templates' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Search reusable templates').fill(templateName);
    await dialog.getByRole('button', { name: 'Search' }).click();
    await dialog
        .locator('article', { hasText: templateName })
        .getByRole('button', { name: 'Preview' })
        .click();
    page.once('dialog', (prompt) => prompt.accept());
    const deleted = page.waitForResponse(
        (response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes('/api/v1/admin/activity-templates/'),
    );
    await dialog.getByRole('button', { name: 'Delete template' }).click();
    expect((await deleted).status()).toBe(204);
    await expect(dialog.getByText(templateName, { exact: true })).toBeHidden();
});
