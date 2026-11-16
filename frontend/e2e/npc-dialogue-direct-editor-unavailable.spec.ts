import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const activityId = '00000000-0000-4000-8000-000000000701';
const unavailableCopy =
    'World builder settings are not available with the current permissions.';
const viewports = [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
];

async function expectBounded(
    locator: Locator,
    viewport: { height: number; width: number },
): Promise<void> {
    await expect(locator).toBeVisible();
    const bounds = await locator.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}

async function expectUnavailableAtBothViewports(page: Page): Promise<void> {
    const unavailable = page.getByText(unavailableCopy, { exact: true });

    for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await expectBounded(unavailable, viewport);
    }
}

test('the direct NPC dialogue document keeps the pinned-source unavailable panel while its Rust read is pending', async ({
    page,
}) => {
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route(
        `**/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
        async (route) => {
            await pending;
            await route.fulfill({ status: 503 });
        },
    );

    await page.goto('/npc-dialogue-direct-editor-harness.html');
    await expectUnavailableAtBothViewports(page);
    release?.();
    await expectUnavailableAtBothViewports(page);
});

for (const response of [
    { label: 'unauthenticated', status: 401 },
    { label: 'forbidden', status: 403 },
    { label: 'not found', status: 404 },
    { label: 'service unavailable', status: 503 },
]) {
    test(`the direct NPC dialogue document keeps the pinned-source unavailable panel for Rust ${response.label}`, async ({
        page,
    }) => {
        await page.route(
            `**/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify({ code: 'npc_dialogue_unavailable' }),
                    contentType: 'application/problem+json',
                    status: response.status,
                });
            },
        );

        await page.goto('/npc-dialogue-direct-editor-harness.html');
        await expectUnavailableAtBothViewports(page);
    });
}

test('the direct NPC dialogue document keeps the pinned-source unavailable panel for a Rust network failure', async ({
    page,
}) => {
    await page.route(
        `**/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
        async (route) => {
            await route.abort('failed');
        },
    );

    await page.goto('/npc-dialogue-direct-editor-harness.html');
    await expectUnavailableAtBothViewports(page);
});
