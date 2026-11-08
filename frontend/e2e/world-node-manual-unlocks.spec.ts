import { expect, test } from '@playwright/test';

test('a local support-author can set and revoke a manual node override', async ({ page }) => {
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
        data: { title: `Manual unlock ${Date.now()}`, description: null, slug: null },
        headers,
    });
    expect(map.status()).toBe(201);
    const { map_id: mapId } = (await map.json()) as { map_id: string };
    const node = await page.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, {
        data: {
            title: 'Manual unlock target',
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

    await page.goto('/settings?panel=admin-learning-support&support=support-signals');
    await expect(page.getByRole('heading', { name: 'Learning Support' })).toBeVisible();
    await page.getByLabel('Node').selectOption(nodeId);
    const opened = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/nodes/${nodeId}/manual-unlocks`));
    await page.getByRole('button', { name: 'Open for learner' }).click();
    expect((await opened).status()).toBe(204);
    await expect(page.getByRole('button', { name: 'Close access' }).last()).toBeVisible();
    const closed = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/nodes/${nodeId}/manual-unlocks`));
    await page.getByRole('button', { name: 'Close access' }).last().click();
    expect((await closed).status()).toBe(204);

    expect(
        (await page.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers })).status(),
    ).toBe(204);
});
