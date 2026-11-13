import { expect, test } from './authenticated';

test('a local author inserts a MapAsset into an occupied source hex-grid edge', async ({ page }) => {
    test.setTimeout(60_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    await page.goto('/settings?panel=admin-world-builder');

    const title = `Map insertion ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const exportHref = await page
        .getByRole('link', { name: 'Export map', exact: true })
        .getAttribute('href');
    const mapId = exportHref?.match(/maps\/([^/]+)\/export$/)?.[1];
    if (!mapId) throw new Error('the created map did not expose its export route');
    for (let count = 0; count < 3; count += 1) {
        const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/v1/admin/world-builder/maps/${mapId}/assets`));
        await page.getByRole('button', { name: 'Add MapAsset' }).click();
        expect((await created).status()).toBe(201);
    }
    const document = async () => (await (await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}`)).json()) as { editable_map: { map: { nodes: Array<{ id: string; position: { q: number; r: number } }> } } };
    await expect.poll(async () => (await document()).editable_map.map.nodes.length).toBe(3);
    const before = (await document()).editable_map.map.nodes;
    const left = before.find((node) => node.position.q === 0 && node.position.r === 0);
    const right = before.find((node) => node.position.q === 1 && node.position.r === 0);
    const far = before.find((node) => node.position.q === 2 && node.position.r === 0);
    if (!left || !right || !far) throw new Error('MapAsset creation did not yield a contiguous source hex chain');

    const insertion = page.locator(
        `[data-wl-id="authoring.map-node-insert.${left.id}.1.0"], ` +
            `[data-wl-id="authoring.map-node-insert.${right.id}.-1.0"]`,
    );
    await expect(insertion).toHaveCount(1);
    const inserted = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/admin/world-builder/nodes/') &&
            response.url().endsWith('/insert-map-asset'),
    );
    await insertion.click();
    const insertedResponse = await inserted;
    expect(insertedResponse.status()).toBe(201);
    const insertedNode = (await insertedResponse.json()) as { node_id: string };
    await expect.poll(async () => (await document()).editable_map.map.nodes.length).toBe(4);
    const after = (await document()).editable_map.map.nodes;
    const insertedPosition = after.find(
        (node) => node.id === insertedNode.node_id,
    )?.position;
    const leftPosition = after.find((node) => node.id === left.id)?.position;
    const rightPosition = after.find((node) => node.id === right.id)?.position;
    const farPosition = after.find((node) => node.id === far.id)?.position;
    expect(leftPosition?.r).toBe(0);
    expect(rightPosition?.r).toBe(0);
    expect(farPosition?.r).toBe(0);
    expect(insertedPosition?.r).toBe(0);
    expect(Math.abs((leftPosition?.q ?? 0) - (rightPosition?.q ?? 0))).toBe(2);
    expect(insertedPosition?.q).toBe(
        ((leftPosition?.q ?? 0) + (rightPosition?.q ?? 0)) / 2,
    );
    expect(Math.abs((farPosition?.q ?? 0) - (rightPosition?.q ?? 0))).toBe(1);

    const history = await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}/layout-versions?page=1&per_page=6`);
    expect(history.ok()).toBeTruthy();
    expect((await history.json()) as { total: number }).toMatchObject({ total: 0 });
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
