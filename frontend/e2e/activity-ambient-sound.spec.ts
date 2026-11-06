import { expect, test } from '@playwright/test';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('a published, source-configured ambient sound plays only from the playback projection', async ({
    page,
    request,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local identity');

    await page.addInitScript(() => {
        const pageWindow = window as typeof window & {
            ambientSoundUrls?: string[];
        };
        pageWindow.ambientSoundUrls = [];
        HTMLMediaElement.prototype.play = function play(): Promise<void> {
            pageWindow.ambientSoundUrls?.push(this.currentSrc || this.src);
            return Promise.resolve();
        };
    });

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const login = await request.post('/api/v1/session/login', {
        data: { email, password },
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(login.status()).toBe(200);

    const soundPreferences = await request.patch(
        '/api/v1/learner/sound-preferences',
        {
            data: { ambience_volume: 100, effects_volume: 100, muted: false },
            headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
        },
    );
    expect(soundPreferences.status()).toBe(200);

    const world = await request.get('/api/v1/learner/world');
    expect(world.status()).toBe(200);
    const portalStart = (await world.json()).start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'prepare-for-travel',
    );
    expect(portalStart).toBeDefined();

    const reset = await request.post(
        `/api/v1/learner/activity-starts/${portalStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(reset.status()).toBe(200);
    const started = await request.post(
        `/api/v1/learner/activity-starts/${portalStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(started.status()).toBe(200);
    const { play_run_id: playRunId } = await started.json();

    const playback = await request.get(
        `/api/v1/learner/play-runs/${playRunId}`,
    );
    expect(playback.status()).toBe(200);
    await expect(playback.json()).resolves.toMatchObject({
        activity: {
            activity_type: 'portal',
            config: {
                ambientSound: {
                    enabled: true,
                    soundId: '00000000-0000-4000-8000-000000000058',
                },
            },
            sounds: [
                {
                    id: '00000000-0000-4000-8000-000000000058',
                    looped: true,
                    url: '/sounds/quiet-pulse.wav',
                    volume: 55,
                },
            ],
        },
    });

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto(
        `/learning/nodes/${portalStart.node_slug}/play?run=${playRunId}`,
    );
    await expect(page.getByText('First Path to Quiet Library')).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(() =>
                (window as typeof window & { ambientSoundUrls?: string[] })
                    .ambientSoundUrls ?? [],
            ),
        )
        .toContainEqual(expect.stringContaining('/sounds/quiet-pulse.wav'));
});
