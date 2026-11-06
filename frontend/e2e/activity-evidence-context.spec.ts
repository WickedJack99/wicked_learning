import { expect, test } from '@playwright/test';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('the player shows the original learning focus before an activity begins', async ({
    page,
    request,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local identity');

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const login = await request.post('/api/v1/session/login', {
        data: { email, password },
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(login.status()).toBe(200);

    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const orientationStart = (await world.json()).start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'find-your-place',
    );
    expect(orientationStart).toBeDefined();

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(reset.status()).toBe(200);
    const started = await request.post(
        `/api/v1/learner/activity-starts/${orientationStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(started.status()).toBe(200);
    const { play_run_id: playRunId } = await started.json();

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto(
        `/learning/nodes/${orientationStart.node_slug}/play?run=${playRunId}`,
    );

    const focus = page.getByLabel('Learning focus');
    await expect(focus).toBeVisible();
    await expect(focus).toContainText('What this activity invites');
    await expect(focus).toContainText(
        'Notice the map context before deciding where to explore.',
    );
    await expect(
        page.getByRole('link', { name: 'Orientation' }),
    ).toHaveAttribute('href', '/competence?topic=orientation');
});
