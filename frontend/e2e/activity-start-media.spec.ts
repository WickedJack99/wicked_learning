import { expect, test } from './authenticated';

test('a local author selects a reusable route visual and its reference cleans up', async ({
    page,
}) => {
    test.setTimeout(60_000);
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

    await page.goto('/settings?panel=admin-assets');
    const uploadedResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/api/v1/admin/media-assets'),
    );
    await page.locator('input[type="file"]').first().setInputFiles({
        buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#7c3aed"/></svg>',
        ),
        mimeType: 'image/svg+xml',
        name: 'route-visual.svg',
    });
    const uploaded = await uploadedResponse;
    expect(uploaded.status()).toBe(201);
    const media = (await uploaded.json()) as { asset: { id: string } };
    const mediaName = `Route visual ${Date.now()}`;
    await expect(page.getByLabel('Visual name')).toHaveValue('Uploaded visual');
    await page.getByLabel('Visual name').fill(mediaName);
    const savedMetadata = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes(`/api/v1/admin/media-assets/${media.asset.id}`),
    );
    await page.getByRole('button', { name: 'Save details' }).click();
    const savedAsset = await savedMetadata;
    expect(savedAsset.status()).toBe(200);
    await expect(savedAsset.json()).resolves.toMatchObject({
        asset: { display_name: mediaName, id: media.asset.id },
    });

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; nodes: Array<{ id: string }> }>;
    };
    let candidate:
        | { activityId: string; mapId: string; nodeId: string }
        | undefined;
    for (const map of graph.maps) {
        for (const node of map.nodes) {
            const nodeResponse = await page.request.get(
                `/api/v1/admin/world-builder/nodes/${node.id}`,
            );
            if (!nodeResponse.ok()) continue;
            const document = (await nodeResponse.json()) as {
                activity_graph: {
                    activities: Array<{
                        activity_type: string;
                        config: { portalMode?: string };
                        id: string;
                    }>;
                    node: { start_routes: Array<{ activity_id: string }> };
                };
            };
            const started = new Set(
                document.activity_graph.node.start_routes.map(
                    (route) => route.activity_id,
                ),
            );
            const activity = document.activity_graph.activities.find(
                (item) =>
                    !started.has(item.id) &&
                    !(
                        item.activity_type === 'portal' &&
                        item.config.portalMode === 'input'
                    ),
            );
            if (activity) {
                candidate = {
                    activityId: activity.id,
                    mapId: map.id,
                    nodeId: node.id,
                };
                break;
            }
        }
        if (candidate) break;
    }
    if (!candidate) {
        throw new Error('local World Builder seed has no eligible unused activity');
    }

    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };
    const origin = new URL(page.url()).origin;
    const added = await page.request.post(
        `/api/v1/admin/world-builder/nodes/${candidate.nodeId}/start-routes`,
        {
            data: { activity_id: candidate.activityId },
            headers: { Origin: origin, 'X-CSRF-Token': token },
        },
    );
    expect(added.status()).toBe(200);
    const starts = (await added.json()) as {
        start_routes: Array<{ activity_id: string; id: string }>;
    };
    const start = starts.start_routes.find(
        (route) => route.activity_id === candidate!.activityId,
    );
    if (!start) throw new Error('the created route start is absent from its response');

    await page.goto(
        `/settings?panel=admin-world-builder&map=${candidate.mapId}&node=${candidate.nodeId}`,
    );
    await expect(page.getByText('Activity graph')).toBeVisible();
    await page
        .locator(`[data-id="__start-edge:${start.id}"]`)
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Route visuals' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Select existing' }).first().click();
    await expect(
        page.getByRole('heading', { name: 'Select existing visual' }),
    ).toBeVisible();
    await page.getByRole('button', { name: mediaName }).click();
    const savedRoute = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/start-routes/${start.id}`),
    );
    await page
        .getByRole('dialog', { name: 'Route visuals' })
        .getByRole('button', { name: 'Save', exact: true })
        .click();
    expect((await savedRoute).status()).toBe(200);

    await expect
        .poll(async () => {
            const response = await page.request.get(
                `/api/v1/admin/media-assets?page=1&per_page=12&q=${encodeURIComponent(mediaName)}`,
            );
            const assets = (await response.json()) as {
                items: Array<{ id: string; reference_count: number }>;
            };
            return assets.items.find((asset) => asset.id === media.asset.id)
                ?.reference_count;
        })
        .toBe(1);

    const deleted = await page.request.delete(
        `/api/v1/admin/world-builder/start-routes/${start.id}`,
        { headers: { Origin: origin, 'X-CSRF-Token': token } },
    );
    expect(deleted.status()).toBe(200);
    await expect
        .poll(async () => {
            const response = await page.request.get(
                `/api/v1/admin/media-assets?page=1&per_page=12&q=${encodeURIComponent(mediaName)}`,
            );
            const assets = (await response.json()) as {
                items: Array<{ id: string; reference_count: number }>;
            };
            return assets.items.find((asset) => asset.id === media.asset.id)
                ?.reference_count;
        })
        .toBe(0);
    const deletedMedia = await page.request.delete(
        `/api/v1/admin/media-assets/${media.asset.id}`,
        { headers: { Origin: origin, 'X-CSRF-Token': token } },
    );
    expect(deletedMedia.status()).toBe(204);
});
