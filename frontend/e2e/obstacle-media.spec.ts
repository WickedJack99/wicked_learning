import { expect, test } from '@playwright/test';

test('a local author selects a reusable obstacle visual and map cleanup removes its reference', async ({
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

    await page.locator(`[data-id="${activity.id}"]`).click();
    await expect(
        page.getByRole('heading', { name: 'Edit Obstacle' }),
    ).toBeVisible();
    const activityForm = page.getByRole('dialog', { name: 'Edit Obstacle' });
    await activityForm.getByRole('button', { name: 'Select existing' }).first().click();
    await expect(
        page.getByRole('heading', { name: 'Select existing visual' }),
    ).toBeVisible();
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
