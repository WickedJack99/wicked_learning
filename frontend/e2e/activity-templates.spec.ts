import { expect, test } from './authenticated';

test('the activity graph, NPC dialogue surfaces, and reusable template library consume fixed platform catalog copy', async ({
    page,
}) => {
    const mapId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d01';
    const nodeId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d02';
    const npcActivityId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d06';

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
                    'settings.world_builder.activity_graph.arrange':
                        'Localized graph arrangement guidance',
                    'settings.world_builder.activity_graph.back_to_map':
                        'Localized back to map',
                    'settings.world_builder.activity_graph.choice_context':
                        'Localized choice context',
                    'settings.world_builder.activity_graph.delete_activity':
                        'Localized delete :activity',
                    'settings.world_builder.activity_graph.edit':
                        'Localized edit',
                    'settings.world_builder.activity_graph.edit_activity':
                        'Localized edit :activity',
                    'settings.world_builder.activity_graph.feedback_guidance':
                        'Localized feedback guidance',
                    'settings.world_builder.activity_graph.history':
                        'Localized activity history',
                    'settings.world_builder.activity_graph.learner_orientation':
                        'Localized learner orientation',
                    'settings.world_builder.activity_graph.review_activity':
                        'Localized review activity',
                    'settings.world_builder.activity_graph.needs_review':
                        'Localized needs AI review',
                    'settings.world_builder.activity_graph.source_references':
                        'Localized sources',
                    'settings.world_builder.activity_graph.scene_ambience':
                        'Localized scene ambience',
                    'settings.world_builder.activity_graph.item_grant':
                        'Localized item grant',
                    'settings.world_builder.activity_graph.item_obstacle':
                        'Localized item obstacle',
                    'settings.world_builder.activity_graph.markdown':
                        'Localized markdown',
                    'settings.world_builder.activity_graph.message_prompt':
                        'Localized message prompt',
                    'settings.world_builder.activity_graph.message_wall':
                        'Localized message wall',
                    'settings.world_builder.activity_graph.npc_dialogue':
                        'Localized NPC dialogue',
                    'settings.world_builder.activity_graph.obstacle':
                        'Localized obstacle',
                    'settings.world_builder.activity_graph.open_practice':
                        'Localized open practice',
                    'settings.world_builder.activity_graph.portal':
                        'Localized portal',
                    'settings.world_builder.activity_graph.question':
                        'Localized question',
                    'settings.world_builder.activity_graph.reflection':
                        'Localized reflection',
                    'settings.world_builder.activity_graph.review_revisit':
                        'Localized review revisit',
                    'settings.world_builder.activity_graph.shared_task':
                        'Localized shared task',
                    'settings.world_builder.activity_graph.tool_grant':
                        'Localized tool grant',
                    'settings.world_builder.activity_templates.copy_activity':
                        'Localized copy :activity',
                    'settings.world_builder.activity_templates.create_copy':
                        'Localized editable copy',
                    'settings.world_builder.activity_templates.description':
                        'Localized reusable-template guidance.',
                    'settings.world_builder.activity_templates.empty':
                        'No localized reusable templates are saved.',
                    'settings.world_builder.activity_templates.open':
                        'Localized activity templates',
                    'settings.world_builder.activity_templates.search_label':
                        'Localized reusable-template search',
                    'settings.world_builder.activity_templates.save_activity_label':
                        'Localized save :activity',
                    'settings.world_builder.activity_templates.save_template':
                        'Localized save template',
                    'settings.world_builder.activity_templates.title':
                        'Localized reusable-template library',
                    'settings.world_builder.activity_templates.update_activity':
                        'Localized update :activity',
                    'settings.world_builder.activity_templates.update_template':
                        'Localized update template',
                    'settings.world_builder.npc_dialogue.back_to_graph':
                        'Localized activity graph',
                    'settings.world_builder.npc_dialogue.add_node':
                        'Localized add node',
                    'settings.world_builder.npc_dialogue.add_node_title':
                        'Localized add dialogue node',
                    'settings.world_builder.npc_dialogue.canvas_label':
                        'Localized NPC canvas',
                    'settings.world_builder.npc_dialogue.end_activity_output':
                        ':connector localized activity output',
                    'settings.world_builder.npc_dialogue.node_type_end':
                        'Localized end node',
                    'settings.world_builder.npc_dialogue.node_type_label':
                        'Localized node type',
                    'settings.world_builder.npc_dialogue.node_description':
                        'Localized node configuration guidance.',
                    'settings.world_builder.npc_dialogue.no_tool':
                        'Localized no tool',
                    'settings.world_builder.npc_dialogue.save_node':
                        'Localized save node',
                    'settings.world_builder.npc_dialogue.speech_bubble_text':
                        'Localized speech bubble text',
                    'settings.world_builder.npc_dialogue.tool_grant':
                        'Localized tool grant',
                    'settings.world_builder.npc_dialogue.scene.title':
                        'Localized scene presentation',
                    'settings.world_builder.npc_dialogue.scene_assets.title':
                        'Localized extra assets',
                    'settings.world_builder.npc_dialogue.scene_assets.empty':
                        'Localized empty assets',
                    'settings.world_builder.npc_dialogue.select_media':
                        'Localized select media',
                    'settings.world_builder.npc_dialogue.start':
                        'Localized start',
                    'settings.world_builder.npc_dialogue.start_description':
                        'Localized start guidance.',
                    'settings.world_builder.npc_dialogue.cancel':
                        'Localized cancel',
                    'settings.world_builder.npc_dialogue.create':
                        'Localized create dialogue',
                    'settings.world_builder.npc_dialogue.introduction_label':
                        'Localized introduction',
                    'settings.world_builder.npc_dialogue.new_description':
                        'Localized NPC creation guidance.',
                    'settings.world_builder.npc_dialogue.new_title':
                        'Localized new NPC dialogue',
                    'settings.world_builder.npc_dialogue.slug_label':
                        'Localized slug',
                    'settings.world_builder.npc_dialogue.title_label':
                        'Localized title',
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
                    activities: [
                        {
                            activity_type: 'open_practice',
                            ai_review: null,
                            ai_review_history: [],
                            ai_review_status: 'needs_review',
                            ai_reviewed_at: null,
                            config: {},
                            connectors: { inputs: [], outputs: [] },
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d05',
                            introduction: null,
                            portal_link: null,
                            position: { x: 0, y: 0 },
                            question: null,
                            slug: 'mocked-activity',
                            title: 'Mocked activity',
                            updated_at: '2026-11-14T12:34:00Z',
                        },
                        {
                            activity_type: 'npc_dialogue',
                            ai_review: null,
                            ai_review_history: [],
                            ai_review_status: 'needs_review',
                            ai_reviewed_at: null,
                            config: {},
                            connectors: { inputs: [], outputs: [] },
                            id: npcActivityId,
                            introduction: null,
                            portal_link: null,
                            position: { x: 300, y: 0 },
                            question: null,
                            slug: 'mocked-npc-dialogue',
                            title: 'Mocked NPC dialogue',
                            updated_at: '2026-11-14T12:34:00Z',
                        },
                    ],
                    activity_types: [],
                    ai_review_templates: [],
                    can_manage_ai_review: true,
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
    await page.route(
        `**/api/v1/admin/world-builder/activities/${npcActivityId}/npc-dialogue`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity: {
                        graph_layout: {},
                        id: npcActivityId,
                        introduction: null,
                        slug: 'mocked-npc-dialogue',
                        title: 'Mocked NPC dialogue',
                    },
                    dialogue_nodes: [
                        {
                            body: null,
                            config: { connectorSymbol: 'A' },
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d07',
                            node_type: 'end',
                            position: { x: 100, y: 40 },
                            title: 'Mocked ending',
                        },
                    ],
                    transitions: [],
                    typing_sound_sets: [],
                    world_nodes: [],
                }),
            });
        },
    );
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
    const card = page.locator('[data-id="018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d05"]');
    await expect(
        page.getByText('Localized graph arrangement guidance'),
    ).toBeVisible();
    await expect(card.getByText('Localized needs AI review')).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized activity history' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized learner orientation' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized choice context' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized scene ambience' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized feedback guidance' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized sources' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized review activity' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized edit Mocked activity' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized delete Mocked activity' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized copy Mocked activity' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized save Mocked activity' }),
    ).toBeVisible();
    await expect(
        card.getByRole('button', { name: 'Localized update Mocked activity' }),
    ).toBeVisible();
    for (const label of [
        'Localized back to map',
        'Localized open practice',
        'Localized reflection',
        'Localized review revisit',
        'Localized markdown',
        'Localized portal',
        'Localized NPC dialogue',
        'Localized item grant',
        'Localized tool grant',
        'Localized item obstacle',
        'Localized obstacle',
        'Localized question',
        'Localized shared task',
        'Localized message prompt',
        'Localized message wall',
    ]) {
        await expect(
            page.getByRole('button', { exact: true, name: label }),
        ).toBeVisible();
    }
    await page
        .locator(`[data-id="${npcActivityId}"]`)
        .getByRole('heading', { name: 'Mocked NPC dialogue' })
        .click();

    const npcDialogueCanvas = page.locator(
        '[data-wl-id="authoring.npc-dialogue.canvas"]',
    );
    await expect(
        npcDialogueCanvas.getByText('Localized NPC canvas'),
    ).toBeVisible();
    await expect(
        npcDialogueCanvas.getByRole('button', { name: 'Localized add node' }),
    ).toBeVisible();
    await expect(
        npcDialogueCanvas.getByText('Localized start', { exact: true }),
    ).toBeVisible();
    await expect(
        npcDialogueCanvas.getByText('Localized start guidance.'),
    ).toBeVisible();
    await expect(
        npcDialogueCanvas.getByText('Localized end node'),
    ).toBeVisible();
    await expect(
        npcDialogueCanvas.getByText('A localized activity output'),
    ).toBeVisible();
    await npcDialogueCanvas
        .getByRole('button', { name: 'Localized add node' })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Localized add dialogue node' }),
    ).toBeVisible();
    await expect(
        page.getByText('Localized node configuration guidance.'),
    ).toBeVisible();
    await expect(page.getByLabel('Localized node type')).toBeVisible();
    await expect(
        page.getByLabel('Localized speech bubble text'),
    ).toBeVisible();
    await expect(page.getByLabel('Localized tool grant')).toBeVisible();
    await expect(
        page.getByText('Localized scene presentation'),
    ).toBeVisible();
    await expect(page.getByText('Localized extra assets')).toBeVisible();
    await expect(page.getByText('Localized empty assets')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Localized select media' }).first(),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Localized save node' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Localized cancel' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const npcCanvasBounds = await npcDialogueCanvas.boundingBox();
    expect(npcCanvasBounds).not.toBeNull();
    expect(npcCanvasBounds!.x).toBeGreaterThanOrEqual(0);
    expect(npcCanvasBounds!.x + npcCanvasBounds!.width).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1280, height: 900 });
    await npcDialogueCanvas
        .getByRole('button', { name: 'Localized activity graph' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Localized activity templates' }),
    ).toBeVisible();

    await page
        .getByRole('button', { name: 'Localized NPC dialogue' })
        .click();

    const npcDialogueCreate = page.locator(
        '[data-wl-id="authoring.npc-dialogue.create"]',
    );
    await expect(
        npcDialogueCreate.getByRole('heading', {
            name: 'Localized new NPC dialogue',
        }),
    ).toBeVisible();
    await expect(
        npcDialogueCreate.getByText('Localized NPC creation guidance.'),
    ).toBeVisible();
    await expect(npcDialogueCreate.getByLabel('Localized title')).toHaveValue(
        'NPC dialogue',
    );
    await expect(
        npcDialogueCreate.getByLabel('Localized slug'),
    ).toBeVisible();
    await expect(
        npcDialogueCreate.getByLabel('Localized introduction'),
    ).toBeVisible();
    await expect(
        npcDialogueCreate.getByRole('button', {
            name: 'Localized create dialogue',
        }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const npcBounds = await npcDialogueCreate.boundingBox();
    expect(npcBounds).not.toBeNull();
    expect(npcBounds!.x).toBeGreaterThanOrEqual(0);
    expect(npcBounds!.x + npcBounds!.width).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1280, height: 900 });
    await npcDialogueCreate
        .getByRole('button', { name: 'Localized activity graph' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Localized activity templates' }),
    ).toBeVisible();

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
