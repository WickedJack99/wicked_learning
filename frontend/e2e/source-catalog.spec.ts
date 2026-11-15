import { expect, test } from './authenticated';

test('the pinned-main World Builder Graph does not inject the standalone Source catalog action', async ({
    page,
}) => {
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
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
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
                maps: [],
                portal_candidates: [],
                portal_links: [],
                world: {
                    description: 'A mocked authoring world.',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                    slug: 'mocked-world',
                    title: 'Mocked World',
                    updated_at: '2026-11-14T12:34:00Z',
                },
            }),
            contentType: 'application/json',
        });
    });

    await page.goto('/settings?panel=admin-world-builder');

    const graphWorkspace = page.locator(
        '[data-wl-id="authoring.world-builder.graph-workspace"]',
    );
    await expect(graphWorkspace).toBeVisible();
    await expect(
        graphWorkspace.getByText('Source catalog', { exact: true }),
    ).toHaveCount(0);
    await expect(graphWorkspace.locator('summary')).toHaveCount(0);
});
