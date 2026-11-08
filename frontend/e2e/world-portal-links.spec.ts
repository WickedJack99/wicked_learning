import { expect, test } from '@playwright/test';

test('a local global author can create and remove a node-to-node portal link', async ({ page }) => {
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
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };
    const title = `Global portal ${Date.now()}`;
    const mapResponse = await page.request.post('/api/v1/admin/world-builder/maps', {
        data: { title, description: null, slug: null },
        headers,
    });
    expect(mapResponse.status()).toBe(201);
    const { map_id: mapId } = (await mapResponse.json()) as { map_id: string };
    const createNode = async (nodeTitle: string, q: number) => {
        const response = await page.request.post(
            `/api/v1/admin/world-builder/maps/${mapId}/nodes`,
            {
                data: {
                    title: nodeTitle,
                    description: 'A disposable global portal endpoint.',
                    position_q: q,
                    position_r: 0,
                    state: 'available',
                    visual_config: {},
                },
                headers,
            },
        );
        expect(response.status()).toBe(201);
        return (await response.json()) as { node_id: string };
    };

    const source = await createNode('Global portal source', 0);
    const target = await createNode('Global portal target', 1);
    const created = await page.request.post('/api/v1/admin/world-builder/portal-links', {
        data: {
            source_node_id: source.node_id,
            target_node_id: target.node_id,
            label: 'Across the test map',
            description: 'A source-shaped global link.',
        },
        headers,
    });
    expect(created.status()).toBe(201);
    const { portal_link_id: portalLinkId } = (await created.json()) as { portal_link_id: string };

    const duplicate = await page.request.post('/api/v1/admin/world-builder/portal-links', {
        data: { source_node_id: source.node_id, target_node_id: target.node_id },
        headers,
    });
    expect(duplicate.status()).toBe(409);

    const graph = await page.request.get('/api/v1/admin/world-builder');
    expect(graph.ok()).toBeTruthy();
    const body = (await graph.json()) as {
        portal_links: Array<{
            id: string;
            source_activity: unknown | null;
            target_activity: unknown | null;
        }>;
    };
    expect(body.portal_links.find((link) => link.id === portalLinkId)).toMatchObject({
        id: portalLinkId,
        source_activity: null,
        target_activity: null,
    });

    expect(
        (
            await page.request.delete(
                `/api/v1/admin/world-builder/portal-links/${portalLinkId}`,
                { headers },
            )
        ).status(),
    ).toBe(204);
    expect(
        (await page.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers })).status(),
    ).toBe(204);
});
