import { expect, test } from '@playwright/test';

test('a local world author can build an NPC dialogue graph', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const world = await page.request.get('/api/v1/admin/world-builder');
    expect(world.ok()).toBeTruthy();
    const body = (await world.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const target = body.maps.flatMap((map) =>
        map.nodes.map((node) => ({ mapId: map.id, nodeId: node.id })),
    )[0];
    expect(target).toBeDefined();
    if (!target) throw new Error('the local World Builder needs one node');

    const title = `NPC dialogue ${Date.now()}`;
    await page.goto(`/settings?panel=admin-world-builder&map=${target.mapId}&node=${target.nodeId}`);
    await page.getByRole('button', { name: 'NPC dialogue', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New NPC dialogue' })).toBeVisible();
    await page.getByLabel('Title').fill(title);
    const [created] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/npc-dialogue-activities')),
        page.getByRole('button', { name: 'Create dialogue' }).click(),
    ]);
    expect(created.status()).toBe(201);
    const { activity_id: activityId } = (await created.json()) as { activity_id: string };
    await expect(page.getByText('End A', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Add node' }).click();
    await expect(page.getByRole('heading', { name: 'Add dialogue node' })).toBeVisible();
    await page.getByLabel('Title').fill('Archivist greeting');
    await page.getByLabel('Speech bubble text').fill('Welcome to the archive.');
    const [nodeCreated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/npc-dialogue/nodes')),
        page.getByRole('button', { name: 'Save node' }).click(),
    ]);
    expect(nodeCreated.status()).toBe(201);

    await page.getByRole('button', { name: 'Add node' }).click();
    await page.getByLabel('Node type').selectOption('answer');
    await page.getByLabel('Title').fill('Open the archive');
    await page.getByLabel('Answer text').fill('Open it');
    await page.getByLabel('Hide nodes').selectOption(target.nodeId);
    await page.getByLabel('Unlock nodes').selectOption(target.nodeId);
    const [answerCreated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/npc-dialogue/nodes')),
        page.getByRole('button', { name: 'Save node' }).click(),
    ]);
    expect(answerCreated.status()).toBe(201);

    const graph = await page.request.get(`/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`);
    expect(graph.ok()).toBeTruthy();
    const saved = (await graph.json()) as {
        dialogue_nodes: Array<{ id: string; node_type: string; title: string }>;
    };
    const greeting = saved.dialogue_nodes.find((node) => node.title === 'Archivist greeting');
    const end = saved.dialogue_nodes.find((node) => node.node_type === 'end');
    const answer = saved.dialogue_nodes.find((node) => node.title === 'Open the archive') as ({ config: { events: { hideNodeIds: string[]; unlockNodeIds: string[] } } } | undefined);
    expect(greeting).toBeDefined();
    expect(end).toBeDefined();
    expect(answer?.config.events).toEqual({ hideNodeIds: [target.nodeId], unlockNodeIds: [target.nodeId] });
    if (!greeting || !end || !answer) throw new Error('the saved graph is incomplete');

    const connect = await browserJsonRequest(page, `/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue/transitions`, 'POST', { from_node_id: null, to_node_id: greeting.id, from_connector: 'out', to_connector: 'in' });
    expect(connect).toBe(201);
    const complete = await browserJsonRequest(page, `/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue/transitions`, 'POST', { from_node_id: greeting.id, to_node_id: end.id, from_connector: 'out', to_connector: 'in' });
    expect(complete).toBe(201);

    await page.getByRole('button', { name: 'Activity graph' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const nodeDocument = await page.request.get(`/api/v1/admin/world-builder/nodes/${target.nodeId}`);
    const activityDocument = (await nodeDocument.json()) as {
        activity_graph: { activities: Array<{ id: string; connectors: { outputs: Array<{ id: string }> } }> };
    };
    expect(activityDocument.activity_graph.activities.find((activity) => activity.id === activityId)?.connectors.outputs).toContainEqual({ id: `dialogue-end-${end.id}`, label: 'A End A' });

    expect(await browserJsonRequest(page, `/api/v1/admin/world-builder/activities/${activityId}`, 'DELETE')).toBe(204);
});

async function browserJsonRequest(
    page: import('@playwright/test').Page,
    url: string,
    method: 'DELETE' | 'POST',
    body?: Record<string, unknown>,
): Promise<number> {
    return page.evaluate(async ({ body, method, url }) => {
        const csrf = await fetch('/api/v1/security/csrf');
        const { token } = await csrf.json() as { token: string };
        const response = await fetch(url, {
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                'X-CSRF-Token': token,
            },
            method,
        });
        return response.status;
    }, { body, method, url });
}
