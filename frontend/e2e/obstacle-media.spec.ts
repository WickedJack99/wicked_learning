import { expect, test } from './authenticated';

test('a local author selects reusable activity visuals and map cleanup removes their references', async ({
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
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M2 2h20v20H2z" fill="#be123c"/></svg>',
        ),
        mimeType: 'image/svg+xml',
        name: 'obstacle-visual.svg',
    });
    const uploaded = await uploadedResponse;
    expect(uploaded.status()).toBe(201);
    const media = (await uploaded.json()) as {
        asset: { id: string; url: string };
    };
    await expect(
        page.locator(`img[src="${media.asset.url}"]`).first(),
    ).toBeVisible();
    await page
        .getByRole('button')
        .filter({ has: page.locator(`img[src="${media.asset.url}"]`) })
        .click();
    const mediaName = `Obstacle visual ${Date.now()}`;
    await page.getByLabel('Visual name').fill(mediaName);
    const savedMetadata = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes(`/api/v1/admin/media-assets/${media.asset.id}`),
    );
    await page.getByRole('button', { name: 'Save details' }).click();
    expect((await savedMetadata).status()).toBe(200);

    await page.goto('/settings?panel=admin-world-builder');
    const mapTitle = `Disposable Obstacle media map ${Date.now()}`;
    await page.getByRole('button', { name: 'Create map' }).click();
    await page.getByLabel('Title').fill(mapTitle);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: mapTitle })).toBeVisible();
    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string; title: string }>;
    };
    const map = graph.maps.find((candidate) => candidate.title === mapTitle);
    if (!map) throw new Error('the disposable obstacle map is missing');

    const createdAssetResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/maps/${map.id}/assets`),
    );
    await page.getByRole('button', { name: 'Add MapAsset' }).click();
    const createdAsset = await createdAssetResponse;
    expect(createdAsset.status()).toBe(201);
    const { node_id: nodeId } = (await createdAsset.json()) as {
        node_id: string;
    };
    await page.goto(
        `/settings?panel=admin-world-builder&map=${map.id}&node=${nodeId}`,
    );
    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };
    const origin = new URL(page.url()).origin;
    await expect(page.getByText('Activity graph')).toBeVisible();
    await page.getByRole('button', { name: 'Obstacle', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Obstacle' }),
    ).toBeVisible();
    const createForm = page.getByRole('dialog', { name: 'Add Obstacle' });
    const activityTitle = `Disposable Obstacle ${Date.now()}`;
    await createForm.getByLabel('Title').fill(activityTitle);
    const createdActivityResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/nodes/${nodeId}/obstacle-activities`),
    );
    await createForm.getByRole('button', { name: 'Create activity' }).click();
    expect((await createdActivityResponse).status()).toBe(201);

    const nodeResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${nodeId}`,
    );
    expect(nodeResponse.ok()).toBeTruthy();
    const nodeDocument = (await nodeResponse.json()) as {
        activity_graph: {
            activities: Array<{ id: string; title: string }>;
        };
    };
    const activity = nodeDocument.activity_graph.activities.find(
        (candidate) => candidate.title === activityTitle,
    );
    if (!activity) throw new Error('the disposable Obstacle activity is missing');

    await page
        .locator(`[data-id="${activity.id}"]`)
        .getByRole('button', { name: `Edit ${activityTitle}` })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Edit Obstacle' }),
    ).toBeVisible();
    const activityForm = page.getByRole('dialog', { name: 'Edit Obstacle' });
    await activityForm.getByRole('button', { name: 'Select existing' }).first().click();
    await expect(
        page.getByRole('heading', { name: 'Select existing visual' }),
    ).toBeVisible();
    await page.getByLabel('Search reusable visuals').fill(mediaName);
    await page.getByRole('button', { name: mediaName }).click();
    await expect(activityForm.getByLabel('Dark background')).toHaveValue(
        media.asset.url,
    );
    const savedVisual = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/activities/${activity.id}/obstacle`,
                ),
    );
    await activityForm.getByRole('button', { name: 'Save activity' }).click();
    expect((await savedVisual).status()).toBe(200);

    const nodeAfterSelection = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${nodeId}`,
    );
    expect(nodeAfterSelection.ok()).toBeTruthy();
    const selectedDocument = (await nodeAfterSelection.json()) as {
        activity_graph: {
            activities: Array<{
                config: { backgroundDark?: string | null };
                id: string;
            }>;
        };
    };
    expect(
        selectedDocument.activity_graph.activities.find(
            (candidate) => candidate.id === activity.id,
        )?.config.backgroundDark,
    ).toBe(media.asset.url);
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

    await page.getByRole('button', { name: 'Tool grant', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Tool grant' }),
    ).toBeVisible();
    const createGrantForm = page.getByRole('dialog', {
        name: 'Add Tool grant',
    });
    const grantTitle = `Disposable Tool grant ${Date.now()}`;
    await createGrantForm.getByLabel('Title').fill(grantTitle);
    const createdGrantResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/nodes/${nodeId}/tool-grant-activities`),
    );
    await createGrantForm
        .getByRole('button', { name: 'Create activity' })
        .click();
    expect((await createdGrantResponse).status()).toBe(201);

    const nodeWithGrantResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${nodeId}`,
    );
    expect(nodeWithGrantResponse.ok()).toBeTruthy();
    const nodeWithGrant = (await nodeWithGrantResponse.json()) as {
        activity_graph: { activities: Array<{ id: string; title: string }> };
    };
    const grant = nodeWithGrant.activity_graph.activities.find(
        (candidate) => candidate.title === grantTitle,
    );
    if (!grant) throw new Error('the disposable Tool grant activity is missing');

    await page
        .locator(`[data-id="${grant.id}"]`)
        .getByRole('button', { name: `Edit ${grantTitle}` })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Edit Tool grant' }),
    ).toBeVisible();
    const grantForm = page.getByRole('dialog', { name: 'Edit Tool grant' });
    await grantForm.getByRole('button', { name: 'Select existing' }).first().click();
    await expect(
        page.getByRole('heading', { name: 'Select existing visual' }),
    ).toBeVisible();
    await page.getByLabel('Search reusable visuals').fill(mediaName);
    await page.getByRole('button', { name: mediaName }).click();
    await expect(grantForm.getByLabel('Dark background')).toHaveValue(
        media.asset.url,
    );
    const savedGrantVisual = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/activities/${grant.id}/tool-grant`,
                ),
    );
    await grantForm.getByRole('button', { name: 'Save activity' }).click();
    expect((await savedGrantVisual).status()).toBe(200);
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
        .toBe(2);

    const itemGrantTitle = `Disposable Item grant ${Date.now()}`;
    await page.getByRole('button', { name: 'Item grant', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Item grant' }),
    ).toBeVisible();
    const createItemGrantForm = page.getByRole('dialog', {
        name: 'Add Item grant',
    });
    await createItemGrantForm.getByLabel('Title').fill(itemGrantTitle);
    const createdItemGrantResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/nodes/${nodeId}/item-grant-activities`),
    );
    await createItemGrantForm
        .getByRole('button', { name: 'Create activity' })
        .click();
    expect((await createdItemGrantResponse).status()).toBe(201);

    const nodeWithItemGrantResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${nodeId}`,
    );
    expect(nodeWithItemGrantResponse.ok()).toBeTruthy();
    const nodeWithItemGrant = (await nodeWithItemGrantResponse.json()) as {
        activity_graph: { activities: Array<{ id: string; title: string }> };
    };
    const itemGrant = nodeWithItemGrant.activity_graph.activities.find(
        (candidate) => candidate.title === itemGrantTitle,
    );
    if (!itemGrant) throw new Error('the disposable Item grant activity is missing');

    await page
        .locator(`[data-id="${itemGrant.id}"]`)
        .getByRole('button', { name: `Edit ${itemGrantTitle}` })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Edit Item grant' }),
    ).toBeVisible();
    const itemGrantForm = page.getByRole('dialog', {
        name: 'Edit Item grant',
    });
    await itemGrantForm
        .getByRole('button', { name: 'Select existing' })
        .first()
        .click();
    await expect(
        page.getByRole('heading', { name: 'Select existing visual' }),
    ).toBeVisible();
    await page.getByLabel('Search reusable visuals').fill(mediaName);
    await page.getByRole('button', { name: mediaName }).click();
    await expect(itemGrantForm.getByLabel('Dark background')).toHaveValue(
        media.asset.url,
    );
    const savedItemGrantVisual = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/activities/${itemGrant.id}/item-grant`,
                ),
    );
    await itemGrantForm.getByRole('button', { name: 'Save activity' }).click();
    expect((await savedItemGrantVisual).status()).toBe(200);
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
        .toBe(3);

    await page.getByRole('button', { name: 'Item obstacle', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Add Item obstacle' }),
    ).toBeVisible();
    const createItemObstacleForm = page.getByRole('dialog', {
        name: 'Add Item obstacle',
    });
    const itemObstacleTitle = `Disposable Item obstacle ${Date.now()}`;
    await createItemObstacleForm.getByLabel('Title').fill(itemObstacleTitle);
    const createdItemObstacleResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response
                .url()
                .includes(`/api/v1/admin/world-builder/nodes/${nodeId}/item-obstacle-activities`),
    );
    await createItemObstacleForm
        .getByRole('button', { name: 'Create activity' })
        .click();
    expect((await createdItemObstacleResponse).status()).toBe(201);

    const nodeWithItemObstacleResponse = await page.request.get(
        `/api/v1/admin/world-builder/nodes/${nodeId}`,
    );
    expect(nodeWithItemObstacleResponse.ok()).toBeTruthy();
    const nodeWithItemObstacle = (await nodeWithItemObstacleResponse.json()) as {
        activity_graph: { activities: Array<{ id: string; title: string }> };
    };
    const itemObstacle = nodeWithItemObstacle.activity_graph.activities.find(
        (candidate) => candidate.title === itemObstacleTitle,
    );
    if (!itemObstacle) {
        throw new Error('the disposable Item obstacle activity is missing');
    }

    await page
        .locator(`[data-id="${itemObstacle.id}"]`)
        .getByRole('button', { name: `Edit ${itemObstacleTitle}` })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Edit Item obstacle' }),
    ).toBeVisible();
    const itemObstacleForm = page.getByRole('dialog', {
        name: 'Edit Item obstacle',
    });
    await itemObstacleForm
        .getByRole('button', { name: 'Select existing' })
        .first()
        .click();
    await expect(
        page.getByRole('heading', { name: 'Select existing visual' }),
    ).toBeVisible();
    await page.getByLabel('Search reusable visuals').fill(mediaName);
    await page.getByRole('button', { name: mediaName }).click();
    await expect(itemObstacleForm.getByLabel('Dark background')).toHaveValue(
        media.asset.url,
    );
    const savedItemObstacleVisual = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response
                .url()
                .includes(
                    `/api/v1/admin/world-builder/activities/${itemObstacle.id}/item-obstacle`,
                ),
    );
    await itemObstacleForm
        .getByRole('button', { name: 'Save activity' })
        .click();
    expect((await savedItemObstacleVisual).status()).toBe(200);
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
        .toBe(4);

    await page.goto(
        `/settings?panel=admin-world-builder&map=${map.id}`,
    );
    await expect(page.getByRole('button', { name: 'Delete map' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete map' }).click();
    await expect(
        page.getByRole('heading', { name: 'Delete world map?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete world map' }).click();
    await expect(page).toHaveURL(/\/settings\?panel=admin-world-builder$/);

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
