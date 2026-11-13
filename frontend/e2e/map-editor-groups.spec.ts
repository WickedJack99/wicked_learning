import { expect, test } from './authenticated';

test('a local author assigns a World Builder map editor group', async ({
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
    const title = `Disposable map editor group ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const map = graph.maps.find((candidate) => candidate.title === title);
    expect(map).toBeDefined();
    if (!map) {
        throw new Error('the disposable World Builder map is missing');
    }

    const mapResponse = await page.request.get(
        `/api/v1/admin/world-builder/maps/${map.id}`,
    );
    expect(mapResponse.ok()).toBeTruthy();
    const document = (await mapResponse.json()) as {
        learning_groups: Array<{ id: string }>;
    };
    const editorGroup = document.learning_groups.at(0);
    expect(editorGroup).toBeDefined();
    if (!editorGroup) {
        throw new Error('the local World Builder has no manageable group');
    }

    await page.getByRole('button', { name: 'Manage map access' }).click();
    await expect(
        page.getByRole('heading', { name: 'Access permissions' }),
    ).toBeVisible();
    await expect(
        page.getByText('Group editors', { exact: true }),
    ).toBeVisible();
    await page
        .getByRole('group', { name: 'Map editor groups' })
        .getByRole('checkbox')
        .first()
        .check();

    const update = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/maps/${map.id}/editing-groups`,
                ),
    );
    await page.getByRole('button', { name: 'Save editor groups' }).click();
    expect((await update).status()).toBe(204);

    const updatedMapResponse = await page.request.get(
        `/api/v1/admin/world-builder/maps/${map.id}`,
    );
    expect(updatedMapResponse.ok()).toBeTruthy();
    const updatedDocument = (await updatedMapResponse.json()) as {
        editable_map: { map: { editing_group_ids: string[] } };
    };
    expect(updatedDocument.editable_map.map.editing_group_ids).toContain(
        editorGroup.id,
    );

    await page.getByRole('button', { name: 'Delete map' }).click();
    await expect(
        page.getByRole('heading', { name: 'Delete world map?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    await expect(page).toHaveURL(/\/settings\?panel=admin-world-builder$/);
});
