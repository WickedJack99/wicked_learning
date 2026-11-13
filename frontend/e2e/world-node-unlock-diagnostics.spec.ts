import { expect, test } from './authenticated';

test('a local author sees an opening-path warning for an unreachable tile prerequisite', async ({ page }) => {
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
        data: { title: `Opening path ${Date.now()}`, description: null, slug: null },
        headers,
    });
    expect(map.status()).toBe(201);
    const { map_id: mapId } = (await map.json()) as { map_id: string };
    try {
        const prerequisite = await page.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, {
            data: {
                title: 'Blocked prerequisite',
                description: null,
                position_q: 0,
                position_r: 0,
                state: 'locked',
                visual_config: {},
            },
            headers,
        });
        expect(prerequisite.status()).toBe(201);
        const { node_id: prerequisiteId } = (await prerequisite.json()) as { node_id: string };
        const target = await page.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, {
            data: {
                title: 'Dependent tile',
                description: null,
                position_q: 1,
                position_r: 0,
                state: 'locked',
                visual_config: {
                    unlock: {
                        enabled: true,
                        rules: { type: 'node_completed', nodeId: prerequisiteId },
                    },
                },
            },
            headers,
        });
        expect(target.status()).toBe(201);
        const { node_id: targetId } = (await target.json()) as { node_id: string };

        await page.goto(`/settings?panel=admin-world-builder&map=${mapId}`);
        await page.locator(`[data-wl-id="authoring.map-node-edit.${targetId}"]`).click();
        const warning = page.locator('[data-wl-id="authoring.world-builder.node.unlock-diagnostics"]');
        await expect(warning).toContainText('Check this opening path');
        await expect(warning).toContainText('Blocked prerequisite');
    } finally {
        expect(
            (await page.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers })).status(),
        ).toBe(204);
    }
});
