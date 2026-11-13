import { expect, test } from './authenticated';

test('a local world author can save source question activity fields', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    const graph = await page.request.get('/api/v1/admin/world-builder');
    expect(graph.ok()).toBeTruthy();
    const body = (await graph.json()) as { maps: Array<{ id: string; nodes: Array<{ id: string }> }> };
    const map = body.maps.find((candidate) => candidate.nodes.length > 0);
    expect(map).toBeDefined();
    if (!map) throw new Error('the local World Builder graph has no readable node');

    await page.goto(`/settings?panel=admin-world-builder&map=${map.id}&node=${map.nodes[0].id}`);
    await page.getByRole('button', { name: 'Question', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add Question' })).toBeVisible();
    await expect(page.getByLabel('Question prompt')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Add Question' })).toBeInViewport();
    await expect(page.getByLabel('Question prompt')).toBeInViewport();
    await page.setViewportSize({ width: 1280, height: 720 });
    const title = `Question authoring ${Date.now()}`;
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Question prompt').fill('Which choice keeps the next useful direction visible?');
    await page.getByLabel('Answer text').nth(0).fill('Keep useful next choices visible.');
    await page.getByLabel('Answer text').nth(1).fill('Hide all other routes.');
    await page.getByText('Correct answer', { exact: true }).first().click();
    const [created] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/question-activities')),
        page.getByRole('button', { name: 'Create activity' }).click(),
    ]);
    expect(created.status()).toBe(201);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fit View' }).click();
    await page.getByText(title, { exact: true }).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'Edit Question' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Correct feedback', exact: true }).fill('Correct: learner choice stays visible.');
    const [updated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('/question')),
        page.getByRole('button', { name: 'Save activity' }).click(),
    ]);
    expect(updated.ok()).toBeTruthy();
    const node = await page.request.get(`/api/v1/admin/world-builder/nodes/${map.nodes[0].id}`);
    expect(node.ok()).toBeTruthy();
    const document = (await node.json()) as { activity_graph: { activities: Array<{ config: { feedbackCorrect?: string; options?: Array<{ isCorrect?: boolean; key?: string }> }; title: string }> } };
    const saved = document.activity_graph.activities.find((activity) => activity.title === title);
    expect(saved?.config.feedbackCorrect).toBe('Correct: learner choice stays visible.');
    expect(saved?.config.options?.[0]?.isCorrect).toBeTruthy();
    expect(saved?.config.options?.[0]?.key).toBe('answer-1');
    await page.getByRole('button', { name: `Delete ${title}` }).dispatchEvent('click');
    await page.getByRole('dialog', { name: 'Delete activity?' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
