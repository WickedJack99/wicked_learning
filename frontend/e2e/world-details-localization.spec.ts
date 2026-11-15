import { expect, test } from './authenticated';
import type { Page } from '@playwright/test';

const worldId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d21';
const versionId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d22';

async function mockWorldBuilderShell(page: Page) {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                capabilities: [],
                email: 'world-details-author@example.test',
                roles: ['administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d23',
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
                    description: 'Current world description.',
                    id: worldId,
                    slug: 'mocked-world',
                    title: 'Current World',
                    updated_at: '2026-11-14T12:34:00Z',
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
}

test('lifted source world-details dialog preserves the Rust history and restore contract at desktop and narrow viewports', async ({
    page,
}) => {
    await mockWorldBuilderShell(page);
    await page.route(
        new RegExp('/api/v1/admin/world-builder/world/versions(?:\\?.*)?$'),
        async (route) => {
            expect(new URL(route.request().url()).searchParams.toString()).toBe(
                'page=1&per_page=1',
            );
            await route.fulfill({
                body: JSON.stringify({
                    items: [
                        {
                            created_at: '2026-11-14T12:30:00Z',
                            description: '',
                            id: versionId,
                            title: 'Original World',
                        },
                    ],
                    last_page: 2,
                    page: 1,
                    per_page: 1,
                    total: 2,
                }),
                contentType: 'application/json',
            });
        },
    );
    await page.route(
        `**/api/v1/admin/world-builder/world/versions/${versionId}`,
        async (route) => {
            expect(await route.request().headerValue('x-csrf-token')).toBe(
                'test-csrf-token',
            );
            await route.fulfill({
                body: JSON.stringify({
                    description: '',
                    id: worldId,
                    title: 'Original World',
                    updated_at: '2026-11-14T12:35:00Z',
                }),
                contentType: 'application/json',
            });
        },
    );

    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Edit world details' }).click();

    const dialog = page.locator(
        '[data-wl-id="settings.world-builder.world-details-dialog"]',
    );
    await expect(
        dialog.getByRole('heading', { name: 'Edit world details' }),
    ).toBeVisible();
    await expect(
        dialog.getByText(
            'Update the author-facing title and description. The canonical world slug stays unchanged.',
        ),
    ).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Previous versions' })).toBeVisible();
    await expect(
        dialog.getByText('Restoring creates a new version of the current details.'),
    ).toBeVisible();
    await expect(dialog.getByText('No description')).toBeVisible();
    await expect(dialog.getByText('Page 1 of 2')).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Restore this version' }),
    ).toBeVisible();

    const desktopBounds = await dialog.boundingBox();
    expect(desktopBounds).not.toBeNull();
    expect(desktopBounds!.width).toBeLessThanOrEqual(672);
    expect(desktopBounds!.height).toBeLessThanOrEqual(704);

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(dialog).toBeVisible();
    const narrowBounds = await dialog.boundingBox();
    expect(narrowBounds).not.toBeNull();
    expect(narrowBounds!.x).toBeGreaterThanOrEqual(0);
    expect(narrowBounds!.x + narrowBounds!.width).toBeLessThanOrEqual(390);
    expect(narrowBounds!.y).toBeGreaterThanOrEqual(0);
    expect(narrowBounds!.y + narrowBounds!.height).toBeLessThanOrEqual(844);

    page.once('dialog', (confirm) => {
        expect(confirm.message()).toBe(
            'Restore this world detail version? The current details will be preserved in history.',
        );
        void confirm.accept();
    });
    const restored = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().includes(`/world/versions/${versionId}`),
    );
    await dialog.getByRole('button', { name: 'Restore this version' }).click();
    expect((await restored).status()).toBe(200);
    await expect(dialog.getByLabel('Title')).toHaveValue('Original World');
    await expect(dialog.getByLabel('Description')).toHaveValue('');
});

test('lifted source world-details dialog shows its history failure state when Rust is unavailable', async ({
    page,
}) => {
    await mockWorldBuilderShell(page);
    await page.route(
        new RegExp('/api/v1/admin/world-builder/world/versions(?:\\?.*)?$'),
        async (route) => {
            await route.fulfill({ status: 503 });
        },
    );

    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/settings?panel=admin-world-builder');
    await page.getByRole('button', { name: 'Edit world details' }).click();

    const dialog = page.locator(
        '[data-wl-id="settings.world-builder.world-details-dialog"]',
    );
    await expect(
        dialog.getByText('World history could not be loaded. Try again.', {
            exact: true,
        }),
    ).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
