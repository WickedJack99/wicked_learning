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
    const navigation = page.getByRole('tablist', {
        name: 'Dialogue node settings sections',
    });

    for (const [section, control] of [
        ['Basics', page.getByLabel('Title')],
        ['Content', page.getByLabel('Speech bubble text')],
        ['Flow', page.getByLabel('Tool to give')],
        ['Visuals', page.getByText('Dialogue scene preview', { exact: true })],
    ]) {
        const sectionButton = navigation.getByRole('tab', {
            name: new RegExp(`^${section}`),
        });

        await expectBounded(sectionButton, viewport);
        await sectionButton.click({ force: true });
        await expect(sectionButton).toHaveAttribute('aria-selected', 'true');
        await expectBounded(control, viewport);
    }
}

async function selectDialogueSection(
    page: Page,
    section: 'Basics' | 'Content' | 'Flow' | 'Visuals',
): Promise<void> {
    const sectionButton = page
        .getByRole('tablist', { name: 'Dialogue node settings sections' })
        .getByRole('tab', { name: new RegExp(`^${section}`) });

    await sectionButton.click({ force: true });
    await expect(sectionButton).toHaveAttribute('aria-selected', 'true');
}

async function dragBetween(
    page: Page,
    source: Locator,
    target: Locator,
): Promise<void> {
    const sourceBounds = await source.boundingBox();
    const targetBounds = await target.boundingBox();

    expect(sourceBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();

    const sourcePoint = {
        x: sourceBounds!.x + sourceBounds!.width / 2,
        y: sourceBounds!.y + sourceBounds!.height / 2,
    };
    const targetPoint = {
        x: targetBounds!.x + targetBounds!.width / 2,
        y: targetBounds!.y + targetBounds!.height / 2,
    };
    await page.mouse.move(sourcePoint.x, sourcePoint.y);
    await page.mouse.down();
    await page.mouse.move(
        targetPoint.x,
        targetPoint.y,
        { steps: 12 },
    );
    await page.mouse.up();
}

async function dragDialogueCard(page: Page, card: Locator): Promise<void> {
    const bounds = await card.boundingBox();

    expect(bounds).not.toBeNull();

    const startX = bounds!.x + bounds!.width / 2;
    const startY = bounds!.y + 24;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 96, startY + 48, { steps: 12 });
    await page.mouse.up();
}

test('a local world author can build an NPC dialogue graph', async ({ page }) => {
    test.setTimeout(180_000);
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
    await page.getByRole('button', { name: 'Add activity', exact: true }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('combobox', { name: 'Type' }).click();
    await page.getByRole('option', { name: 'NPC dialogue', exact: true }).click();
    const [created] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/npc-dialogue-activities')),
        page.getByRole('button', { name: 'Create', exact: true }).click(),
    ]);
    expect(created.status()).toBe(201);
    const { activity_id: activityId } = (await created.json()) as { activity_id: string };
    const dialogueActivity = page.getByRole('group', {
        name: `npc_dialogue: ${title}`,
    });
    await expect(dialogueActivity).toBeVisible();
    await page.getByRole('button', { name: 'Fit View', exact: true }).click();
    await dialogueActivity
        .getByRole('button', { name: 'Edit dialogue', exact: true })
        .dispatchEvent('click');
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
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .dispatchEvent('click');
    const narrowAddNode = page.getByRole('button', {
        name: 'Add node',
        exact: true,
    });
    await expect(narrowAddNode).toBeVisible();
    const addNodeBox = await narrowAddNode.boundingBox();
    expect(addNodeBox).not.toBeNull();
    expect((addNodeBox?.x ?? 0) + (addNodeBox?.width ?? 0)).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole('button', { name: 'Add node' }).click();
    await expect(page.getByRole('heading', { name: 'Add dialogue node' })).toBeVisible();
    await selectDialogueSection(page, 'Basics');
    await page.getByLabel('Title').fill('Archivist greeting');
    await selectDialogueSection(page, 'Content');
    await page.getByLabel('Speech bubble text').fill('Welcome to the archive.');
    const [nodeCreated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/npc-dialogue/nodes')),
        page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(nodeCreated.status()).toBe(201);

    await page.getByRole('button', { name: 'Add node' }).click();
    await selectDialogueSection(page, 'Basics');
    await page.getByRole('combobox', { name: 'Type' }).click({ force: true });
    await page.getByRole('option', { name: 'Answer', exact: true }).click();
    await page.getByLabel('Title').fill('Open the archive');
    await selectDialogueSection(page, 'Content');
    await page.getByLabel('Answer text').fill('Open it');
    const [answerCreated] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/npc-dialogue/nodes')),
        page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(answerCreated.status()).toBe(201);
    await expect(
        page.getByRole('heading', { name: 'Add dialogue node' }),
    ).toHaveCount(0);

    const graph = await page.request.get(`/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`);
    expect(graph.ok()).toBeTruthy();
    const saved = (await graph.json()) as {
        dialogue_nodes: Array<{ id: string; node_type: string; title: string }>;
        [key: string]: unknown;
    };
    const greeting = saved.dialogue_nodes.find((node) => node.title === 'Archivist greeting');
    const answer = saved.dialogue_nodes.find((node) => node.title === 'Open the archive') as ({ config: { events: { hideNodeIds: string[]; unlockNodeIds: string[] } } } | undefined);
    const end = saved.dialogue_nodes.find((node) => node.node_type === 'end');
    expect(greeting).toBeDefined();
    expect(answer?.config.events).toEqual({ hideNodeIds: [], unlockNodeIds: [] });

    if (!greeting || !answer || !end) {
        throw new Error('the saved graph is incomplete');
    }

    const greetingCard = page.locator(`[data-id="${greeting.id}"]`);
    const startHandle = page.locator(
        '.react-flow__handle.source[data-nodeid="start"][data-handleid="start"]',
    );
    const greetingTarget = page.locator(
        `.react-flow__handle.target[data-nodeid="${greeting.id}"][data-handleid="in"]`,
    );
    const [startConnected] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/npc-dialogue/transitions'),
        ),
        dragBetween(page, startHandle, greetingTarget),
    ]);
    expect(startConnected.status()).toBe(201);
    expect(startConnected.request().postDataJSON()).toEqual({
        from_connector: 'out',
        from_node_id: null,
        to_connector: 'in',
        to_node_id: greeting.id,
    });

    const connectedGraph = await page.request.get(
        `/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
    );
    expect(connectedGraph.ok()).toBeTruthy();
    const connected = (await connectedGraph.json()) as {
        transitions: Array<{ id: string }>;
    };
    expect(connected.transitions).toHaveLength(1);
    const startTransition = connected.transitions[0];
    const startEdge = page.locator(
        `[data-id="dialogue-transition:${startTransition.id}"]`,
    );
    await expect(startEdge).toBeVisible();
    const [startRemoved] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'DELETE' &&
            response.url().endsWith(
                `/npc-dialogue/transitions/${startTransition.id}`,
            ),
        ),
        startEdge.click({ position: { x: 8, y: 8 } }),
    ]);
    expect(startRemoved.status()).toBe(204);
    await expect(startEdge).toHaveCount(0);

    const greetingOutput = page.locator(
        `.react-flow__handle.source[data-nodeid="${greeting.id}"]`,
    );
    const endTarget = page.locator(
        `.react-flow__handle.target[data-nodeid="${end.id}"][data-handleid="in"]`,
    );
    const [endConnected] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/npc-dialogue/transitions'),
        ),
        dragBetween(page, greetingOutput, endTarget),
    ]);
    expect(endConnected.status()).toBe(201);

    const [greetingMoved] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith(`/npc-dialogue/nodes/${greeting.id}`),
        ),
        dragDialogueCard(page, greetingCard),
    ]);
    expect(greetingMoved.status()).toBe(204);

    await greetingCard.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Edit dialogue node' }),
    ).toBeVisible();
    await selectDialogueSection(page, 'Basics');
    await expect(page.getByLabel('Title')).toHaveValue('Archivist greeting');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectBounded(page.getByLabel('Title'), {
        height: 844,
        width: 390,
    });
    await expectBounded(page.getByRole('button', { name: 'Save', exact: true }), {
        height: 844,
        width: 390,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel('Title').fill('Archivist welcome');
    const [nodeUpdated] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith(`/npc-dialogue/nodes/${greeting.id}`),
        ),
        page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(nodeUpdated.status()).toBe(204);
    await expect(
        page.getByRole('heading', { name: 'Edit dialogue node' }),
    ).toHaveCount(0);
    await expect(
        greetingCard.getByRole('heading', { name: 'Archivist welcome' }),
    ).toBeVisible();

    const removedTitle = `Temporary dialogue node ${Date.now()}`;
    await page.getByRole('button', { name: 'Add node' }).click();
    await selectDialogueSection(page, 'Basics');
    await page.getByLabel('Title').fill(removedTitle);
    await selectDialogueSection(page, 'Content');
    await page.getByLabel('Speech bubble text').fill('This node is removed through the source dialog.');
    const [temporaryCreated] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/npc-dialogue/nodes'),
        ),
        page.getByRole('button', { name: 'Save', exact: true }).click(),
    ]);
    expect(temporaryCreated.status()).toBe(201);
    const graphWithTemporary = await page.request.get(
        `/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
    );
    expect(graphWithTemporary.ok()).toBeTruthy();
    const temporary = (
        await graphWithTemporary.json() as {
            dialogue_nodes: Array<{ id: string; title: string }>;
        }
    ).dialogue_nodes.find((node) => node.title === removedTitle);
    expect(temporary).toBeDefined();

    if (!temporary) {
        throw new Error('the temporary dialogue node was not created');
    }

    const temporaryCard = page.locator(`[data-id="${temporary.id}"]`);
    await temporaryCard
        .getByRole('button', { name: `Delete ${removedTitle}` })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Delete dialogue node?' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectBounded(
        page.getByRole('heading', { name: 'Delete dialogue node?' }),
        { height: 844, width: 390 },
    );
    await expectBounded(page.getByRole('button', { name: 'Delete', exact: true }), {
        height: 844,
        width: 390,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    const [nodeDeleted] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'DELETE' &&
            response.url().endsWith(`/npc-dialogue/nodes/${temporary.id}`),
        ),
        page.getByRole('button', { name: 'Delete', exact: true }).click(),
    ]);
    expect(nodeDeleted.status()).toBe(204);
    await expect(temporaryCard).toHaveCount(0);

    await page.route(
        `**/api/v1/admin/world-builder/maps/${target.mapId}/visual-media`,
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({}),
                contentType: 'application/json',
                status: 503,
            });
        },
    );
    await page.getByRole('button', { name: 'Add node' }).click();
    await selectDialogueSection(page, 'Visuals');
    const backgroundUpload = page.locator('#npc-background-dark-upload');
    const backgroundUploadButton = page.locator(
        'label[for="npc-background-dark-upload"]',
    );
    const [failedImageUpload] = await Promise.all([
        page.waitForResponse((response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith(
                `/world-builder/maps/${target.mapId}/visual-media`,
            ),
        ),
        backgroundUpload.setInputFiles({
            buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
            mimeType: 'image/svg+xml',
            name: 'unavailable.svg',
        }),
    ]);
    expect(failedImageUpload.status()).toBe(503);
    expect(
        failedImageUpload.request().headers()['x-csrf-token'],
    ).toBeTruthy();
    await expect(
        page.getByText('The image could not be uploaded.', { exact: true }),
    ).toBeVisible();
    await expect(backgroundUpload).not.toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectBounded(backgroundUploadButton, { height: 844, width: 390 });
    await expectBounded(
        page.getByText('The image could not be uploaded.', { exact: true }),
        { height: 844, width: 390 },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
        .getByRole('button', { name: 'Cancel', exact: true })
        .click({ force: true });
});
