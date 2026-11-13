import { expect, installE2eAdminSession, test } from './authenticated';

const publicOrigin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;

test('an item obstacle plays its source-configured effect events after a valid item placement', async ({
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
        const pageWindow = window as typeof window & {
            itemObstacleSoundUrls?: string[];
        };
        pageWindow.itemObstacleSoundUrls = [];
        HTMLMediaElement.prototype.play = function play(): Promise<void> {
            pageWindow.itemObstacleSoundUrls?.push(this.currentSrc || this.src);
            return Promise.resolve();
        };
    });

    const csrf = await request.get('/api/v1/security/csrf');
    const { token } = await csrf.json();
    const preferences = await request.patch('/api/v1/learner/sound-preferences', {
        data: { ambience_volume: 100, effects_volume: 100, muted: false },
        headers: { Origin: publicOrigin, 'X-CSRF-Token': token },
    });
    expect(preferences.status()).toBe(200);

    const world = await request.get('/api/v1/learner/world');
    const obstacleStart = (await world.json()).start_routes.find(
        (candidate: { activity_slug: string }) =>
            candidate.activity_slug === 'receive-the-signal-stone',
    );
    expect(obstacleStart).toBeDefined();
    const reset = await request.post(
        `/api/v1/learner/activity-starts/${obstacleStart.start_id}/reset`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(reset.status()).toBe(200);
    const started = await request.post(
        `/api/v1/learner/activity-starts/${obstacleStart.start_id}/start`,
        { headers: { Origin: publicOrigin, 'X-CSRF-Token': token } },
    );
    expect(started.status()).toBe(200);
    const { play_run_id: playRunId } = await started.json();

    const storageState = await request.storageState();
    await page.context().addCookies(storageState.cookies);
    await page.goto(
        `/learning/nodes/${obstacleStart.node_slug}/play?run=${playRunId}`,
    );
    await expect(page.getByText('Item received:')).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Receive the signal stone',
        }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Place the signal stone' }),
    ).toBeVisible();

    await expect
        .poll(() =>
            page.evaluate(() =>
                (window as typeof window & { itemObstacleSoundUrls?: string[] })
                    .itemObstacleSoundUrls ?? [],
            ),
        )
        .toContainEqual(expect.stringContaining('/sounds/soft-chime.wav'));

    await page.getByRole('button', { name: 'Open inventory' }).click();
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await page.getByTitle('Signal stone').dispatchEvent('dragstart', {
        dataTransfer,
    });
    await page
        .locator('[data-wl-id="learner.activity.item-obstacle.slot.0"]')
        .dispatchEvent('drop', { dataTransfer });
    await expect
        .poll(() =>
            page.evaluate(() =>
                (window as typeof window & { itemObstacleSoundUrls?: string[] })
                    .itemObstacleSoundUrls?.filter((url) =>
                        url.includes('/sounds/soft-chime.wav'),
                    ).length ?? 0,
            ),
        )
        .toBeGreaterThanOrEqual(3);
});
