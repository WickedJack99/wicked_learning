import { expect, test } from './authenticated';

test('a local author restores source hex-grid tile placement history', async ({ page }) => {
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

    const title = `Map layout ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    const exportHref = await page.getByRole('link', { name: 'Export map' }).getAttribute('href');
    const mapId = exportHref?.match(/maps\/([^/]+)\/export$/)?.[1];
    if (!mapId) throw new Error('the created map did not expose its export route');

    for (let count = 0; count < 2; count += 1) {
        const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/v1/admin/world-builder/maps/${mapId}/assets`));
        await page.getByRole('button', { name: 'Add MapAsset' }).click();
        expect((await created).status()).toBe(201);
    }
    const document = async () => (await (await page.request.get(`/api/v1/admin/world-builder/maps/${mapId}`)).json()) as { editable_map: { map: { nodes: Array<{ id: string; title: string; position: { q: number; r: number } }> } } };
    await expect.poll(async () => (await document()).editable_map.map.nodes.length).toBe(2);
    const node = (await document()).editable_map.map.nodes[0];

    const place = async (q: number, r: number) => {
        await page.locator(`[data-wl-id="authoring.map-node-position.${node.id}"]`).click();
        await page.getByLabel('Grid q').fill(String(q));
        await page.getByLabel('Grid r').fill(String(r));
        const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/admin/world-builder/nodes/${node.id}/position`));
        await page.getByRole('button', { name: 'Save placement' }).click();
        expect((await saved).status()).toBe(200);
        await expect.poll(async () => (await document()).editable_map.map.nodes.find((item) => item.id === node.id)?.position).toEqual({ q, r });
    };
    await place(10, 10);
    await place(11, 10);

    await page.getByRole('button', { name: 'Tile layout history' }).click();
    const history = page.locator('[data-wl-id="authoring.world-builder.map-layout-history.dialog"]');
    await expect(history.getByText('Ready to restore.').first()).toBeVisible();
    await history.getByRole('button', { name: 'Preview positions' }).first().click();
    await expect(history.getByText(/saved \(10, 10\)/)).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    const restored = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/layout-versions/') && response.url().endsWith('/restore'));
    await history.getByRole('button', { name: 'Restore layout' }).first().click();
    expect((await restored).status()).toBe(204);
    await expect.poll(async () => (await document()).editable_map.map.nodes.find((item) => item.id === node.id)?.position).toEqual({ q: 10, r: 10 });
    await expect(history).toBeHidden();
    await page.getByRole('button', { name: 'Delete map' }).click();
    await page.getByRole('button', { name: 'Delete world map' }).click();
});
