import { expect, installE2eAdminSession, test } from './authenticated';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('an authenticated learner completes the server-owned NPC dialogue and keeps its private reflection', async ({
    page,
    request,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;
    await page.addInitScript(() => {
        const pageWindow = window as typeof window & { typingSoundPlayCalls?: number };
        pageWindow.typingSoundPlayCalls = 0;
        HTMLMediaElement.prototype.play = function play(): Promise<void> {
            pageWindow.typingSoundPlayCalls = (pageWindow.typingSoundPlayCalls ?? 0) + 1;
            return Promise.resolve();
        };
    });

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();

    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const worldDocument = await world.json();
    const start = worldDocument.start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'miras-observation',
    );
    expect(start).toBeDefined();
    const orientationStart = worldDocument.start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'find-your-place',
    );
    expect(orientationStart).toBeDefined();

    const bookmarkResponse = await request.post(
        `/api/v1/learner/maps/${start.map_slug}/nodes/${start.node_slug}/bookmark`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(bookmarkResponse.status()).toBe(200);

    const resetResponse = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(resetResponse.status()).toBe(200);

    const startResponse = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(startResponse.status()).toBe(200);
    const run = await startResponse.json();
    const basePath = `/api/v1/learner/play-runs/${run.play_run_id}/activities/miras-observation`;

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto('/home');
    await expect(page.getByText('Pinned for later')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Possible connections' })).toBeVisible();
    await expect(page.getByText('Connections need a little context')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all bookmarks' })).toHaveAttribute(
        'href',
        '/bookmarks',
    );
    await page.getByRole('button', { name: 'Focus view' }).click();
    await expect(page.getByRole('button', { name: 'Show pinned' })).toBeVisible();
    const pinnedRail = page.locator('aside').filter({ hasText: 'Pinned for later' });
    await expect(pinnedRail).toHaveCount(0);
    await page.getByRole('button', { name: 'Show pinned' }).click();
    await expect(pinnedRail).toHaveCount(1);
    await page.getByRole('button', { name: 'Continue learning' }).click();
    await expect(page).toHaveURL(/\/home\?area=continue$/);
    await expect(page.getByRole('heading', { name: 'Continue learning' })).toBeVisible();
    await page.getByText(start.label, { exact: true }).click();
    await expect(page).toHaveURL(
        new RegExp(`/learning/nodes/notice-the-map/play\\?run=${run.play_run_id}`),
    );

    let playback = await request.get(`/api/v1/learner/play-runs/${run.play_run_id}`);
    expect(playback.status()).toBe(200);
    let document = await playback.json();
    expect(document.activity).toMatchObject({
        activity_type: 'npc_dialogue',
        npc_dialogue: {
            current_node_id: expect.any(String),
            typing_sound_sets: [
                expect.objectContaining({
                    is_default: true,
                    sounds: expect.objectContaining({
                        a: expect.objectContaining({
                            url: '/sounds/dialogue-typing/letter-keyed/curious-double-blip-keyed-a.wav',
                        }),
                    }),
                }),
            ],
        },
    });

    const advance = await request.post(`${basePath}/npc-dialogue/continue`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(advance.status()).toBe(200);
    await expect(advance.json()).resolves.toMatchObject({
        granted_tool: { slug: 'dialogue-lens' },
    });

    playback = await request.get(`/api/v1/learner/play-runs/${run.play_run_id}`);
    document = await playback.json();
    const dialogue = document.activity.npc_dialogue;
    const selectedAnswer = dialogue.nodes.find(
        (node: { node_type: string; config: { answerLabel?: string } }) =>
            node.node_type === 'answer' && node.config.answerLabel === 'A',
    );
    expect(selectedAnswer).toBeDefined();
    const answer = await request.post(`${basePath}/npc-dialogue/answer`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { answer_node_id: selectedAnswer.id },
    });
    expect(answer.status()).toBe(200);

    const toReflection = await request.post(`${basePath}/npc-dialogue/continue`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(toReflection.status()).toBe(200);
    const reflection = await request.post(`${basePath}/npc-dialogue/reflection`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { reflection: 'I would compare the starting points before assuming one local cause.' },
    });
    expect(reflection.status()).toBe(200);

    const complete = await request.post(`${basePath}/complete`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: {},
    });
    expect(complete.status()).toBe(200);
    await expect(complete.json()).resolves.toMatchObject({ status: 'completed' });

    const checkIn = await request.post(`${basePath}/check-ins`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: {
            feeling: 'clearer',
            note: 'The dialogue helped me compare the starting points.',
            next_direction: 'settle',
        },
    });
    expect(checkIn.status()).toBe(200);

    await page.goto('/home');
    await page.getByRole('button', { name: 'Recent reflections' }).click();
    await expect(page).toHaveURL(/\/home\?area=reflections$/);
    await expect(page.getByRole('heading', { name: 'Recent reflections' })).toBeVisible();
    await expect(page.getByText('Something clicked')).toBeVisible();
    await expect(
        page.getByText('The dialogue helped me compare the starting points.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open activity' }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/notice-the-map\/play\?run=[0-9a-f-]{36}$/,
    );
    await expect(page.getByRole('heading', { name: "Mira's observation" })).toBeVisible();
    await expect(page.getByText('Mira asks for the clue')).toBeVisible();

    await page.goto('/home');
    const recentTraces = page.getByRole('button', { name: 'Recent traces' });
    if (await recentTraces.count()) {
        await recentTraces.click();
        await expect(page.getByRole('heading', { name: 'Recent traces' })).toBeVisible();
        await page.getByRole('button', { name: 'Revisit' }).click();
        await expect(page).toHaveURL(
            /\/learning\/nodes\/notice-the-map\/play\?run=[0-9a-f-]{36}$/,
        );
    }

    const journal = await request.get('/api/v1/learner/journal');
    expect(journal.status()).toBe(200);
    await expect(journal.json()).resolves.toMatchObject({
        pages: expect.arrayContaining([
            expect.objectContaining({
                topic: 'Orientation',
                subtopic: 'Noticing patterns',
                markdown: expect.stringContaining('compare the starting points'),
            }),
        ]),
    });

    const resetOrientation = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(resetOrientation.status()).toBe(200);
    const startOrientation = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(startOrientation.status()).toBe(200);
    const orientationRun = await startOrientation.json();
    const completeOrientation = await request.post(
        `/api/v1/learner/play-runs/${orientationRun.play_run_id}/activities/find-your-place/complete`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token }, data: {} },
    );
    expect(completeOrientation.status()).toBe(200);
    const relatedCheckIn = await request.post(
        `/api/v1/learner/play-runs/${orientationRun.play_run_id}/activities/find-your-place/check-ins`,
        {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: {
                feeling: 'forming',
                note: 'I want to connect this orientation with another idea.',
                next_direction: 'related',
            },
        },
    );
    expect(relatedCheckIn.status()).toBe(200);

    await page.goto('/home');
    await page.getByRole('button', { name: 'Recent reflections' }).click();
    await expect(page.getByText('Still taking shape')).toBeVisible();
    await expect(
        page.getByText('Explore a connected learning area:'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orientation' })).toHaveAttribute(
        'href',
        '/competence?topic=orientation&from=map-orientation',
    );

    const resetDeskRoute = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(resetDeskRoute.status()).toBe(200);
    const startDeskRoute = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(startDeskRoute.status()).toBe(200);

    await page.goto('/home');
    await page.getByRole('button', { name: 'Continue learning' }).click();
    await expect(page.getByText('Plan by learning purpose')).toBeVisible();
    const participate = page.getByRole('button', { name: 'Participate' });
    await participate.click();
    await expect(
        page.getByRole('button', { name: 'Remember these choices' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Remember these choices' }).click();
    await expect(
        page.getByText('Planning choices remembered for your account.'),
    ).toBeVisible();
    const savedPlanning = await request.get(
        '/api/v1/learner/desk-planning-preference',
    );
    expect(savedPlanning.status()).toBe(200);
    await expect(savedPlanning.json()).resolves.toMatchObject({
        is_saved: true,
        purpose_filter: 'participate',
        time_budget: 'any',
    });
    await page.reload();
    await expect(participate).toHaveAttribute('aria-pressed', 'true');

    const resetForBrowser = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(resetForBrowser.status()).toBe(200);
    const browserStart = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(browserStart.status()).toBe(200);
    const { play_run_id: browserPlayRunId } = await browserStart.json();

    await page.goto(`/learning/nodes/notice-the-map/play?run=${browserPlayRunId}`);

    await expect(page.getByText('Mira opens the observation')).toBeVisible();
    await expect(
        page.locator(
            'img[src="/images/characters/npc-mira-dark.png"], img[src="/images/characters/npc-mira-light.png"]',
        ),
    ).toBeVisible();
    await expect(
        page.locator('img[src="/images/characters/golden-lantern-page.png"]'),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Let us pause with a small observation. We are looking for what changes the next useful step.',
        ),
    ).toBeVisible();
    await expect.poll(() => page.evaluate(() => (
        window as typeof window & { typingSoundPlayCalls?: number }
    ).typingSoundPlayCalls ?? 0)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Next dialogue' }).click();
    await expect(page.getByText('Mira asks for the clue')).toBeVisible();
    await page
        .getByRole('button', {
            name: 'AThe attempts came from more than one starting point.',
        })
        .click();
    await page.getByRole('button', { name: 'Confirm answer' }).click();
    await expect(page.getByText('Pattern spread')).toBeVisible();
    await page.getByRole('button', { name: 'Next dialogue' }).click();
    await expect(page.getByText('Keep the useful clue')).toBeVisible();
    await page
        .getByPlaceholder('Write a reflection for your journal.')
        .fill('The browser scene uses the server-owned graph.');
    await page.getByRole('button', { name: 'Keep reflection' }).click();
    await expect(page.getByText('Completing dialogue…')).toBeVisible();
});
