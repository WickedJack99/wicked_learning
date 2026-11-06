import { expect, test } from '@playwright/test';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('an authenticated learner completes the server-owned NPC dialogue and keeps its private reflection', async ({
    page,
    request,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local identity');

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const login = await request.post('/api/v1/session/login', {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { email, password },
    });
    expect(login.status()).toBe(200);

    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const worldDocument = await world.json();
    const start = worldDocument.start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'miras-observation',
    );
    expect(start).toBeDefined();

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

    let playback = await request.get(`/api/v1/learner/play-runs/${run.play_run_id}`);
    expect(playback.status()).toBe(200);
    let document = await playback.json();
    expect(document.activity).toMatchObject({
        activity_type: 'npc_dialogue',
        npc_dialogue: { current_node_id: expect.any(String) },
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

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto(`/learning/nodes/notice-the-map/play?run=${browserPlayRunId}`);

    await expect(page.getByText('Mira opens the observation')).toBeVisible();
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
