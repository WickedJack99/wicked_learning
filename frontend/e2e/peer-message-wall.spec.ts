import { expect, installE2eAdminSession, test } from './authenticated';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('a learner can start a source peer-message prompt and follow it into the original wall activity', async ({
    page,
    request,
}) => {
    const peerNote = `I noticed the route is tied to a place on the map (${Date.now()}).`;
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires a disposable local identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const requestHeaders = {
        Origin: publicOrigin,
        'X-CSRF-Token': token,
    };
    const testMessagePrefixes = [
        'I noticed the route is tied to a place on the map (',
        'A peer orientation note (',
    ];
    const removePriorTestMessages = async () => {
        const topics = await request.get('/api/v1/learning-support/topics');
        expect(topics.status()).toBe(200);
        const peerTopic = (await topics.json()).find(
            (topic: { title: string }) => topic.title === 'Orientation notes',
        );
        if (!peerTopic) {
            return;
        }

        for (let pageNumber = 1; ; pageNumber += 1) {
            const messages = await request.get(
                `/api/v1/learning-support/topics/${peerTopic.id}/messages?filter=all&page=${pageNumber}&per_page=12`,
            );
            if (messages.status() === 404) {
                break;
            }
            expect(messages.status()).toBe(200);
            const document = (await messages.json()) as {
                messages: Array<{ body: string; id: string }>;
                pagination: { last_page: number };
            };
            for (const message of document.messages.filter((candidate) =>
                testMessagePrefixes.some((prefix) =>
                    candidate.body.startsWith(prefix),
                ),
            )) {
                const deleted = await request.delete(
                    `/api/v1/learning-support/messages/${message.id}`,
                    { headers: requestHeaders },
                );
                expect(deleted.status()).toBe(204);
            }
            if (pageNumber >= document.pagination.last_page) {
                break;
            }
        }
    };
    await removePriorTestMessages();
    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const worldDocument = await world.json();
    const start = worldDocument.start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'find-your-place',
    );
    expect(start).toBeDefined();

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/reset`,
        { headers: requestHeaders },
    );
    expect(reset.status()).toBe(200);
    const started = await request.post(
        `/api/v1/learner/activity-starts/${start.start_id}/start`,
        { headers: requestHeaders },
    );
    expect(started.status()).toBe(200);
    const run = await started.json();
    const base = `/api/v1/learner/play-runs/${run.play_run_id}/activities`;

    for (const activitySlug of ['find-your-place', 'name-a-landmark']) {
        const completed = await request.post(
            `${base}/${activitySlug}/complete`,
            {
                headers: requestHeaders,
                data: {},
            },
        );
        expect(completed.status()).toBe(200);
    }
    const support = await request.post(
        `${base}/ask-learning-support/support-request`,
        {
            headers: requestHeaders,
            data: { body: 'Please help me notice the map orientation.' },
        },
    );
    expect(support.status()).toBe(200);
    const completedSupport = await request.post(
        `${base}/ask-learning-support/complete`,
        { headers: requestHeaders, data: {} },
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
    const wallResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname.endsWith('/peer-wall'),
    );
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();

    await expect(page.getByText('Orientation notes')).toBeVisible();
    const wall = await wallResponse;
    expect(wall.status()).toBe(200);
    expect(
        (await wall.json()).messages.some(
            (message: { body: string }) => message.body === peerNote,
        ),
    ).toBe(true);
    await expect(
        page.locator('article:visible').filter({ hasText: peerNote }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Close message wall' }),
    ).toBeVisible();

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
        page.locator(
            '[data-wl-id="settings.learning-support.learner-messages"]',
        ),
    ).toBeVisible();
    await expect(
        page.locator(
            '[data-wl-id="settings.learning-support.learner-messages.digest"]',
        ),
    ).toBeVisible();
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(page.getByLabel('Settings area')).toBeVisible();
    await expect(
        page.locator(
            '[data-wl-id="settings.learning-support.learner-messages"]',
        ),
    ).toBeVisible();
    await page.setViewportSize({ height: 720, width: 1280 });
    await expect(
        page.locator('article:visible').filter({ hasText: peerNote }),
    ).toBeVisible();
    const moderationCard = page
        .locator('article:visible')
        .filter({ hasText: peerNote });
    await moderationCard.getByRole('button', { name: 'Hide' }).click();
    await expect(
        moderationCard.getByText('Hidden from learners'),
    ).toBeVisible();

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
    await removePriorTestMessages();
});
