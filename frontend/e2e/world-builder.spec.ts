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

    const nodeResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${selectedMap.nodes[0].id}`,
    );
    expect(nodeResponse.ok()).toBeTruthy();
    const node = (await nodeResponse.json()) as {
        activity_graph: { activities: Array<{ title: string }> };
    };
    const activity = node.activity_graph.activities.at(0);
    if (activity) {
        await page
            .getByRole('button', { name: `Delete ${activity.title}` })
            .click();
        await expect(
            page.getByRole('heading', { name: 'Delete activity?' }),
        ).toBeVisible();
        await expect(page.getByText('This cannot be undone.')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();
    }
});
