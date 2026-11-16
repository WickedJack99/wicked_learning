import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

import type { components } from '../src/api/schema';
import { sourceMarkdownActivity } from '../src/lifted-world-builder-edit-markdown-activity-adapter';

async function expectBounded(locator: Locator, width: number): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeVisible();
    const bounds = await locator.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
}

test('maps only a scoped Rust Markdown activity into the pinned-source page contract', () => {
    const graph = {
        activities: [
            {
                activity_type: 'markdown',
                config: {
                    markdownGraphLayout: { start: { x: -320, y: 110 } },
                    markdownPages: [],
                    markdownTransitions: [],
                },
                id: '00000000-0000-4000-8000-000000000701',
                introduction: 'Start with this activity.',
                slug: 'source-markdown',
                title: 'Source markdown',
                updated_at: '2026-11-16T12:00:00Z',
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
        world: {
            id: '00000000-0000-4000-8000-000000000704',
            slug: 'library',
            title: 'Library',
        },
    } as unknown as components['schemas']['AdminActivityGraph'];

    expect(
        sourceMarkdownActivity(
            graph,
            '00000000-0000-4000-8000-000000000701',
        ),
    ).toMatchObject({
        activity: {
            id: '00000000-0000-4000-8000-000000000701',
            type: 'markdown',
            updatedAt: '2026-11-16T12:00:00Z',
        },
        map: graph.map,
        node: graph.node,
        world: graph.world,
    });
    expect(
        sourceMarkdownActivity(
            graph,
            '00000000-0000-4000-8000-000000000999',
        ),
    ).toBeNull();
});

for (const viewport of [
    { height: 900, name: 'desktop', width: 1440 },
    { height: 844, name: 'narrow', width: 390 },
]) {
    test(`renders the pinned-source Markdown editor controls at the ${viewport.name} viewport`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto('/markdown-direct-editor-harness.html');

        await expect(
            page.getByRole('heading', { name: 'Source markdown pages' }),
        ).toBeVisible();
        await expect(
            page.getByText('Archive / Reading room', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Markdown page graph', { exact: true }),
        ).toBeVisible();
        await expect(page.locator('.react-flow__renderer')).toHaveCSS(
            'width',
            /[1-9]/,
        );
        await expectBounded(
            page.getByRole('heading', { name: 'First page' }),
            viewport.width,
        );
        await expectBounded(
            page.getByRole('button', { name: 'Add page' }),
            viewport.width,
        );
        await expectBounded(
            page.getByRole('button', { name: 'Save pages' }),
            viewport.width,
        );

        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await expect(page.getByLabel('Selected page')).toHaveValue('First page');
        await expect(page.getByRole('textbox', { name: 'Markdown' })).toBeVisible();
        await expectBounded(
            page.getByRole('button', { name: 'Upload media' }),
            viewport.width,
        );
    });
}

test('keeps the Rust save-unavailable state in the source footer error slot', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/markdown-direct-editor-harness.html?failure=1');
    await page.getByRole('button', { name: 'Save pages' }).click();

    await expect(
        page.getByText(
            'The Markdown pages could not be saved. Refresh and try again.',
            { exact: true },
        ),
    ).toBeVisible();
});
