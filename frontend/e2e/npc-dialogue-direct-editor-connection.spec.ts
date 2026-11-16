import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

const activityId = '00000000-0000-4000-8000-000000000701';
const greetingId = '00000000-0000-4000-8000-000000000702';

const graph = {
    activity: {
        graph_layout: {},
        id: activityId,
        introduction: null,
        slug: 'archivist-dialogue',
        title: 'Archivist dialogue',
    },
    dialogue_nodes: [
        {
            body: 'Welcome to the archive.',
            config: {},
            connector: null,
            id: greetingId,
            node_type: 'npc_monologue',
            position: { x: 120, y: 0 },
            title: 'Archivist greeting',
        },
        {
            body: null,
            config: {},
            connector: null,
            id: '00000000-0000-4000-8000-000000000703',
            node_type: 'end',
            position: { x: 440, y: 0 },
            title: 'End A',
        },
    ],
    map: {
        id: '00000000-0000-4000-8000-000000000704',
        slug: 'archive',
        title: 'Archive',
    },
    node: {
        id: '00000000-0000-4000-8000-000000000705',
        slug: 'notice-the-map',
        title: 'Notice the map',
    },
    transitions: [],
    typing_sound_sets: [],
    world: {
        id: '00000000-0000-4000-8000-000000000706',
        slug: 'library-world',
        title: 'Library world',
    },
    world_nodes: [],
};

async function dragBetween(
    page: Page,
    source: Locator,
    target: Locator,
): Promise<void> {
    const sourceBounds = await source.boundingBox();
    const targetBounds = await target.boundingBox();

    expect(sourceBounds).not.toBeNull();
    expect(targetBounds).not.toBeNull();

    await page.mouse.move(
        sourceBounds!.x + sourceBounds!.width / 2,
        sourceBounds!.y + sourceBounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        targetBounds!.x + targetBounds!.width / 2,
        targetBounds!.y + targetBounds!.height / 2,
        { steps: 12 },
    );
    await page.mouse.up();
}

test('the direct NPC dialogue adapter maps the pinned Start handle to Rust out', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route(
        `**/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue`,
        async (route) => {
            await route.fulfill({ json: graph });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        `**/api/v1/admin/world-builder/activities/${activityId}/npc-dialogue/transitions`,
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 201 });
        },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/npc-dialogue-direct-editor-harness.html');

    const source = page.locator(
        '.react-flow__handle.source[data-nodeid="start"][data-handleid="start"]',
    );
    const target = page.locator(
        `.react-flow__handle.target[data-nodeid="${greetingId}"][data-handleid="in"]`,
    );
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();

    await dragBetween(page, source, target);

    await expect.poll(() => commandBody).toEqual({
        from_connector: 'out',
        from_node_id: null,
        to_connector: 'in',
        to_node_id: greetingId,
    });
});
