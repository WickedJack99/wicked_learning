import { expect, test } from './authenticated';

const graph = {
    maps: [],
    portal_candidates: [],
    portal_links: [],
    world: {
        description: 'A mocked authoring world.',
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'mocked-world',
        title: 'Mocked World',
        updated_at: '2026-11-15T12:34:00Z',
    },
};

test('the lifted source map-export validator retains its bounded success and Rust-unavailable states at desktop and narrow viewports', async ({
    page,
}) => {
    let preflightRequests = 0;
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
            body: JSON.stringify(graph),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            body: JSON.stringify({ token: 'test-csrf-token' }),
            contentType: 'application/json',
        });
    });
    await page.route(
        '**/api/v1/admin/world-builder/map-exports/preflight',
        async (route) => {
            csrfHeaders.push(route.request().headers()['x-csrf-token'] ?? '');
            preflightRequests += 1;

            if (preflightRequests === 1) {
                await route.fulfill({
                    body: JSON.stringify({
                        counts: {
                            activities: 2,
                            mapAssets: 3,
                            mediaReferences: 1,
                            nodes: 4,
                            portalTargets: 5,
                        },
                        errors: ['One optional source reference needs review.'],
                        summary: 'The mocked export is structurally ready.',
                        valid: true,
                        warnings: ['The transfer will recheck media.'],
                    }),
                    contentType: 'application/json',
                });
                return;
            }

            await route.fulfill({
                body: JSON.stringify({
                    status: 503,
                    title: 'Service Unavailable',
                    type: 'about:blank',
                }),
                contentType: 'application/problem+json',
                status: 503,
            });
        },
    );

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/settings?panel=admin-world-builder&worldSection=graph');
    await page.getByRole('button', { name: 'Validate map export' }).click();

    const dialog = page.getByRole('dialog');
    await expect(
        dialog.getByRole('heading', { name: 'Validate map export' }),
    ).toBeVisible();
    await expect(
        dialog.getByText(
            'Check an exported map manifest without creating or changing any content.',
        ),
    ).toBeVisible();
    await dialog.getByLabel('JSON export file').setInputFiles({
        buffer: Buffer.from('{"format":"wicked-learning-map"}'),
        mimeType: 'application/json',
        name: 'source-map.json',
    });
    await dialog.getByRole('button', { name: 'Check manifest' }).click();
    await expect(dialog.getByRole('status')).toContainText(
        'The mocked export is structurally ready.',
    );
    await expect(dialog.getByRole('status')).toContainText('Nodes');
    await expect(dialog.getByRole('status')).toContainText('MapAssets');
    await expect(dialog.getByRole('status')).toContainText(
        'One optional source reference needs review.',
    );
    await expect(dialog.getByRole('status')).toContainText(
        'The transfer will recheck media.',
    );

    await page.setViewportSize({ height: 844, width: 390 });
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await dialog
        .locator('form')
        .getByRole('button', { name: 'Close', exact: true })
        .click();
    await page.getByRole('button', { name: 'Validate map export' }).click();
    const unavailableDialog = page.getByRole('dialog');
    await unavailableDialog.getByLabel('JSON export file').setInputFiles({
        buffer: Buffer.from('{"format":"wicked-learning-map"}'),
        mimeType: 'application/json',
        name: 'unavailable-map.json',
    });
    await unavailableDialog
        .getByRole('button', { name: 'Check manifest' })
        .click();
    await expect(unavailableDialog.getByRole('alert')).toHaveText(
        'The manifest could not be checked.',
    );
    expect(csrfHeaders).toEqual(['test-csrf-token', 'test-csrf-token']);
});
