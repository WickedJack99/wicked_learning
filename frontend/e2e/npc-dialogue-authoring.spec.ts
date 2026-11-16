import type { Locator, Page } from '@playwright/test';

import { expect, test } from './authenticated';

async function expectBounded(
    locator: Locator,
    viewport: { height: number; width: number },
): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeVisible();
    const bounds = await locator.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}

async function exerciseSourceDialogueSections(
    page: Page,
    viewport: { height: number; width: number },
): Promise<void> {
    const navigation = page.getByLabel('Dialogue node settings sections');

    for (const [section, control] of [
        ['Basics', page.getByLabel('Title')],
        ['Content', page.getByLabel('Speech bubble text')],
        ['Flow', page.getByLabel('Tool to give')],
        ['Visuals', page.getByText('Dialogue scene preview', { exact: true })],
    ]) {
        const sectionButton = navigation.getByRole('button', {
            name: new RegExp(`^${section}`),
        });

        await expectBounded(sectionButton, viewport);
        await sectionButton.click();
        await expectBounded(control, viewport);
    }
}

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

    if (!target) {
        throw new Error('the local World Builder needs one node');
    }

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
    await expect(
        page.getByRole('heading', { name: `${title} dialogue` }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Activity graph', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('End A', { exact: true })).toBeVisible();
    await expectBounded(page.locator('.react-flow__renderer'), {
        height: 900,
        width: 1440,
    });
    await expectBounded(page.getByText('Start', { exact: true }), {
        height: 900,
        width: 1440,
    });
    await expectBounded(page.getByText('End A', { exact: true }), {
        height: 900,
        width: 1440,
    });

    await page.getByRole('button', { name: 'Add node' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add dialogue node' }),
    ).toBeVisible();
    await exerciseSourceDialogueSections(page, { height: 900, width: 1440 });

    await page.setViewportSize({ width: 390, height: 844 });
    await exerciseSourceDialogueSections(page, { height: 844, width: 390 });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const narrowAddNode = page.getByRole('button', {
        name: 'Add node',
        exact: true,
    });
    await expect(narrowAddNode).toBeVisible();
    const addNodeBox = await narrowAddNode.boundingBox();
    expect(addNodeBox).not.toBeNull();
    expect((addNodeBox?.x ?? 0) + (addNodeBox?.width ?? 0)).toBeLessThanOrEqual(390);
    await expectBounded(page.locator('.react-flow__renderer'), {
        height: 844,
        width: 390,
    });
    await expectBounded(page.getByText('Start', { exact: true }), {
        height: 844,
        width: 390,
    });
    await expectBounded(page.getByText('End A', { exact: true }), {
        height: 844,
        width: 390,
    });
    await page.setViewportSize({ width: 1440, height: 900 });

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
        [key: string]: unknown;
    };
    const greeting = saved.dialogue_nodes.find((node) => node.title === 'Archivist greeting');
    const end = saved.dialogue_nodes.find((node) => node.node_type === 'end');
    const answer = saved.dialogue_nodes.find((node) => node.title === 'Open the archive') as ({ config: { events: { hideNodeIds: string[]; unlockNodeIds: string[] } } } | undefined);
    expect(greeting).toBeDefined();
    expect(end).toBeDefined();
    expect(answer?.config.events).toEqual({ hideNodeIds: [target.nodeId], unlockNodeIds: [target.nodeId] });

    if (!greeting || !end || !answer) {
        throw new Error('the saved graph is incomplete');
    }

    const connect = await browserJsonRequest(page, `/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue/transitions`, 'POST', { from_node_id: null, to_node_id: greeting.id, from_connector: 'out', to_connector: 'in' });
    expect(connect).toBe(201);
    const complete = await browserJsonRequest(page, `/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue/transitions`, 'POST', { from_node_id: greeting.id, to_node_id: end.id, from_connector: 'out', to_connector: 'in' });
    expect(complete).toBe(201);

    await page.getByRole('button', { name: 'Activity graph' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const activityCard = page.locator(`[data-id="${activityId}"]`);
    await expect(activityCard).toBeVisible();
    await expect(
        activityCard.getByRole('button', {
            name: `Save ${title} as a reusable template`,
        }),
    ).toHaveCount(0);
    expect(
        await browserJsonRequest(
            page,
            `/api/v1/admin/world-builder/activities/${activityId}/templates`,
            'POST',
            { name: `Unavailable dialogue template ${Date.now()}` },
        ),
    ).toBe(422);
    const nodeDocument = await page.request.get(`/api/v1/admin/world-builder/nodes/${target.nodeId}`);
    const activityDocument = (await nodeDocument.json()) as {
        activity_graph: { activities: Array<{ id: string; connectors: { outputs: Array<{ id: string }> } }> };
    };
    expect(activityDocument.activity_graph.activities.find((activity) => activity.id === activityId)?.connectors.outputs).toContainEqual({ id: `dialogue-end-${end.id}`, label: 'A End A' });

    await page.route(
        `**/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
        async (route) => {
            await route.fulfill({
                json: {
                    ...saved,
                    dialogue_nodes: [],
                    transitions: [],
                },
            });
        },
    );
    await activityCard.getByRole('button', { name: 'Edit dialogue' }).click();
    await expect(
        page.getByRole('heading', { name: `${title} dialogue` }),
    ).toBeVisible();
    await expectBounded(page.locator('.react-flow__renderer'), {
        height: 900,
        width: 1440,
    });
    await expectBounded(page.getByText('Start', { exact: true }), {
        height: 900,
        width: 1440,
    });
    await expect(page.getByText('End A', { exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectBounded(page.locator('.react-flow__renderer'), {
        height: 844,
        width: 390,
    });
    await expectBounded(page.getByText('Start', { exact: true }), {
        height: 844,
        width: 390,
    });
    await expectBounded(page.getByRole('button', { name: 'Add node' }), {
        height: 844,
        width: 390,
    });

    expect(await browserJsonRequest(page, `/api/v1/admin/world-builder/activities/${activityId}`, 'DELETE')).toBe(204);
});

async function browserJsonRequest(
    page: Page,
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
