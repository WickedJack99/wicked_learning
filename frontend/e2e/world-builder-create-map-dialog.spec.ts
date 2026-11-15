import { expect, test } from './authenticated';

const ids = {
    map: '00000000-0000-4000-8000-000000000010',
    world: '00000000-0000-4000-8000-000000000001',
};

test('the lifted source create-map dialog retains its source fields, bounds, and Rust validation/create seams', async ({
    page,
}) => {
    let created = false;
    let creates = 0;
    const csrfHeaders: string[] = [];

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-admin@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '00000000-0000-4000-8000-000000000002',
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ locale: 'test', translations: {} }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                maps: created
                    ? [
                          {
                              access_roles: [],
                              description: 'Created from the source dialog.',
                              id: ids.map,
                              node_count: 0,
                              nodes: [],
                              review_count: 0,
                              slug: 'astronomy-garden',
                              title: 'Astronomy Garden',
                              updated_at: '2026-11-15T12:34:00Z',
                          },
                      ]
                    : [],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: ids.world,
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-15T12:34:00Z',
                },
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'test-csrf-token' }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/admin/world-builder/maps', async (route) => {
        csrfHeaders.push(route.request().headers()['x-csrf-token'] ?? '');
        creates += 1;
        if (creates === 1) {
            await route.fulfill({ status: 400 });
            return;
        }
        created = true;
        await route.fulfill({
            body: JSON.stringify({ map_id: ids.map }),
            contentType: 'application/json',
            status: 201,
        });
    });

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/settings?panel=admin-world-builder&worldSection=graph');
    await page.getByRole('button', { name: 'Create world node' }).click();

    const dialog = page.getByRole('dialog');
    await expect(
        dialog.getByRole('heading', { name: 'Create world node' }),
    ).toBeVisible();
    await expect(
        dialog.getByText(
            'Add a new map to this world graph. It can stay unlinked until you create portal tiles for it.',
        ),
    ).toBeVisible();
    await expect(dialog.getByLabel('Title')).toBeVisible();
    await expect(dialog.getByLabel('Slug')).toBeVisible();
    await expect(dialog.getByLabel('Description')).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await dialog.getByLabel('Title').fill('bad map');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog).toContainText(
        'Use a title, a lowercase slug, and a description within the shown limits.',
    );

    await page.setViewportSize({ height: 900, width: 1440 });
    await dialog.getByLabel('Title').fill('Astronomy Garden');
    await dialog.getByLabel('Slug').fill('astronomy-garden');
    await dialog
        .getByLabel('Description')
        .fill('Created from the source dialog.');
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page).toHaveURL(
        new RegExp(`worldSection=graph&map=${ids.map}&worldView=nodes`),
    );
    expect(csrfHeaders).toEqual(['test-csrf-token', 'test-csrf-token']);
});
