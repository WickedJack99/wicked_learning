import { expect, test } from './authenticated';

test('World Builder localizes unavailable account recovery at narrow and desktop viewports', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-admin@example.test',
                roles: ['administrator'],
                settings_access: { world_activities: true, world_maps: true, world_nodes: true },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.world_builder.status.unavailable_account':
                        'Localized World Builder account recovery.',
                },
            }),
        });
    });
    await page.route('**/api/v1/admin/world-builder', async (route) => {
        await route.fulfill({
            contentType: 'application/problem+json',
            status: 403,
            body: JSON.stringify({ code: 'world_builder_unavailable' }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    const status = page.getByRole('status');
    await expect(status).toHaveText('Localized World Builder account recovery.');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(status).toBeVisible();
    const bounds = await status.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
});

test('World Builder localizes the scoped no-permission panel', async ({ page }) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                capabilities: [],
                email: 'world-builder-learner@example.test',
                roles: ['learner'],
                settings_access: {},
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.world_builder.status.unavailable_permissions':
                        'Localized World Builder permission recovery.',
                },
            }),
        });
    });

    await page.goto('/settings?panel=admin-world-builder');
    await expect(
        page.getByText('Localized World Builder permission recovery.'),
    ).toBeVisible();
});
