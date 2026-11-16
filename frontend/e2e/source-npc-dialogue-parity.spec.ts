import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

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

test('the pinned source NPC dialogue route emits its original transition visit from Start', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 796 });
    await page.goto('/source-npc-dialogue-parity-harness.html');

    const source = page.locator(
        '.react-flow__handle.source[data-nodeid="start"][data-handleid="start"]',
    );
    const target = page.locator(
        '.react-flow__handle.target[data-nodeid="102"][data-handleid="in"]',
    );
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();

    const [request] = await Promise.all([
        page.waitForRequest((candidate) =>
            candidate.method() === 'POST' &&
            candidate.url().endsWith('/settings/worlds/activities/900/npc-dialogue/transitions'),
        ),
        dragBetween(page, source, target),
    ]);

    expect(request.postDataJSON()).toEqual({
        from_connector: 'start',
        from_dialogue_node_id: null,
        to_connector: 'in',
        to_dialogue_node_id: 102,
    });
});
