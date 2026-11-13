import { expect, test } from './authenticated';

test('a local author can inspect and restore a source-shaped activity history entry', async ({
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

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    const map = graph.maps.find((candidate) => candidate.nodes.length > 0);
    expect(map).toBeDefined();
    if (!map) {
        throw new Error('the disposable World Builder has no readable node');
    }

    const nodeResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${map.nodes[0].id}`,
    );
    expect(nodeResponse.ok()).toBeTruthy();
    const node = (await nodeResponse.json()) as {
        activity_graph: {
            activities: Array<{
                activity_type: string;
                id: string;
                title: string;
            }>;
        };
    };
    const activity = node.activity_graph.activities.find(
        (candidate) => candidate.activity_type === 'open_practice',
    );
    expect(activity).toBeDefined();
    if (!activity) {
        throw new Error('the disposable World Builder has no Open practice activity');
    }

    await page.goto(
        `/settings?panel=admin-world-builder&map=${map.id}&node=${map.nodes[0].id}`,
    );
    await expect(page.locator(`[data-id="${activity.id}"]`)).toBeVisible();
    await page
        .locator(`[data-id="${activity.id}"]`)
        .getByRole('heading', { name: activity.title, exact: true })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Edit Open practice' }),
    ).toBeVisible();

    const updatedTitle = `History ${Date.now()}`;
    await page.getByLabel('Title').fill(updatedTitle);
    const save = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes(
                `/api/v1/admin/world-builder/activities/${activity.id}/open-practice`,
            ),
    );
    await page.getByRole('button', { name: 'Save activity' }).click();
    expect((await save).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Edit Open practice' })).toBeHidden();

    const activityCard = page.locator(`[data-id="${activity.id}"]`);
    await activityCard.getByRole('button', { name: 'Activity history' }).click();
    await expect(page.locator('[data-wl-id="authoring.activity-history"]')).toBeVisible();
    await expect(
        page
            .locator('[data-wl-id="authoring.activity-history"]')
            .getByText(activity.title, { exact: true })
            .first(),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const historyDialog = page.locator('[data-wl-id="authoring.activity-history"]');
    const historyBox = await historyDialog.boundingBox();
    expect(historyBox).not.toBeNull();
    expect(historyBox?.y).toBeGreaterThanOrEqual(0);
    expect((historyBox?.y ?? 0) + (historyBox?.height ?? 0)).toBeLessThanOrEqual(
        844,
    );
    await historyDialog.getByRole('button', { name: 'Inspect' }).first().click();
    await expect(
        page.getByRole('heading', { name: 'Type-specific settings' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to history' }).click();

    page.once('dialog', (dialog) => dialog.accept());
    const restore = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(
                `/api/v1/admin/world-builder/activities/${activity.id}/versions/`,
            ),
    );
    await historyDialog
        .getByRole('button', { name: 'Restore this version' })
        .first()
        .click();
    expect((await restore).status()).toBe(204);
    await expect(page.locator('[data-wl-id="authoring.activity-history"]')).toBeHidden();

    const restoredNodeResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${map.nodes[0].id}`,
    );
    expect(restoredNodeResponse.ok()).toBeTruthy();
    const restoredNode = (await restoredNodeResponse.json()) as {
        activity_graph: { activities: Array<{ id: string; title: string }> };
    };
    expect(
        restoredNode.activity_graph.activities.find(
            (candidate) => candidate.id === activity.id,
        ),
    ).toMatchObject({ title: activity.title });
});
