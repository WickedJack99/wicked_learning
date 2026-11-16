import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const activityId = '00000000-0000-4000-8000-000000000701';
const unavailableCopy =
    'World builder settings are not available with the current permissions.';
const viewports = [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
];

function graphResponse() {
    return {
        activity: {
            graph_layout: {},
            id: activityId,
            introduction: null,
            slug: 'archivist-dialogue',
            title: 'Archivist',
        },
        dialogue_nodes: [
            {
                body: null,
                config: {},
                connector: {
                    color: '#0ea5e9',
                    id: 'dialogue-end-00000000-0000-4000-8000-000000000710',
                    label: 'A',
                    symbol: 'A',
                },
                id: '00000000-0000-4000-8000-000000000710',
                node_type: 'end',
                position: { x: 140, y: 80 },
                title: 'End A',
            },
        ],
        map: {
            id: '00000000-0000-4000-8000-000000000702',
            slug: 'archive',
            title: 'Archive',
        },
        node: {
            id: '00000000-0000-4000-8000-000000000703',
            slug: 'reading-room',
            title: 'Reading room',
        },
        transitions: [],
        typing_sound_sets: [],
        world: {
            id: '00000000-0000-4000-8000-000000000704',
            slug: 'library',
            title: 'Library',
        },
        world_nodes: [],
    };
}

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
            await route.fulfill({ json: graphResponse() });
        },
    );

    await page.goto('/npc-dialogue-direct-editor-harness.html');
    await expectUnavailableAtBothViewports(page);
    release?.();
    await expect(
        page.getByRole('heading', { name: 'Archivist dialogue' }),
    ).toBeVisible();
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
