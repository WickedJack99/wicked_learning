import { expect, test } from './authenticated';

test('a local author can save, revise, restore and copy a reusable activity template', async ({
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
                position: { x: number | null; y: number | null };
                title: string;
            }>;
        };
    };
    const activity = node.activity_graph.activities.find(
        (candidate) => candidate.activity_type === 'open_practice',
    );
    expect(activity).toBeDefined();
    if (!activity) {
        throw new Error(
            'the disposable World Builder has no Open practice activity',
        );
    }
    const graphPosition = Math.max(
        0,
        ...node.activity_graph.activities.flatMap((candidate) => [
            candidate.position.x ?? 0,
            candidate.position.y ?? 0,
        ]),
    ) + 1_000;
    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };
    const positionedResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activity.id}/graph-position`,
        {
            data: { position: { x: graphPosition, y: graphPosition } },
            headers: {
                Origin: new URL(page.url()).origin,
                'X-CSRF-Token': token,
            },
        },
    );
    expect(positionedResponse.status()).toBe(200);

    await page.goto(
        `/settings?panel=admin-world-builder&map=${map.id}&node=${map.nodes[0].id}`,
    );
    const activityCard = page.locator(`[data-id="${activity.id}"]`);
    await expect(activityCard).toBeVisible();

    const templateName = `Template ${Date.now()}`;
    await activityCard
        .getByRole('button', {
            name: `Save ${activity.title} as a reusable template`,
        })
        .click();
    const dialog = page.locator('[data-wl-id="authoring.activity-templates"]');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Template name').fill(templateName);
    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/activities/${activity.id}/templates`,
                ),
    );
    await dialog
        .getByRole('button', { name: 'Save reusable template' })
        .click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const createdTemplate = (await createdResponse.json()) as {
        template: { id: string };
    };
    const detailsResponse = await page.request.get(
        `/api/v1/admin/activity-templates/${createdTemplate.template.id}`,
    );
    expect(detailsResponse.ok()).toBeTruthy();
    expect((await detailsResponse.json()).template.media_references).toEqual(
        [],
    );
    await expect(
        dialog.getByText(templateName, { exact: true }).first(),
    ).toBeVisible();

    await dialog
        .getByRole('button', { name: 'Close activity template library' })
        .click();
    await activityCard
        .getByRole('button', {
            name: `Update a saved template from ${activity.title}`,
        })
        .click();
    await expect(dialog).toBeVisible();
    page.once('dialog', (prompt) => prompt.accept());
    const updated = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/admin/activity-templates/') &&
            response.url().includes(`/from-activity/${activity.id}`),
    );
    await dialog
        .locator('article', { hasText: templateName })
        .getByRole('button', { name: 'Update', exact: true })
        .click();
    expect((await updated).status()).toBe(200);

    await dialog.getByRole('button', { name: 'Load history' }).click();
    await expect(dialog.getByText('Template history')).toBeVisible();
    page.once('dialog', (prompt) => prompt.accept());
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/activity-templates/') &&
            response.url().includes('/revisions/'),
    );
    await dialog.getByRole('button', { name: 'Restore' }).first().click();
    expect((await restored).status()).toBe(200);

    await dialog.getByRole('button', { name: 'Create editable copy' }).click();
    await expect(
        page.getByRole('heading', { name: 'Copy Open practice template' }),
    ).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue(
        `${activity.title} (copy)`,
    );
    await page.getByRole('button', { name: 'Close activity form' }).click();

    await page.getByRole('button', { name: 'Activity templates' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Search reusable templates').fill(templateName);
    await dialog.getByRole('button', { name: 'Search' }).click();
    await dialog
        .locator('article', { hasText: templateName })
        .getByRole('button', { name: 'Preview' })
        .click();
    page.once('dialog', (prompt) => prompt.accept());
    const deleted = page.waitForResponse(
        (response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes('/api/v1/admin/activity-templates/'),
    );
    await dialog.getByRole('button', { name: 'Delete template' }).click();
    expect((await deleted).status()).toBe(204);
    await expect(dialog.getByText(templateName, { exact: true })).toBeHidden();
});
