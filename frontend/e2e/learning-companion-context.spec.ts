import { expect, test } from '@playwright/test';

test('a learner receives the highest matching authored companion dialogue context', async ({ page }) => {
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
    const settingsResponse = await page.request.get('/api/v1/admin/learning-companion');
    expect(settingsResponse.status()).toBe(200);
    const originalSettings = await settingsResponse.json();

    try {
        const enabled = await page.request.patch('/api/v1/admin/learning-companion', {
            data: { ...originalSettings, enabled: true },
            headers,
        });
        expect(enabled.status()).toBe(200);

        const created = await page.request.post('/api/v1/admin/learning-companion/dialogues', {
            data: { name: `World context dialogue ${Date.now()}` },
            headers,
        });
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
            const activity = assignmentPage.items.find((item) => item.scope_type === 'activity');
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
    } finally {
        const restored = await page.request.patch('/api/v1/admin/learning-companion', {
            data: originalSettings,
            headers,
        });
        expect(restored.status()).toBe(200);
    }
});
