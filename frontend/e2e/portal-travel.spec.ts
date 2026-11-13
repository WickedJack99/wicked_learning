import { expect, installE2eAdminSession, test } from './authenticated';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('an authored portal issues an opaque arrival run and preserves its source-shaped scenes', async ({
    page,
    request,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local identity',
    );
    await installE2eAdminSession(page.context());
    request = page.context().request;

    const csrfResponse = await request.get('/api/v1/security/csrf');
    expect(csrfResponse.status()).toBe(200);
    const { token } = await csrfResponse.json();
    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const sourceStart = (await world.json()).start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'prepare-for-travel',
    );
    expect(sourceStart).toBeDefined();

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${sourceStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(reset.status()).toBe(200);
    const started = await request.post(
        `/api/v1/learner/activity-starts/${sourceStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(started.status()).toBe(200);
    const { play_run_id: sourceRunId } = await started.json();

    const sourcePlayback = await request.get(
        `/api/v1/learner/play-runs/${sourceRunId}`,
    );
    expect(sourcePlayback.status()).toBe(200);
    await expect(sourcePlayback.json()).resolves.toMatchObject({
        activity: {
            activity_type: 'portal',
            portal: {
                destination: {
                    label: 'First Path to Quiet Library',
                    node_state: 'available',
                },
            },
            slug: 'prepare-for-travel',
        },
    });

    const travelPath = `/api/v1/learner/play-runs/${sourceRunId}/activities/prepare-for-travel/portal/travel`;
    const travel = await request.post(travelPath, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(travel.status()).toBe(200);
    const arrival = await travel.json();
    expect(arrival).toMatchObject({
        node_slug: 'return-gate',
        play_run_id: expect.any(String),
    });
    expect(arrival.play_run_id).not.toBe(sourceRunId);

    const retriedTravel = await request.post(travelPath, {
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(retriedTravel.status()).toBe(200);
    await expect(retriedTravel.json()).resolves.toEqual(arrival);

    const arrivalPlayback = await request.get(
        `/api/v1/learner/play-runs/${arrival.play_run_id}`,
    );
    expect(arrivalPlayback.status()).toBe(200);
    await expect(arrivalPlayback.json()).resolves.toMatchObject({
        activity: {
            activity_type: 'portal',
            portal: { destination: null },
            slug: 'arrive-through-the-gate',
        },
        run_kind: 'portal',
    });

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto(
        `/learning/nodes/${arrival.node_slug}/play?run=${arrival.play_run_id}`,
    );
    await expect(page.getByText('Exit portal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

    const complete = await request.post(
        `/api/v1/learner/play-runs/${arrival.play_run_id}/activities/arrive-through-the-gate/complete`,
        { data: {}, headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(complete.status()).toBe(200);
    expect((await complete.json()).status).toBe('completed');
    const finishedArrival = await request.get(
        `/api/v1/learner/play-runs/${arrival.play_run_id}`,
    );
    expect(finishedArrival.status()).toBe(404);

    const restarted = await request.post(
        `/api/v1/learner/activity-starts/${sourceStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(restarted.status()).toBe(200);
    const { play_run_id: browserSourceRunId } = await restarted.json();
    await page.goto(
        `/learning/nodes/${sourceStart.node_slug}/play?run=${browserSourceRunId}`,
    );
    await expect(page.getByText('First Path to Quiet Library')).toBeVisible();
    await page.getByRole('button', { name: 'Traverse' }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Prepare for travel',
        }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue without answering' }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/return-gate\/play\?run=/,
    );
    await expect(page.getByText('Exit portal')).toBeVisible();
});
