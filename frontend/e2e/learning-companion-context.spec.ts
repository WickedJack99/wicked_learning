import { expect, test } from '@playwright/test';

test('a learner receives bounded authored, active-run, and completed companion context', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

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
    const settingsResponse = await page.request.get(
        '/api/v1/admin/learning-companion',
    );
    expect(settingsResponse.status()).toBe(200);
    const originalSettings = await settingsResponse.json();

    try {
        const enabled = await page.request.patch(
            '/api/v1/admin/learning-companion',
            {
                data: { ...originalSettings, enabled: true },
                headers,
            },
        );
        expect(enabled.status()).toBe(200);

        const created = await page.request.post(
            '/api/v1/admin/learning-companion/dialogues',
            {
                data: { name: `World context dialogue ${Date.now()}` },
                headers,
            },
        );
        expect(created.status()).toBe(201);
        const dialogue = (await created.json()) as { id: string };

        try {
            const assignments = await page.request.get(
                `/api/v1/admin/learning-companion/dialogues/${dialogue.id}/assignments`,
            );
            expect(assignments.status()).toBe(200);
            const assignmentPage = (await assignments.json()) as {
                items: Array<{ scope_id: string; scope_type: string }>;
            };
            const activity = assignmentPage.items.find(
                (item) => item.scope_type === 'activity',
            );
            expect(activity).toBeDefined();

            const saved = await page.request.put(
                `/api/v1/admin/learning-companion/dialogues/${dialogue.id}/assignments`,
                { data: { assignments: [activity] }, headers },
            );
            expect(saved.status()).toBe(200);

            const companion = await page.request.get(
                `/api/v1/learner/companion?surface=activity&activity_id=${activity!.scope_id}`,
            );
            expect(companion.status()).toBe(200);
            const payload = await companion.json();
            expect(payload.configuration.source_scope).toBe('activity');
            expect(payload.context.surface).toBe('activity');
            expect(payload.dialogue.version).toBe(1);
        } finally {
            await page.request.delete(
                `/api/v1/admin/learning-companion/dialogues/${dialogue.id}`,
                { headers },
            );
        }

        const activityContextDialogue = await page.request.post(
            '/api/v1/admin/learning-companion/dialogues',
            {
                data: { name: `Activity context dialogue ${Date.now()}` },
                headers,
            },
        );
        expect(activityContextDialogue.status()).toBe(201);
        const activityContextDialogueId =
            (await activityContextDialogue.json()) as { id: string };

        try {
            const assignments = await page.request.get(
                `/api/v1/admin/learning-companion/dialogues/${activityContextDialogueId.id}/assignments?search=find-your-place`,
            );
            expect(assignments.status()).toBe(200);
            const assignmentPage = (await assignments.json()) as {
                items: Array<{
                    label: string;
                    scope_id: string;
                    scope_type: string;
                }>;
            };
            const activity = assignmentPage.items.find(
                (item) => item.scope_type === 'activity',
            );
            expect(activity).toBeDefined();

            const world = await page.request.get('/api/v1/learner/world');
            expect(world.status()).toBe(200);
            const worldDocument = (await world.json()) as {
                start_routes: Array<{
                    activity_slug: string;
                    node_slug: string;
                    start_id: string;
                }>;
            };
            const start = worldDocument.start_routes.find(
                (candidate) => candidate.activity_slug === 'find-your-place',
            );
            expect(start).toBeDefined();

            const reset = await page.request.post(
                `/api/v1/learner/activity-starts/${start!.start_id}/reset`,
                { headers },
            );
            expect(reset.status()).toBe(200);
            const started = await page.request.post(
                `/api/v1/learner/activity-starts/${start!.start_id}/start`,
                { headers },
            );
            expect(started.status()).toBe(200);
            const run = (await started.json()) as { play_run_id: string };
            const playback = await page.request.get(
                `/api/v1/learner/play-runs/${run.play_run_id}`,
            );
            expect(playback.status()).toBe(200);
            const playbackDocument = (await playback.json()) as {
                activity: { id: string; slug: string };
            };
            expect(playbackDocument.activity.id).toBe(activity!.scope_id);

            const activeCompanion = await page.request.get(
                `/api/v1/learner/companion?surface=activity&activity_id=${activity!.scope_id}`,
            );
            expect(activeCompanion.status()).toBe(200);
            const activePayload = await activeCompanion.json();
            expect(activePayload).toMatchObject({
                context: {
                    play_run_id: run.play_run_id,
                    route: { id: start!.start_id },
                },
            });
            expect(typeof activePayload.context.post_attempt_available).toBe(
                'boolean',
            );

            await page.goto(
                `/learning/nodes/${encodeURIComponent(start!.node_slug)}/play?run=${encodeURIComponent(run.play_run_id)}`,
            );
            const launcher = page.locator(
                '[data-wl-id="learner.companion.launcher"]',
            );
            await expect(launcher).toBeVisible();
            await launcher.click();
            await expect(
                page.locator('[data-wl-id="learner.companion.panel"]'),
            ).toBeVisible();

            const completed = await page.request.post(
                `/api/v1/learner/play-runs/${run.play_run_id}/activities/${playbackDocument.activity.slug}/complete`,
                { headers, data: {} },
            );
            expect(completed.status()).toBe(200);
            const completedCompanion = await page.request.get(
                `/api/v1/learner/companion?surface=activity&activity_id=${activity!.scope_id}`,
            );
            expect(completedCompanion.status()).toBe(200);
            await expect(completedCompanion.json()).resolves.toMatchObject({
                context: { post_attempt_available: true },
            });
        } finally {
            await page.request.delete(
                `/api/v1/admin/learning-companion/dialogues/${activityContextDialogueId.id}`,
                { headers },
            );
        }
    } finally {
        const restored = await page.request.patch(
            '/api/v1/admin/learning-companion',
            {
                data: originalSettings,
                headers,
            },
        );
        expect(restored.status()).toBe(200);
    }
});
