import { expect, test } from '@playwright/test';

test('a local author can open the guarded source-derived activity review dialog', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    const suffix = Date.now();
    const providerLabel = `Review provider ${suffix}`;
    const templateName = `Review helper ${suffix}`;
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-ai-integrations&ai=providers');
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Label').fill(providerLabel);
    await page.getByLabel('API key').fill('local-review-dialog-key');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(providerLabel, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Agent templates' }).click();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Name').fill(templateName);
    await page.getByLabel('Purpose').selectOption('activity_review');
    await page.getByLabel('Provider credential').selectOption({ label: providerLabel });
    await page.getByLabel('Model').fill('local-review-model');
    await page.getByLabel('Enabled').check();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(templateName, { exact: true })).toBeVisible();

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as { maps: Array<{ id: string; nodes: Array<{ id: string }> }> };
    const target = graph.maps.flatMap((map) => map.nodes.map((node) => ({ mapId: map.id, nodeId: node.id })))[0];
    if (!target) throw new Error('the local World Builder needs one node');
    await page.goto(`/settings?panel=admin-world-builder&map=${target.mapId}&node=${target.nodeId}`);
    await page.getByRole('button', { name: 'Open practice' }).click();
    await page.getByLabel('Title').fill(`Review target ${suffix}`);
    const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/open-practice-activities'));
    await page.getByRole('button', { name: 'Create activity' }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const { activity_id: activityId } = await createdResponse.json() as { activity_id: string };

    const nodeResponse = await page.request.get(`/api/v1/admin/world-builder/nodes/${target.nodeId}`);
    expect(nodeResponse.ok()).toBeTruthy();
    const node = await nodeResponse.json() as {
        activity_graph: { activities: Array<{ id: string; updated_at: string }> };
    };
    const activity = node.activity_graph.activities.find((candidate) => candidate.id === activityId);
    if (!activity) throw new Error('the newly created activity was not returned by the node graph');
    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json() as { token: string };
    const metadataResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/learning-design`,
        {
            data: {
                learning_intent: 'explain',
                competence_topics: [{ topic: 'Systems Thinking', weight: 1 }],
                updated_at: activity.updated_at,
            },
            headers: { 'X-CSRF-Token': token },
        },
    );
    expect(metadataResponse.status()).toBe(200);
    const metadata = await metadataResponse.json() as { updated_at: string };
    const sourcesResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/source-references`,
        {
            data: {
                source_references: [{
                    anchor: null,
                    concepts: ['Systems Thinking'],
                    excerpt: 'A development-only source reference.',
                    published_at: null,
                    publisher: 'Wicked Learning test',
                    rights: null,
                    title: 'Source-reference test',
                    url: 'https://example.test/source-reference',
                }],
                updated_at: metadata.updated_at,
            },
            headers: { 'X-CSRF-Token': token },
        },
    );
    expect(sourcesResponse.status()).toBe(200);

    await page.reload();
    const card = page.locator('[data-id]').filter({ hasText: `Review target ${suffix}` });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Sources' }).click();
    const sourcesDialog = page.locator('[data-wl-id="authoring.activity-source-references"]');
    await expect(sourcesDialog).toBeVisible();
    await expect(sourcesDialog.getByDisplayValue('Source-reference test')).toBeVisible();
    await sourcesDialog.getByRole('button', { name: 'Close source references' }).click();
    await card.getByRole('button', { name: 'Review activity' }).click();
    const dialog = page.locator('[data-wl-id="authoring.activity-ai-review"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('does not use learner data, and never changes the activity automatically.')).toBeVisible();
    await expect(dialog.getByLabel('Review helper')).toBeVisible();
    await expect(dialog.locator('option', { hasText: templateName })).toHaveCount(1);
});
