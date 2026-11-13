import { expect, test } from './authenticated';

test('a local world author can connect source-shaped Portal activities', async ({ page }) => {
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
    const body = (await graph.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const nodes = body.maps.flatMap((map) => map.nodes.map((node) => ({ ...node, mapId: map.id })));
    const exit = nodes[0];
    const entry = nodes.find((node) => node.id !== exit?.id);
    expect(exit).toBeDefined();
    expect(entry).toBeDefined();
    if (!exit || !entry) throw new Error('the local World Builder needs two nodes for a portal link');

    const exitTitle = `Portal exit ${Date.now()}`;
    await page.goto(`/settings?panel=admin-world-builder&map=${exit.mapId}&node=${exit.id}`);
    await page.getByRole('button', { name: 'Portal', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Add Portal' })).toBeVisible();
    await page.getByLabel('Title').fill(exitTitle);
    await page.getByLabel('Portal direction').selectOption('input');
    const [exitCreated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/portal-activities')),
        page.getByRole('button', { name: 'Create activity' }).click(),
    ]);
    expect(exitCreated.status()).toBe(201);
    const { activity_id: exitId } = (await exitCreated.json()) as { activity_id: string };

    const entryTitle = `Portal entry ${Date.now()}`;
    await page.goto(`/settings?panel=admin-world-builder&map=${entry.mapId}&node=${entry.id}`);
    await page.getByRole('button', { name: 'Portal', exact: true }).click();
    await page.getByLabel('Title').fill(entryTitle);
    await page.getByLabel('Travel target').selectOption(exitId);
    await page.getByRole('textbox', { name: 'Bubble text', exact: true }).fill('Before you lies a useful new direction.');
    const [entryCreated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/portal-activities')),
        page.getByRole('button', { name: 'Create activity' }).click(),
    ]);
    expect(entryCreated.status()).toBe(201);
    const { activity_id: entryId } = (await entryCreated.json()) as { activity_id: string };

    await page.getByText(entryTitle, { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Edit Portal' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Bubble text', exact: true }).fill('The archive is ready when you are.');
    const [updated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/activities/${entryId}/portal`)),
        page.getByRole('button', { name: 'Save activity' }).click(),
    ]);
    expect(updated.ok()).toBeTruthy();

    const entryNode = await page.request.get(`/api/v1/admin/world-builder/nodes/${entry.id}`);
    expect(entryNode.ok()).toBeTruthy();
    const document = (await entryNode.json()) as {
        activity_graph: {
            activities: Array<{
                config: { portalBubbleText?: string; portalMode?: string };
                id: string;
                portal_link: { target_activity?: { id: string } | null } | null;
                title: string;
            }>;
        };
    };
    const saved = document.activity_graph.activities.find((activity) => activity.id === entryId);
    expect(saved?.title).toBe(entryTitle);
    expect(saved?.config.portalMode).toBe('output');
    expect(saved?.config.portalBubbleText).toContain('archive is ready');
    expect(saved?.portal_link?.target_activity?.id).toBe(exitId);

    await page.getByRole('button', { name: `Delete ${entryTitle}` }).click();
    await page.getByRole('dialog', { name: 'Delete activity?' }).getByRole('button', { name: 'Delete', exact: true }).click();
    await page.goto(`/settings?panel=admin-world-builder&map=${exit.mapId}&node=${exit.id}`);
    await page.getByRole('button', { name: 'Fit View' }).click();
    await page
        .getByRole('button', { name: `Delete ${exitTitle}` })
        .dispatchEvent('click');
    await page.getByRole('dialog', { name: 'Delete activity?' }).getByRole('button', { name: 'Delete', exact: true }).click();
});
