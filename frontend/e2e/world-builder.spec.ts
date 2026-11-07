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
    await expect(
        page.locator('.react-flow__handle.source').first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open practice' }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Open practice' }),
    ).toBeVisible();
    await expect(page.getByLabel('Learner invitation')).toBeVisible();
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
    await expect(page.getByLabel('Item 1')).toBeVisible();
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
            await expect(
                page.getByText(output.label, { exact: true }),
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
        await page.locator(`[data-id="${transition.id}"]`).click();
        await expect(
            page.getByRole('heading', { name: 'Edit connection' }),
        ).toBeVisible();
        await expect(page.getByLabel('Connection label')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
    }

    const startRoute = node.activity_graph.node.start_routes.at(0);
    if (startRoute) {
        await page.locator(`[data-id="__start-edge:${startRoute.id}"]`).click();
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
