import { expect, test } from './authenticated';

test('a local world author can save a source Markdown page graph', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add Markdown' })).toBeVisible();
    await expect(page.getByText('Markdown page graph', { exact: true })).toBeVisible();
    const title = `Markdown authoring ${Date.now()}`;
    await page.getByLabel('Title').fill(title);
    await page.getByRole('textbox', { name: 'Markdown', exact: true }).fill('# A useful briefing\n\nObserve the available directions.');
    const [created] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/markdown-activities')),
        page.getByRole('button', { name: 'Create activity' }).click(),
    ]);
    expect(created.status()).toBe(201);
    await page.getByRole('button', { name: 'Fit View' }).click();
    await page.getByText(title, { exact: true }).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'Edit Markdown' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Markdown', exact: true }).fill('# Updated briefing\n\nKeep the next useful direction visible.');
    const [updated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('/markdown')),
        page.getByRole('button', { name: 'Save activity' }).click(),
    ]);
    expect(updated.ok()).toBeTruthy();
    const node = await page.request.get(`/api/v1/admin/world-builder/nodes/${map.nodes[0].id}`);
    expect(node.ok()).toBeTruthy();
    const document = (await node.json()) as { activity_graph: { activities: Array<{ activity_type: string; config: { markdownPages?: Array<{ body?: string }> }; title: string }> } };
    const saved = document.activity_graph.activities.find((activity) => activity.title === title);
    expect(saved?.activity_type).toBe('markdown');
    expect(saved?.config.markdownPages?.[0]?.body).toContain('Updated briefing');
    await page.getByRole('button', { name: `Delete ${title}` }).dispatchEvent('click');
    await page.getByRole('dialog', { name: 'Delete activity?' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
});
