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
    expect((await created).status()).toBe(201);

    const card = page.locator('[data-id]').filter({ hasText: `Review target ${suffix}` });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Review activity' }).click();
    const dialog = page.locator('[data-wl-id="authoring.activity-ai-review"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('does not use learner data, and never changes the activity automatically.')).toBeVisible();
    await expect(dialog.getByLabel('Review helper')).toBeVisible();
    await expect(dialog.locator('option', { hasText: templateName })).toHaveCount(1);
});
