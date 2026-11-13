import { expect, test } from '@playwright/test';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('a learner can start a source peer-message prompt and follow it into the original wall activity', async ({
    page,
    request,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    const peerNote = `I noticed the route is tied to a place on the map (${Date.now()}).`;
    test.skip(!email || !password, 'requires a disposable local identity');

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
            candidate.activity_slug === 'find-your-place',
    );
    const peerPromptStart = worldDocument.start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'share-orientation-note',
    );
    expect(start).toBeDefined();
    expect(peerPromptStart).toBeDefined();

    const resetPeerPrompt = await request.post(
        `/api/v1/learner/activity-starts/${peerPromptStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(resetPeerPrompt.status()).toBe(200);
    const startedPeerPrompt = await request.post(
        `/api/v1/learner/activity-starts/${peerPromptStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(startedPeerPrompt.status()).toBe(200);
    const directPeerPromptRun = await startedPeerPrompt.json();
    const directPeerPromptPlayback = await request.get(
        `/api/v1/learner/play-runs/${directPeerPromptRun.play_run_id}`,
    );
    expect(directPeerPromptPlayback.status()).toBe(200);
    expect(await directPeerPromptPlayback.json()).toMatchObject({
        activity: {
            activity_type: 'message_prompt',
            slug: 'share-orientation-note',
        },
    });

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto(
        `/learning/nodes/${peerPromptStart.node_slug}/play?run=${directPeerPromptRun.play_run_id}`,
    );
    await expect(page.getByText('Share an orientation note')).toBeVisible();

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(reset.status()).toBe(200);
    const started = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(started.status()).toBe(200);
    const run = await started.json();
    const base = `/api/v1/learner/play-runs/${run.play_run_id}/activities`;

    for (const activitySlug of ['find-your-place', 'name-a-landmark']) {
        const completed = await request.post(`${base}/${activitySlug}/complete`, {
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
            data: {},
        });
        expect(completed.status()).toBe(200);
    }
    const support = await request.post(`${base}/ask-learning-support/support-request`, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        data: { body: 'Please help me notice the map orientation.' },
    });
    expect(support.status()).toBe(200);
    const completedSupport = await request.post(
        `${base}/ask-learning-support/complete`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token }, data: {} },
    );
    expect(completedSupport.status()).toBe(200);

    const peerPromptPlayback = await request.get(
        `/api/v1/learner/play-runs/${run.play_run_id}`,
    );
    expect(peerPromptPlayback.status()).toBe(200);
    expect((await peerPromptPlayback.json()).activity.slug).toBe(
        'share-orientation-note',
    );

    await page.goto(
        `/learning/nodes/${start.node_slug}/play?run=${run.play_run_id}`,
    );
    await expect(page.getByText('Share an orientation note')).toBeVisible();
    await page.getByLabel('Your note').fill(peerNote);
    await page.getByRole('button', { name: 'Share and continue' }).click();

    await expect(
        page.getByRole('button', { name: 'Continue without answering' }),
    ).toBeVisible();
    const wallResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname.endsWith('/peer-wall'),
    );
    await page.getByRole('button', { name: 'Continue without answering' }).click();

    await expect(page.getByText('Orientation notes')).toBeVisible();
    const wall = await wallResponse;
    expect(wall.status()).toBe(200);
    expect(
        (await wall.json()).messages.some(
            (message: { body: string }) =>
                message.body === peerNote,
        ),
    ).toBe(true);
    await expect(
        page.locator('article:visible').filter({ hasText: peerNote }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close message wall' })).toBeVisible();

    const topics = await request.get('/api/v1/learning-support/topics');
    expect(topics.status()).toBe(200);
    const peerTopic = (await topics.json()).find(
        (topic: { title: string }) => topic.title === 'Orientation notes',
    );
    expect(peerTopic).toBeDefined();

    const moderation = await request.get(
        `/api/v1/learning-support/topics/${peerTopic.id}/messages?filter=unconfirmed&page=1&per_page=6`,
    );
    expect(moderation.status()).toBe(200);
    const moderationDocument = await moderation.json();
    expect(moderationDocument).toMatchObject({
        counts: { all: expect.any(Number), unconfirmed: expect.any(Number) },
        messages: expect.arrayContaining([
            expect.objectContaining({ audience: 'peers', body: peerNote }),
        ]),
    });
    const moderatedPeerMessage = moderationDocument.messages.find(
        (message: { body: string }) => message.body === peerNote,
    );
    expect(moderatedPeerMessage).toBeDefined();

    await page.goto(
        '/settings?panel=admin-learning-support&support=learner-messages',
    );
    await expect(
        page.getByRole('heading', { name: 'Learning Support' }),
    ).toBeVisible();
    await expect(
        page.locator('article:visible').filter({ hasText: peerNote }),
    ).toBeVisible();
    const moderationCard = page
        .locator('article:visible')
        .filter({ hasText: peerNote });
    await moderationCard.getByRole('button', { name: 'Hide' }).click();
    await expect(moderationCard.getByText('Hidden from learners')).toBeVisible();

    const hiddenWall = await request.get(
        `${base}/explore-peer-wall/peer-wall?page=1&per_page=10`,
    );
    expect(hiddenWall.status()).toBe(200);
    expect(
        (await hiddenWall.json()).messages.some(
            (message: { body: string }) => message.body === peerNote,
        ),
    ).toBe(false);

    await moderationCard.getByRole('button', { name: 'Show' }).click();
    await expect(
        moderationCard.getByText('Hidden from learners'),
    ).not.toBeVisible();
});
