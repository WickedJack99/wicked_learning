import { expect, test } from './authenticated';

test('a local world author can reset a disposable node’s learner tool unlocks', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const headers = { Origin: new URL(page.url()).origin, 'X-CSRF-Token': token };
    const map = await page.request.post('/api/v1/admin/world-builder/maps', {
        data: { title: `Unlock reset ${Date.now()}`, description: null, slug: null },
        headers,
    });
    expect(map.status()).toBe(201);
    const { map_id: mapId } = (await map.json()) as { map_id: string };
    const node = await page.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, {
        data: {
            title: 'Disposable unlock target',
            description: null,
            position_q: 0,
            position_r: 0,
            state: 'locked',
            visual_config: {},
        },
        headers,
    });
    expect(node.status()).toBe(201);
    const { node_id: nodeId } = (await node.json()) as { node_id: string };

    const reset = await page.request.post(
        `/api/v1/admin/world-builder/nodes/${nodeId}/reset-unlocks`,
        { headers },
    );
    expect(reset.status()).toBe(200);
    expect(await reset.json()).toEqual({ reset_count: 0 });

    expect(
        (await page.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers })).status(),
    ).toBe(204);
});
