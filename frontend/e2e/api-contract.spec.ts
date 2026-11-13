import { expect, installE2eAdminSession, test } from './authenticated';

test.describe.configure({ mode: 'serial' });

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('the public-page endpoint returns the contracted resource and missing-resource problem', async ({
    request,
}) => {
    const pageResponse = await request.get('/api/v1/public/pages/about');

    expect(pageResponse.status()).toBe(200);
    expect(pageResponse.headers()['content-type']).toContain(
        'application/json',
    );
    await expect(pageResponse.json()).resolves.toMatchObject({
        slug: 'about',
        title: 'About Wicked Learning',
        body: expect.stringContaining('curiosity'),
    });

    const imprintResponse = await request.get('/api/v1/public/pages/imprint');

    expect(imprintResponse.status()).toBe(200);
    await expect(imprintResponse.json()).resolves.toMatchObject({
        slug: 'imprint',
        title: 'Imprint',
        body: expect.stringContaining(
            'deployment-specific publisher information',
        ),
    });

    const dataProtectionResponse = await request.get(
        '/api/v1/public/pages/data-protection',
    );

    expect(dataProtectionResponse.status()).toBe(200);
    await expect(dataProtectionResponse.json()).resolves.toMatchObject({
        slug: 'data-protection',
        title: 'Data Protection',
        body: expect.stringContaining(
            'privacy and data protection information',
        ),
    });

    const missingResponse = await request.get(
        '/api/v1/public/pages/not-published',
    );

    expect(missingResponse.status()).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
        code: 'not_found',
        title: 'The requested resource was not found.',
    });
});

test('the public source-links endpoint returns only browser-safe link data', async ({
    request,
}) => {
    const response = await request.get('/api/v1/public/source-links');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({
        origin: {
            label: 'Original project',
            url: 'https://github.com/WickedJack99/wicked_learning',
        },
        modified_sources: [],
    });
});

test('the public-presentation endpoint returns the source-derived browser shell model', async ({
    request,
}) => {
    const response = await request.get('/api/v1/public/presentation');

    expect(response.status()).toBe(200);
    const presentation = await response.json();

    expect(presentation).toMatchObject({
        branding: { logo: '/images/logo.png' },
        cursors: {
            default: {
                fallback: 'default',
                hotspot_x: 4,
                hotspot_y: 4,
                image: '/images/cursors/fantasy-cursor.png',
                size: 32,
            },
        },
        auth: {
            login: {
                dark: {
                    background_color: '#07111f',
                    background_image: null,
                    input_background: 'rgba(2, 6, 23, 0.36)',
                },
                light: {
                    background_color: '#ecfeff',
                    input_background: 'rgba(255, 255, 255, 0.7)',
                },
            },
            register: {
                dark: {
                    background_color: '#07111f',
                    background_image: null,
                },
            },
        },
        public_palette: {
            dark: { accent_text: '#5eead4', welcome_overlay_opacity: 62 },
            light: { accent_text: '#0891b2', welcome_overlay_opacity: 72 },
        },
    });
    expect(presentation.welcome.pages).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                eyebrow: 'Explorable learning platform',
                title: 'Learning Worlds',
                buttons: expect.arrayContaining([
                    { text: 'Enter the first world', target: '/world' },
                ]),
            }),
        ]),
    );
    expect(presentation.information_pages).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                slug: 'about',
                title: 'About Wicked Learning',
                body: expect.stringContaining('curiosity'),
                backgrounds: { dark: null, light: null },
            }),
        ]),
    );
});

test('the public world endpoint returns a bounded fresh exploration graph', async ({
    request,
}) => {
    const response = await request.get('/api/v1/public/world');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
        slug: 'orientation-garden',
        title: 'Orientation Garden',
        theme_config: {},
        maps: [
            {
                slug: 'first-path',
                title: 'The First Path',
                background_config: {
                    accentColor: '#5eead4',
                    pageBackground: '#0b1117',
                },
                grid_config: { tileWidth: 96, tileHeight: 84, gap: 8 },
                map_assets_locked: false,
                assets: [
                    {
                        slug: 'notice-the-map',
                        interaction_mode: 'focusable',
                        z: 0,
                        locked: false,
                        sound_config: {},
                        visual_config: { tileColor: '#0e7490' },
                    },
                    {
                        slug: 'choose-a-direction',
                        interaction_mode: 'focusable',
                        z: 1,
                        visual_config: { tileColor: '#0e7490' },
                    },
                ],
                nodes: [
                    {
                        asset_slug: 'notice-the-map',
                        slug: 'notice-the-map',
                        q: 0,
                        r: 0,
                        state: 'available',
                        visual_config: { icon: 'map' },
                    },
                    {
                        asset_slug: 'choose-a-direction',
                        slug: 'choose-a-direction',
                        q: 2,
                        r: 1,
                        state: 'available',
                        visual_config: { icon: 'signpost' },
                    },
                ],
            },
        ],
    });
});

test('a public map place exposes only its bounded published route previews', async ({
    request,
}) => {
    const response = await request.get(
        '/api/v1/public/worlds/orientation-garden/maps/first-path/assets/choose-a-direction',
    );

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({
        world_slug: 'orientation-garden',
        world_title: 'Orientation Garden',
        map_slug: 'first-path',
        map_title: 'The First Path',
        slug: 'choose-a-direction',
        title: 'Choose a direction',
        description:
            'A learner can choose a useful next direction without pressure or hidden ranking.',
        routes: [
            {
                slug: 'choose-your-next-step',
                title: 'Choose your next step',
                description:
                    'A short route for considering a useful direction without a prescribed order.',
                activity_count: 2,
            },
        ],
    });

    const missingResponse = await request.get(
        '/api/v1/public/worlds/orientation-garden/maps/first-path/assets/not-published',
    );
    expect(missingResponse.status()).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
        code: 'not_found',
        title: 'The requested resource was not found.',
    });
});

test('a public route exposes only its bounded published activity outline', async ({
    request,
}) => {
    const response = await request.get(
        '/api/v1/public/worlds/orientation-garden/maps/first-path/assets/choose-a-direction/routes/choose-your-next-step',
    );

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({
        world_slug: 'orientation-garden',
        world_title: 'Orientation Garden',
        map_slug: 'first-path',
        map_title: 'The First Path',
        asset_slug: 'choose-a-direction',
        asset_title: 'Choose a direction',
        slug: 'choose-your-next-step',
        title: 'Choose your next step',
        description:
            'A short route for considering a useful direction without a prescribed order.',
        activities: [
            {
                slug: 'consider-a-direction',
                title: 'Consider a direction',
                description:
                    'Compare available directions without ranking them or creating urgency.',
            },
            {
                slug: 'reflect-on-direction',
                title: 'Connect the direction',
                description:
                    'Keep a private note about what feels useful to explore next.',
            },
        ],
    });

    const missingResponse = await request.get(
        '/api/v1/public/worlds/orientation-garden/maps/first-path/assets/choose-a-direction/routes/not-published',
    );
    expect(missingResponse.status()).toBe(404);
});

test('public search returns only published map places and validates its query', async ({
    request,
}) => {
    const response = await request.get('/api/v1/public/search?q=direction');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({
        query: 'direction',
        results: [
            {
                world_slug: 'orientation-garden',
                map_slug: 'first-path',
                map_title: 'The First Path',
                asset_slug: 'choose-a-direction',
                title: 'Choose a direction',
                description:
                    'A learner can choose a useful next direction without pressure or hidden ranking.',
            },
        ],
    });

    const invalidQuery = await request.get('/api/v1/public/search?q=x');
    expect(invalidQuery.status()).toBe(400);
    await expect(invalidQuery.json()).resolves.toEqual({
        code: 'invalid_request',
        title: 'The request is not valid.',
    });
});

test('an anonymous session reveals no credential or identity material', async ({
    request,
}) => {
    const response = await request.get('/api/v1/session');

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({
        authenticated: false,
        subject_id: null,
    });

    const currentUserResponse = await request.get('/api/v1/me');
    expect(currentUserResponse.status()).toBe(401);
    await expect(currentUserResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerWorldResponse = await request.get('/api/v1/learner/world');
    expect(learnerWorldResponse.status()).toBe(401);
    await expect(learnerWorldResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerBookmarkMapResponse = await request.get(
        '/api/v1/learner/bookmarks',
    );
    expect(learnerBookmarkMapResponse.status()).toBe(401);
    await expect(learnerBookmarkMapResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerCompetenceResponse = await request.get(
        '/api/v1/learner/competence',
    );
    expect(learnerCompetenceResponse.status()).toBe(401);
    await expect(learnerCompetenceResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerTopicDirectoryResponse = await request.get(
        '/api/v1/learner/topics',
    );
    expect(learnerTopicDirectoryResponse.status()).toBe(401);
    await expect(learnerTopicDirectoryResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerTopicOverviewResponse = await request.get(
        '/api/v1/learner/topics/map-orientation/overview',
    );
    expect(learnerTopicOverviewResponse.status()).toBe(401);
    await expect(learnerTopicOverviewResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerTopicTrailResponse = await request.get(
        '/api/v1/learner/topics/map-orientation/trail',
    );
    expect(learnerTopicTrailResponse.status()).toBe(401);
    await expect(learnerTopicTrailResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerTopicMapsResponse = await request.get(
        '/api/v1/learner/topics/map-orientation/maps',
    );
    expect(learnerTopicMapsResponse.status()).toBe(401);
    await expect(learnerTopicMapsResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const learnerJournalResponse = await request.get('/api/v1/learner/journal');
    expect(learnerJournalResponse.status()).toBe(401);
    await expect(learnerJournalResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const journalCreateResponse = await request.post(
        '/api/v1/learner/journal/pages',
        {
            data: { title: 'Unauthenticated page', topic: 'General' },
            headers: { Origin: publicOrigin },
        },
    );
    expect(journalCreateResponse.status()).toBe(401);
    await expect(journalCreateResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const bookmarkResponse = await request.post(
        '/api/v1/learner/maps/first-path/nodes/choose-a-direction/bookmark',
        { headers: { Origin: publicOrigin } },
    );
    expect(bookmarkResponse.status()).toBe(401);
    await expect(bookmarkResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const routeStartResponse = await request.post(
        '/api/v1/learner/activity-starts/00000000-0000-4000-8000-000000000000/start',
        { headers: { Origin: publicOrigin } },
    );
    expect(routeStartResponse.status()).toBe(401);
    await expect(routeStartResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const playbackResponse = await request.get(
        '/api/v1/learner/play-runs/00000000-0000-4000-8000-000000000000',
    );
    expect(playbackResponse.status()).toBe(401);
    await expect(playbackResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });

    const completePlaybackResponse = await request.post(
        '/api/v1/learner/play-runs/00000000-0000-4000-8000-000000000000/activities/open-practice/complete',
        { headers: { Origin: publicOrigin } },
    );
    expect(completePlaybackResponse.status()).toBe(401);
    await expect(completePlaybackResponse.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('a private activity check-in requires an authenticated owner and never accepts a bare activity writer', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/activities/consider-a-direction/check-ins',
        {
            data: {
                feeling: 'forming',
                next_direction: 'revisit',
                note: 'I want to return to this after a pause.',
            },
        },
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('a private revisit invitation action requires its authenticated owner', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/revisit-invitations/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
        { data: { action: 'snooze' } },
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('a historical activity replay requires an authenticated owner', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/activities/consider-a-direction/replay',
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('learner paths require an authenticated application principal', async ({
    request,
}) => {
    const response = await request.get('/api/v1/learner/paths');

    expect(response.status()).toBe(401);
});

test('a local administrator receives the complete source-shaped selected-map support data', async ({
    page,
    request,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local administrator',
    );

    const anonymous = await request.get('/api/v1/admin/world-builder');
    expect(anonymous.status()).toBe(401);
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrfResponse = await request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json();

    const graphResponse = await request.get('/api/v1/admin/world-builder');
    expect(graphResponse.status()).toBe(200);
    const graph = await graphResponse.json();
    expect(graph.maps).not.toHaveLength(0);

    const mapResponse = await request.get(
        `/api/v1/admin/world-builder/maps/${graph.maps[0].id}`,
    );
    expect(mapResponse.status()).toBe(200);
    await expect(mapResponse.json()).resolves.toMatchObject({
        access_groups: expect.arrayContaining([
            {
                slug: 'public',
                label: 'Public',
                description: expect.stringContaining('without logging in'),
            },
        ]),
        editable_map: expect.objectContaining({
            map: expect.objectContaining({ id: graph.maps[0].id }),
        }),
        items: expect.any(Array),
        learning_groups: expect.any(Array),
        role_options: expect.any(Array),
        topic_options: expect.any(Array),
        tools: expect.any(Array),
    });
});

test('a local administrator receives the source-shaped selected-node activity graph', async ({
    page,
    request,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local administrator',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrfResponse = await request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json();

    const graphResponse = await request.get('/api/v1/admin/world-builder');
    expect(graphResponse.status()).toBe(200);
    const graph = await graphResponse.json();
    const nodeId = graph.maps
        .flatMap((map: { nodes: Array<{ id: string }> }) => map.nodes)
        .at(0)?.id;
    expect(nodeId).toBeDefined();
    if (!nodeId) {
        throw new Error('the local World Builder graph has no readable node');
    }

    const nodeResponse = await request.get(
        `/api/v1/admin/world-builder/nodes/${nodeId}`,
    );
    expect(nodeResponse.status()).toBe(200);
    await expect(nodeResponse.json()).resolves.toMatchObject({
        activity_graph: {
            activities: expect.any(Array),
            activity_types: expect.any(Array),
            can_manage_ai_review: expect.any(Boolean),
            message_topics: expect.any(Array),
            node: expect.objectContaining({
                id: nodeId,
                start_routes: expect.any(Array),
            }),
            portal_candidates: expect.any(Array),
            source_records: expect.objectContaining({
                items: expect.any(Array),
                pagination: expect.any(Object),
            }),
            transitions: expect.any(Array),
        },
        items: expect.any(Array),
        sounds: expect.any(Array),
        tools: expect.any(Array),
    });
});

test('Learning Desk content search requires an authenticated application principal', async ({
    request,
}) => {
    const response = await request.get('/api/v1/learner/search?query=map');

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('a CI-only fresh identity receives source-ordered Learning Desk search results', async ({
    page,
    request,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable CI identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrfResponse = await request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json();

    const response = await request.get('/api/v1/learner/search?query=map');
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
        pagination: { current_page: 1, last_page: 1, per_page: 5 },
        results: expect.arrayContaining([
            expect.objectContaining({
                href: '/topics/map-orientation',
                id: expect.stringMatching(/^topic:[0-9a-f-]{36}$/),
                kind: 'topic',
                map_slug: null,
                node_slug: null,
                subtitle: 'Topic',
                title: 'Map orientation',
            }),
        ]),
    });
});

test('a CI-only fresh identity can submit its one private Learning Support request', async ({
    request,
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    test.skip(
        !email || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable CI identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrfResponse = await request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json();

    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const worldDocument = await world.json();
    const orientationStart = worldDocument.start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'find-your-place',
    );
    expect(orientationStart).toBeDefined();

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(reset.status()).toBe(200);
    const run = await reset.json();
    const activityPath = `/api/v1/learner/play-runs/${run.play_run_id}/activities`;

    for (const activitySlug of ['find-your-place', 'name-a-landmark']) {
        const completion = await request.post(
            `${activityPath}/${activitySlug}/complete`,
            { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
        );
        expect(completion.status()).toBe(200);
        await expect(completion.json()).resolves.toMatchObject({
            status: 'in_progress',
        });
    }

    const playback = await request.get(`/api/v1/learner/play-runs/${run.play_run_id}`);
    expect(playback.status()).toBe(200);
    await expect(playback.json()).resolves.toMatchObject({
        activity: {
            activity_type: 'message_prompt',
            slug: 'ask-learning-support',
        },
    });

    const requestPath = `${activityPath}/ask-learning-support/support-request`;
    const before = await request.get(requestPath);
    expect(before.status()).toBe(200);
    await expect(before.json()).resolves.toMatchObject({
        has_contributed: false,
        message: null,
        topic_title: 'Orientation support',
    });

    const submission = await request.post(requestPath, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { body: 'Could you help me notice the useful map details?' },
    });
    expect(submission.status()).toBe(200);
    await expect(submission.json()).resolves.toMatchObject({
        has_contributed: true,
        message: {
            body: 'Could you help me notice the useful map details?',
            responses: [],
        },
    });

    const repeat = await request.post(requestPath, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { body: 'This replacement must not be stored.' },
    });
    expect(repeat.status()).toBe(200);
    await expect(repeat.json()).resolves.toMatchObject({
        message: { body: 'Could you help me notice the useful map details?' },
    });

    const topics = await request.get('/api/v1/learning-support/topics');
    expect(topics.status()).toBe(200);
    const topicList = (await topics.json()) as Array<{
        id: string;
        title: string;
    }>;
    const supportTopic = topicList.find(
        (candidate) => candidate.title === 'Orientation support',
    );
    expect(supportTopic).toBeDefined();

    const moderation = await request.get(
        `/api/v1/learning-support/topics/${supportTopic!.id}/requests`,
    );
    expect(moderation.status()).toBe(200);
    const moderationDocument = (await moderation.json()) as {
        requests: Array<{
            author: { email: string };
            body: string;
            id: string;
        }>;
    };
    const submittedRequest = moderationDocument.requests.find(
        (candidate) =>
            candidate.body ===
            'Could you help me notice the useful map details?',
    );
    expect(submittedRequest).toMatchObject({ author: { email } });

    const staffReply = await request.post(
        `/api/v1/learning-support/messages/${submittedRequest!.id}/responses`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: { body: 'Look for the landmarks that make the map easier to revisit.' },
        },
    );
    expect(staffReply.status()).toBe(201);
    await expect(staffReply.json()).resolves.toMatchObject({
        response: {
            body: 'Look for the landmarks that make the map easier to revisit.',
            author: { email },
        },
    });

    const updatedStaffReply = await request.post(
        `/api/v1/learning-support/messages/${submittedRequest!.id}/responses`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: { body: 'Look for one landmark that will make this map easier to revisit.' },
        },
    );
    expect(updatedStaffReply.status()).toBe(200);
    const updatedStaffReplyDocument = (await updatedStaffReply.json()) as {
        response: { id: string };
    };

    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto(
        '/settings?panel=admin-learning-support&support=learner-messages',
    );
    await expect(
        page.getByRole('heading', { name: 'Learning Support' }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: /Orientation support/ })
        .click();
    await expect(
        page.getByText('The First Path · Orientation support', { exact: true }),
    ).toBeVisible();
    await expect(
        page
            .getByText('Could you help me notice the useful map details?')
            .first(),
    ).toBeVisible();

    const learnerView = await request.get(requestPath);
    expect(learnerView.status()).toBe(200);
    await expect(learnerView.json()).resolves.toMatchObject({
        message: {
            responses: [
                {
                    body: 'Look for one landmark that will make this map easier to revisit.',
                },
            ],
        },
    });

    const hideReply = await request.patch(
        `/api/v1/learning-support/responses/${updatedStaffReplyDocument.response.id}/visibility`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: { hidden: true },
        },
    );
    expect(hideReply.status()).toBe(204);

    const learnerViewWithHiddenReply = await request.get(requestPath);
    expect(learnerViewWithHiddenReply.status()).toBe(200);
    await expect(learnerViewWithHiddenReply.json()).resolves.toMatchObject({
        has_contributed: true,
        message: { responses: [] },
    });

    const restoreReply = await request.patch(
        `/api/v1/learning-support/responses/${updatedStaffReplyDocument.response.id}/visibility`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: { hidden: false },
        },
    );
    expect(restoreReply.status()).toBe(204);

    const hideRequest = await request.patch(
        `/api/v1/learning-support/messages/${submittedRequest!.id}/visibility`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: { hidden: true },
        },
    );
    expect(hideRequest.status()).toBe(204);

    const learnerViewWithHiddenRequest = await request.get(requestPath);
    expect(learnerViewWithHiddenRequest.status()).toBe(200);
    await expect(learnerViewWithHiddenRequest.json()).resolves.toMatchObject({
        has_contributed: true,
        message: null,
    });

    const restoreRequest = await request.patch(
        `/api/v1/learning-support/messages/${submittedRequest!.id}/visibility`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: { hidden: false },
        },
    );
    expect(restoreRequest.status()).toBe(204);

    const restoredLearnerView = await request.get(requestPath);
    expect(restoredLearnerView.status()).toBe(200);
    await expect(restoredLearnerView.json()).resolves.toMatchObject({
        has_contributed: true,
        message: {
            body: 'Could you help me notice the useful map details?',
            responses: [
                {
                    body: 'Look for one landmark that will make this map easier to revisit.',
                },
            ],
        },
    });

    const completion = await request.post(
        `${activityPath}/ask-learning-support/complete`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(completion.status()).toBe(200);
    await expect(completion.json()).resolves.toMatchObject({
        status: 'in_progress',
    });
    const peerPromptPlayback = await request.get(
        `/api/v1/learner/play-runs/${run.play_run_id}`,
    );
    expect(peerPromptPlayback.status()).toBe(200);
    await expect(peerPromptPlayback.json()).resolves.toMatchObject({
        activity: { slug: 'share-orientation-note' },
    });

    const deleteReply = await request.delete(
        `/api/v1/learning-support/responses/${updatedStaffReplyDocument.response.id}`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(deleteReply.status()).toBe(204);

    const moderationWithoutReply = await request.get(
        `/api/v1/learning-support/topics/${supportTopic!.id}/requests`,
    );
    expect(moderationWithoutReply.status()).toBe(200);
    await expect(moderationWithoutReply.json()).resolves.toMatchObject({
        requests: expect.arrayContaining([
            expect.objectContaining({
                id: submittedRequest!.id,
                responses: [],
            }),
        ]),
    });

    const deleteRequest = await request.delete(
        `/api/v1/learning-support/messages/${submittedRequest!.id}`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(deleteRequest.status()).toBe(204);

    const moderationWithoutRequest = await request.get(
        `/api/v1/learning-support/topics/${supportTopic!.id}/requests`,
    );
    expect(moderationWithoutRequest.status()).toBe(200);
    const moderationWithoutRequestDocument = (await moderationWithoutRequest.json()) as {
        requests: Array<{ id: string }>;
    };
    expect(
        moderationWithoutRequestDocument.requests.some(
            (candidate) => candidate.id === submittedRequest!.id,
        ),
    ).toBe(false);
});

test('using a learner tool requires an authenticated application principal', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/maps/first-path/nodes/hidden-place/use-tool',
        { data: { tool_slug: 'magnifier' } },
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('claiming a configured tool requires an authenticated active learner run', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/activities/receive-magnifier/grant-tool',
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('rolling configured items requires an authenticated active learner run', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/activities/receive-portal-key/grant-items',
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('placing an item in an obstacle requires an authenticated active learner run', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/activities/unlock-the-gate/item-obstacle-slots/0',
        { data: { item_slug: 'portal-key' } },
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('continuing an item obstacle requires an authenticated active learner run', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/activities/unlock-the-gate/item-obstacle/continue',
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('using an obstacle tool requires an authenticated active learner run', async ({
    request,
}) => {
    const response = await request.post(
        '/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/activities/clear-the-gate/use-obstacle-tool',
        { data: { tool_slug: 'hammer' } },
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({
        code: 'authentication_required',
        title: 'Authentication is required.',
    });
});

test('the CSRF foundation issues a non-cacheable token and protected cookie', async ({
    request,
}) => {
    const response = await request.get('/api/v1/security/csrf');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['set-cookie']).toContain('wicked_learning_csrf=');
    expect(response.headers()['set-cookie']).toContain('HttpOnly');
    expect(response.headers()['set-cookie']).toContain('SameSite=Strict');
    await expect(response.json()).resolves.toMatchObject({
        token: expect.stringMatching(/^[A-Za-z0-9+/]+={0,2}$/),
    });
});

test('a CI-only fresh identity can login, report its session, and logout', async ({
    request,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable CI identity');

    const csrfResponse = await request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json();
    const login = await request.post('/api/v1/session/login', {
        headers: {
            Origin: publicOrigin,
            'X-CSRF-Token': token,
        },
        data: { email, password },
    });

    expect(login.status()).toBe(200);
    const session = await login.json();
    expect(session).toMatchObject({
        authenticated: true,
        subject_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });

    const currentSession = await request.get('/api/v1/session');
    await expect(currentSession.json()).resolves.toEqual(session);

    const currentUser = await request.get('/api/v1/me');
    expect(currentUser.status()).toBe(200);
    await expect(currentUser.json()).resolves.toEqual({
        appearance: 'light',
        email,
        subject_id: session.subject_id,
        roles: ['platform_administrator'],
    });

    const topicDirectory = await request.get('/api/v1/learner/topics');
    expect(topicDirectory.status()).toBe(200);
    await expect(topicDirectory.json()).resolves.toMatchObject({
        areas: [{ slug: 'orientation', title: 'Orientation' }],
        pagination: { per_page: 6, total: 1 },
        selected_area: {
            slug: 'orientation',
            topics: [
                {
                    href: '/topics/map-orientation',
                    map_count: 1,
                    slug: 'map-orientation',
                    title: 'Map orientation',
                },
            ],
        },
    });

    const topicOverview = await request.get(
        '/api/v1/learner/topics/map-orientation/overview',
    );
    expect(topicOverview.status()).toBe(200);
    await expect(topicOverview.json()).resolves.toMatchObject({
        subtopics: [],
        subtopics_pagination: { per_page: 4, total: 0 },
        topic: {
            area_slug: 'orientation',
            slug: 'map-orientation',
            title: 'Map orientation',
        },
    });

    const topicMaps = await request.get(
        '/api/v1/learner/topics/map-orientation/maps',
    );
    expect(topicMaps.status()).toBe(200);
    await expect(topicMaps.json()).resolves.toMatchObject({
        maps: [
            {
                href: '/world?map=first-path',
                node_count: 2,
                slug: 'first-path',
                title: 'The First Path',
            },
        ],
        maps_pagination: { per_page: 4, total: 1 },
        topic: { slug: 'map-orientation' },
    });

    const topicPaths = await request.get(
        '/api/v1/learner/paths?topic=map-orientation',
    );
    expect(topicPaths.status()).toBe(200);
    await expect(topicPaths.json()).resolves.toMatchObject({
        topic_context: {
            area_slug: 'orientation',
            slug: 'map-orientation',
            title: 'Map orientation',
        },
        paths: expect.arrayContaining([
            expect.objectContaining({
                node_slug: expect.stringMatching(/^[a-z0-9-]+$/),
                start_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            }),
        ]),
    });

    const learnerCompetence = await request.get('/api/v1/learner/competence');
    expect(learnerCompetence.status()).toBe(200);
    await expect(learnerCompetence.json()).resolves.toMatchObject({
        month_key: expect.stringMatching(/^\d{4}-\d{2}$/),
        recent_window_days: 30,
        topics: [],
        transitions: [],
    });

    const learnerWorld = await request.get('/api/v1/learner/world');
    expect(learnerWorld.status()).toBe(200);
    const learnerWorldSnapshot = (await learnerWorld.json()) as {
        start_routes: Array<{ start_id: string }>;
    };
    const firstStart = learnerWorldSnapshot.start_routes[0];
    expect(firstStart).toBeDefined();
    if (!firstStart) {
        throw new Error(
            'the disposable learner needs one published activity start',
        );
    }

    const start = await request.post(
        `/api/v1/learner/activity-starts/${firstStart.start_id}/start`,
        {
            headers: {
                Origin: publicOrigin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(start.status()).toBe(200);
    const firstRun = (await start.json()) as {
        play_run_id: string;
        reset_count: number;
        status: string;
    };
    expect(firstRun).toMatchObject({
        play_run_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        reset_count: expect.any(Number),
        status: 'in_progress',
    });

    const playback = await request.get(
        `/api/v1/learner/play-runs/${firstRun.play_run_id}`,
    );
    expect(playback.status()).toBe(200);
    const playbackDocument = (await playback.json()) as {
        activity: {
            slug: string;
            completion: {
                label: string | null;
                next_activity_slug: string | null;
            };
        };
    };
    expect(playbackDocument).toMatchObject({
        start_id: firstStart.start_id,
        play_run_id: firstRun.play_run_id,
        activity: {
            slug: expect.any(String),
            title: expect.any(String),
            description: expect.any(String),
            activity_type: 'open_practice',
            config: {
                nextStep: expect.any(String),
            },
            completion: {},
        },
    });
    expect(
        playbackDocument.activity.completion.label === null ||
            typeof playbackDocument.activity.completion.label === 'string',
    ).toBe(true);
    expect(
        playbackDocument.activity.completion.next_activity_slug === null ||
            typeof playbackDocument.activity.completion.next_activity_slug ===
                'string',
    ).toBe(true);

    const unknownPlayback = await request.get(
        '/api/v1/learner/play-runs/00000000-0000-4000-8000-000000000000',
    );
    expect(unknownPlayback.status()).toBe(404);

    const resumed = await request.post(
        `/api/v1/learner/activity-starts/${firstStart.start_id}/start`,
        {
            headers: {
                Origin: publicOrigin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(resumed.status()).toBe(200);
    await expect(resumed.json()).resolves.toMatchObject({
        play_run_id: firstRun.play_run_id,
    });

    const completion = await request.post(
        `/api/v1/learner/play-runs/${firstRun.play_run_id}/activities/${playbackDocument.activity.slug}/complete`,
        {
            headers: {
                Origin: publicOrigin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(completion.status()).toBe(200);
    const completionResult = (await completion.json()) as {
        play_run_id: string;
        status: 'completed' | 'in_progress';
    };
    expect(completionResult.play_run_id).toBe(firstRun.play_run_id);
    expect(['completed', 'in_progress']).toContain(completionResult.status);

    const playbackAfterCompletion = await request.get(
        `/api/v1/learner/play-runs/${firstRun.play_run_id}`,
    );
    if (completionResult.status === 'in_progress') {
        expect(
            playbackDocument.activity.completion.next_activity_slug,
        ).not.toBeNull();
        expect(playbackAfterCompletion.status()).toBe(200);
        await expect(playbackAfterCompletion.json()).resolves.toMatchObject({
            activity: {
                slug: playbackDocument.activity.completion.next_activity_slug,
            },
        });
    } else {
        expect(playbackAfterCompletion.status()).toBe(404);
    }

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${firstStart.start_id}/reset`,
        {
            headers: {
                Origin: publicOrigin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(reset.status()).toBe(200);
    const resetRun = (await reset.json()) as {
        play_run_id: string;
        reset_count: number;
        status: string;
    };
    expect(resetRun).toMatchObject({
        reset_count: firstRun.reset_count + 1,
        status: 'in_progress',
    });
    expect(resetRun.play_run_id).not.toBe(firstRun.play_run_id);

    const logout = await request.post('/api/v1/session/logout', {
        headers: {
            Origin: publicOrigin,
            'X-CSRF-Token': token,
        },
    });
    expect(logout.status()).toBe(204);

    const loggedOutSession = await request.get('/api/v1/session');
    await expect(loggedOutSession.json()).resolves.toEqual({
        authenticated: false,
        subject_id: null,
    });
});

test('unsafe browser requests require same-origin CSRF and login returns generic invalid credentials', async ({
    request,
}) => {
    const csrfResponse = await request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json();
    const body = {
        email: 'nobody@example.test',
        password: 'not-a-real-password',
    };

    const missingToken = await request.post('/api/v1/session/logout', {
        headers: { Origin: publicOrigin },
    });
    expect(missingToken.status()).toBe(403);

    const foreignOrigin = await request.post('/api/v1/session/logout', {
        headers: {
            Origin: 'https://untrusted.example',
            'X-CSRF-Token': token,
        },
    });
    expect(foreignOrigin.status()).toBe(403);

    const invalidCredentials = await request.post('/api/v1/session/login', {
        headers: {
            Origin: publicOrigin,
            'X-CSRF-Token': token,
        },
        data: body,
    });
    expect(invalidCredentials.status()).toBe(401);
    await expect(invalidCredentials.json()).resolves.toEqual({
        code: 'invalid_credentials',
        title: 'The email address or password is not valid.',
    });
});

test('the same-origin entry point has the required browser security headers', async ({
    request,
}) => {
    const response = await request.get('/about');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-security-policy']).toContain(
        "default-src 'self'",
    );
    expect(response.headers()['content-security-policy']).toContain(
        "frame-ancestors 'none'",
    );
    expect(response.headers()['cross-origin-opener-policy']).toBe(
        'same-origin',
    );
    expect(response.headers()['cross-origin-resource-policy']).toBe(
        'same-origin',
    );
    expect(response.headers()['referrer-policy']).toBe(
        'strict-origin-when-cross-origin',
    );
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['x-frame-options']).toBe('DENY');
});
