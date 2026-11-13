import { expect, test } from './authenticated';

test('a local author swaps adjacent source hex-grid tiles', async ({ page }) => {
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

    const title = `Map swap ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const exportHref = await page
        .getByRole('link', { name: 'Export map', exact: true })
        .getAttribute('href');
    const mapId = exportHref?.match(/maps\/([^/]+)\/export$/)?.[1];
    if (!mapId) throw new Error('the created map did not expose its export route');
    for (let count = 0; count < 2; count += 1) {
        const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/v1/admin/world-builder/maps/${mapId}/assets`));
        await page.getByRole('button', { name: 'Add MapAsset' }).click();
        expect((await created).status()).toBe(201);
    }
    const document = async () => (await (await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}`)).json()) as { editable_map: { map: { nodes: Array<{ id: string; position: { q: number; r: number } }> } } };
    await expect.poll(async () => (await document()).editable_map.map.nodes.length).toBe(2);
    const before = (await document()).editable_map.map.nodes;
    const left = before.find((node) => node.position.q === 0 && node.position.r === 0);
    const right = before.find((node) => node.position.q === 1 && node.position.r === 0);
    if (!left || !right) throw new Error('MapAsset creation did not yield adjacent source hex tiles');

    const swapped = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/admin/world-builder/nodes/${left.id}/swap`));
    await page.locator(`[data-wl-id="authoring.map-node-swap.${left.id}.1.0"]`).click();
    expect((await swapped).status()).toBe(204);
    await expect.poll(async () => (await document()).editable_map.map.nodes.find((node) => node.id === left.id)?.position).toEqual({ q: 1, r: 0 });
    await expect.poll(async () => (await document()).editable_map.map.nodes.find((node) => node.id === right.id)?.position).toEqual({ q: 0, r: 0 });

    const history = await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}/layout-versions?page=1&per_page=6`);
    expect(history.ok()).toBeTruthy();
    expect((await history.json()) as { total: number }).toMatchObject({ total: 1 });
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
