import { expect, test } from '@playwright/test';

test('a local administrator can author and scope a bounded companion dialogue graph', async ({ page }) => {
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
    const created = await page.request.post('/api/v1/admin/learning-companion/dialogues', {
        data: { name: `Companion dialogue ${Date.now()}` },
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
        expect(assignmentPage.items.length).toBeGreaterThan(0);

        const savedAssignments = await page.request.put(
            `/api/v1/admin/learning-companion/dialogues/${dialogue.id}/assignments`,
            { data: { assignments: [assignmentPage.items[0]] }, headers },
        );
        expect(savedAssignments.status()).toBe(200);
        expect((await savedAssignments.json()).assignments_count).toBe(1);

        const updated = await page.request.patch(
            `/api/v1/admin/learning-companion/dialogues/${dialogue.id}`,
            {
                data: {
                    name: 'A bounded orientation dialogue',
                    dialogue_graph: {
                        version: 1,
                        start: 'welcome',
                        nodes: [
                            {
                                id: 'welcome',
                                type: 'message',
                                message: 'Choose what would help next.',
                                next: 'choice',
                            },
                            {
                                id: 'choice',
                                type: 'choice',
                                prompt: 'Where would you like to go?',
                                choices: [
                                    {
                                        key: 'map',
                                        label: 'Open the map',
                                        action: 'current-map',
                                    },
                                ],
                            },
                        ],
                    },
                },
                headers,
            },
        );
        expect(updated.status()).toBe(200);
        expect((await updated.json()).assignments_count).toBe(1);
    } finally {
        expect(
            (
                await page.request.delete(
                    `/api/v1/admin/learning-companion/dialogues/${dialogue.id}`,
                    { headers },
                )
            ).status(),
        ).toBe(204);
    }
});
