import { expect, test } from './authenticated';

test('a learner can read only the current active activity translation', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };
    const world = await page.request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const document = (await world.json()) as {
        start_routes: Array<{ activity_slug: string; start_id: string }>;
    };
    const start = document.start_routes[0];
    expect(start).toBeDefined();

    const reset = await page.request.post(
        `/api/v1/learner/activity-starts/${start!.start_id}/reset`,
        { headers },
    );
    expect(reset.status()).toBe(200);
    const run = (await reset.json()) as {
        node_slug: string;
        play_run_id: string;
    };
    const playback = await page.request.get(
        `/api/v1/learner/play-runs/${run.play_run_id}`,
    );
    expect(playback.status()).toBe(200);
    const active = (await playback.json()) as {
        activity: { slug: string };
    };

    const translation = await page.request.get(
        `/api/v1/learner/play-runs/${run.play_run_id}/activities/${active.activity.slug}/translation`,
    );
    expect(translation.status()).toBe(200);
    await expect(translation.json()).resolves.toEqual({ translation: null });

    const stale = await page.request.get(
        `/api/v1/learner/play-runs/${run.play_run_id}/activities/not-the-active-activity/translation`,
    );
    expect(stale.status()).toBe(404);

    await page.route(
        `**/api/v1/learner/play-runs/${run.play_run_id}/activities/${active.activity.slug}/translation`,
        (route) =>
            route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    translation: {
                        introduction: 'Translated activity orientation',
                        title: 'Translated active activity',
                    },
                }),
            }),
    );
    await page.goto(
        `/learning/nodes/${encodeURIComponent(run.node_slug)}/play?run=${encodeURIComponent(run.play_run_id)}`,
    );
    await expect(
        page.getByRole('heading', { name: 'Translated active activity' }),
    ).toBeVisible();
    await expect(page.getByText('Translated activity orientation')).toBeVisible();
});
