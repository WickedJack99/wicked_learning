import { expect, test } from '@playwright/test';

test('a local world author can open the source-derived World Builder graph', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-world-builder');
    await expect(page.getByText('World editing')).toBeVisible();
    await expect(page.getByText('Select a map or portal')).toBeVisible();
    await page.getByRole('button', { name: 'Create map' }).click();
    await expect(
        page.getByRole('heading', { name: 'Create world node' }),
    ).toBeVisible();
    await expect(page.getByLabel('Title')).toBeVisible();
    await expect(page.getByLabel('Slug')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    const disposableMapTitle = `Disposable map ${Date.now()}`;
    const updatedDisposableMapTitle = `${disposableMapTitle} updated`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(disposableMapTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: disposableMapTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Edit map details' }).click();
    await expect(
        page.getByRole('heading', { name: 'Edit map details' }),
    ).toBeVisible();
    await page.getByLabel('Title').fill(updatedDisposableMapTitle);
    await page
        .getByLabel('Description')
        .fill('A disposable map used to verify the Map Details save path.');
    await page.getByLabel('Lock MapAsset surface').check();
    await page.getByRole('button', { name: 'Save details' }).click();
    await expect(
        page.getByRole('heading', { name: updatedDisposableMapTitle }),
    ).toBeVisible();
    const updatedGraphResponse = await page.request.get(
        '/api/v1/admin/world-builder',
    );
    expect(updatedGraphResponse.ok()).toBeTruthy();
    const updatedGraph = (await updatedGraphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const updatedMap = updatedGraph.maps.find(
        (map) => map.title === updatedDisposableMapTitle,
    );
    expect(updatedMap).toBeDefined();
    if (!updatedMap) {
        throw new Error('the updated disposable map is missing from World Builder');
    }
    const updatedMapResponse = await page.request.get(
        `/api/v1/admin/world-builder/maps/${updatedMap.id}`,
    );
    expect(updatedMapResponse.ok()).toBeTruthy();
    const updatedMapDocument = (await updatedMapResponse.json()) as {
        editable_map: {
            map: {
                description: string;
                map_assets_locked: boolean;
                topic_id: string | null;
            };
        };
    };
    expect(updatedMapDocument.editable_map.map).toMatchObject({
        description: 'A disposable map used to verify the Map Details save path.',
        map_assets_locked: true,
        topic_id: null,
    });
    await page.getByRole('button', { name: 'Delete map' }).click();
    await expect(
        page.getByRole('heading', { name: 'Delete world map?' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'This removes the map, its tiles, activities, portal links and learner progress for those tiles. This cannot be undone.',
        ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    await expect(page).toHaveURL(/\/settings\?panel=admin-world-builder$/);

    const deletedMapResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(deletedMapResponse.ok()).toBeTruthy();
    const deletedMapGraph = (await deletedMapResponse.json()) as {
        maps: Array<{ title: string }>;
    };
    expect(deletedMapGraph.maps).not.toContainEqual(
        expect.objectContaining({ title: updatedDisposableMapTitle }),
    );

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const selectedMap = graph.maps.find((map) => map.nodes.length > 0);
    expect(selectedMap).toBeDefined();
    if (!selectedMap) {
        throw new Error('the local World Builder graph has no readable node');
    }

    await page.goto(
        `/settings?panel=admin-world-builder&map=${selectedMap.id}&node=${selectedMap.nodes[0].id}`,
    );
    await expect(page.getByText('Activity graph')).toBeVisible();
    await expect(page.locator('[data-id="__start"]')).toBeVisible();
    await expect(page.locator('[data-id="__end"]')).toBeVisible();
    await expect(
        page.locator('.react-flow__handle.source').first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open practice' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Open practice' }),
    ).toBeVisible();
    await expect(page.getByLabel('Learner invitation')).toBeVisible();
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Obstacle', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Obstacle' }),
    ).toBeVisible();
    await expect(page.getByLabel('Add a tool')).toBeVisible();
    await expect(page.getByLabel('Prompt bubble')).toBeVisible();
    await expect(page.getByLabel('Dark obstacle image')).toBeVisible();
    await expect(page.getByLabel('Success animation')).toHaveValue('zoom');
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Reflection' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Reflection' }),
    ).toBeVisible();
    await expect(page.getByLabel('Question')).toBeVisible();
    await expect(page.getByLabel('Journal topic')).toBeVisible();
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Item grant' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Item grant' }),
    ).toBeVisible();
    await expect(page.getByLabel('Probability')).toBeVisible();
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByLabel('Item 1', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Quantity for item 1')).toHaveValue('1');
    await expect(page.getByLabel('Dark background')).toBeVisible();
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Tool grant' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Tool grant' }),
    ).toBeVisible();
    await expect(page.getByLabel('Tool to give')).toBeVisible();
    await expect(page.getByLabel('Speech bubble text')).toBeVisible();
    await expect(page.getByLabel('Slide direction')).toHaveValue('left');
    await expect(page.getByLabel('Typing speed')).toHaveValue('24');
    await expect(page.getByLabel('Dark bubble color')).toHaveValue('#0f172a');
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Item obstacle' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Item obstacle' }),
    ).toBeVisible();
    await expect(
        page.getByLabel('Required item 1', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Failed try lockout (minutes)')).toHaveValue(
        '0',
    );
    await expect(page.getByLabel('Dark met background')).toBeVisible();
    await expect(page.getByLabel('Conditions not met sound')).toBeVisible();
    await page.getByRole('button', { name: 'Close activity form' }).click();

    const nodeResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${selectedMap.nodes[0].id}`,
    );
    expect(nodeResponse.ok()).toBeTruthy();
    const node = (await nodeResponse.json()) as {
        activity_graph: {
            activities: Array<{
                connectors: {
                    inputs: Array<{ id: string }>;
                    outputs: Array<{ id: string; label: string }>;
                };
                id: string;
                title: string;
            }>;
            node: {
                start_activity_id: string | null;
                start_routes: Array<{ id: string }>;
            };
            transitions: Array<{
                from_activity_id: string;
                from_connector: string;
                id: string;
                to_activity_id: string | null;
                to_connector: string;
            }>;
        };
    };
    const activity = node.activity_graph.activities.at(0);
    if (activity) {
        const input = activity.connectors.inputs.at(0);
        if (input) {
            await expect(
                page.locator(
                    `[data-nodeid="${activity.id}"][data-handleid="${input.id}"]`,
                ),
            ).toBeVisible();
        }
        const output = activity.connectors.outputs.at(0);
        if (output) {
            await expect(
                page.locator(
                    `[data-nodeid="${activity.id}"][data-handleid="${output.id}"]`,
                ),
            ).toBeVisible();
        }
        await page
            .getByRole('button', { name: `Delete ${activity.title}` })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Delete activity?' }),
        ).toBeVisible();
        await expect(page.getByText('This cannot be undone.')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
    }

    const transition = node.activity_graph.transitions.at(0);
    if (transition) {
        await expect(
            page.locator(
                `[data-nodeid="${transition.from_activity_id}"][data-handleid="${transition.from_connector}"]`,
            ),
        ).toBeVisible();
        if (transition.to_activity_id) {
            await expect(
                page.locator(
                    `[data-nodeid="${transition.to_activity_id}"][data-handleid="${transition.to_connector}"]`,
                ),
            ).toBeVisible();
        }
        await page
            .getByRole('group', {
                name: `Edge from ${transition.from_activity_id} to ${transition.to_activity_id ?? '__end'}`,
            })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Edit connection' }),
        ).toBeVisible();
        await expect(page.getByLabel('Connection label')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
    }

    const startRoute = node.activity_graph.node.start_routes.at(0);
    if (startRoute) {
        await page
            .getByRole('group', {
                name: `Edge from __start to ${startRoute.activity_id}`,
            })
            .click({ force: true });
        await expect(
            page.getByRole('heading', { name: 'Route visuals' }),
        ).toBeVisible();
        await expect(page.getByLabel('Route name')).toBeVisible();
        await expect(page.getByLabel('Route guidance')).toBeVisible();
        await expect(page.getByLabel('Dark route image')).toBeVisible();
        await expect(page.getByLabel('Light button color')).toBeVisible();
        await page.getByRole('button', { name: 'Close route form' }).click();
    } else if (node.activity_graph.node.start_activity_id) {
        await expect(
            page.locator('[data-id="__start-edge:legacy"]'),
        ).toBeVisible();
    }
});
