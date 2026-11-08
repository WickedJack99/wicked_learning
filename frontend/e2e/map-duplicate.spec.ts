import { expect, test } from '@playwright/test';

test('a local author duplicates a source-shaped map with its MapAsset surface', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const title = `Map copy source ${Date.now()}`;
    const duplicateTitle = `${title} copy`;
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const source = graph.maps.find((candidate) => candidate.title === title);
    if (!source) throw new Error('the disposable source map was not created');

    const created = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/maps/${source.id}/assets`),
    );
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    expect((await created).status()).toBe(201);

    const sourceDocument = await page.request.get(
        `/api/v1/admin/world-builder/maps/${source.id}`,
    );
    expect(sourceDocument.ok()).toBeTruthy();
    const sourceMap = (await sourceDocument.json()) as {
        editable_map: {
            map: {
                map_assets: Array<{
                    id: string;
                    node_id: string | null;
                    x: number;
                    y: number;
                }>;
            };
        };
    };
    const sourceAsset = sourceMap.editable_map.map.map_assets[0];
    if (!sourceAsset?.node_id) throw new Error('the copied MapAsset needs its node');

    await page.getByRole('button', { name: 'Duplicate map' }).click();
    await page.getByLabel('New map title').fill(duplicateTitle);
    const duplicated = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/maps/${source.id}/duplicate`),
    );
    await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Duplicate map', exact: true })
        .click();
    expect((await duplicated).status()).toBe(201);
    await expect(page.getByRole('heading', { name: duplicateTitle })).toBeVisible();

    const copiedGraphResponse = await page.request.get('/api/v1/admin/world-builder');
    const copiedGraph = (await copiedGraphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const copy = copiedGraph.maps.find(
        (candidate) => candidate.title === duplicateTitle,
    );
    if (!copy) throw new Error('the duplicated map was not returned in the graph');

    const copyDocument = await page.request.get(
        `/api/v1/admin/world-builder/maps/${copy.id}`,
    );
    expect(copyDocument.ok()).toBeTruthy();
    const copiedMap = (await copyDocument.json()) as typeof sourceMap;
    const copiedAsset = copiedMap.editable_map.map.map_assets[0];
    expect(copiedAsset).toMatchObject({
        x: sourceAsset.x,
        y: sourceAsset.y,
    });
    expect(copiedAsset.id).not.toBe(sourceAsset.id);
    expect(copiedAsset.node_id).not.toBe(sourceAsset.node_id);

    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    await page.goto(`/settings?panel=admin-world-builder&map=${source.id}`);
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
