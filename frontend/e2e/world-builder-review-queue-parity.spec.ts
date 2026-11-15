import type { Locator, Page } from '@playwright/test';

import { expect, test } from './authenticated';

const ids = {
    activity: '00000000-0000-4000-8000-000000000030',
    map: '00000000-0000-4000-8000-000000000010',
    node: '00000000-0000-4000-8000-000000000020',
};

const viewports = [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
];

function graphResponse() {
    return {
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
}

function reviewPage({
    currentPage = 1,
    items,
    lastPage = 1,
    total = items.length,
}: {
    currentPage?: number;
    items: Array<{
        activity_type: string;
        id: string;
        map: { id: string; title: string };
        node: { id: string; title: string };
        title: string;
    }>;
    lastPage?: number;
    total?: number;
}) {
    return {
        items,
        pagination: {
            current_page: currentPage,
            last_page: lastPage,
            per_page: 4,
            total,
        },
    };
}

function reviewItem(index: number) {
    return {
        activity_type: index % 2 === 0 ? 'markdown' : 'open_practice',
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        map: { id: ids.map, title: 'Source map' },
        node: { id: ids.node, title: 'Source node' },
        title: `Source review activity ${index}`,
    };
}

async function installWorldBuilderRoutes(page: Page) {
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
            body: JSON.stringify(graphResponse()),
            contentType: 'application/json',
        });
    });
}

async function openReviewQueue(
    page: Page,
    viewport: { height: number; width: number },
): Promise<Locator> {
    await page.setViewportSize(viewport);
    await page.goto(
        '/settings?panel=admin-world-builder&worldSection=review',
    );

    const queue = page.locator(
        '[data-wl-id="authoring.world-builder.review-queue"]',
    );
    await queue.scrollIntoViewIfNeeded();
    await expect(queue).toBeVisible();

    return queue;
}

async function expectBounded(
    locator: Locator,
    viewport: { height: number; width: number },
) {
    const bounds = await locator.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
}

test('the lifted Review queue preserves the pinned-source cards, pagination, and activity destination at desktop and narrow viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page);
    await page.route(
        '**/api/v1/admin/world-builder/review-queue?*',
        async (route) => {
            const requestedPage = new URL(route.request().url()).searchParams.get(
                'page',
            );
            const body =
                requestedPage === '2'
                    ? reviewPage({
                          currentPage: 2,
                          items: [reviewItem(5)],
                          lastPage: 2,
                          total: 5,
                      })
                    : reviewPage({
                          items: [
                              reviewItem(1),
                              reviewItem(2),
                              reviewItem(3),
                              reviewItem(4),
                          ],
                          lastPage: 2,
                          total: 5,
                      });
            await route.fulfill({
                body: JSON.stringify(body),
                contentType: 'application/json',
            });
        },
    );

    for (const viewport of viewports) {
        const queue = await openReviewQueue(page, viewport);
        await expectBounded(queue, viewport);
        await expect(queue.getByText('Authoring', { exact: true })).toBeVisible();
        await expect(
            queue.getByRole('heading', { name: 'Review queue' }),
        ).toBeVisible();
        await expect(
            queue.getByText('5 activities are waiting for review.'),
        ).toBeVisible();
        await expect(
            queue.getByRole('link', { name: 'Review Source review activity 1' }),
        ).toHaveAttribute(
            'href',
            `/settings?panel=admin-world-builder&worldSection=graph&map=${ids.map}&node=${ids.node}&worldView=nodes&reviewActivity=${reviewItem(1).id}`,
        );
        await expect(
            queue
                .getByRole('link', { name: 'Review Source review activity 1' })
                .getByText('Source node · open_practice'),
        ).toBeVisible();
        await expect(
            queue.getByRole('button', { name: 'Next' }),
        ).toBeVisible();

        if (viewport.width === 1440) {
            await queue.getByRole('button', { name: 'Next' }).click();
            await expect(
                queue.getByRole('link', { name: 'Review Source review activity 5' }),
            ).toBeVisible();
        }
    }

    await page.setViewportSize(viewports[0]);
    const queue = await openReviewQueue(page, viewports[0]);
    await queue
        .getByRole('link', { name: 'Review Source review activity 1' })
        .click();
    await expect(page).toHaveURL(
        new RegExp(
            `worldSection=structural&map=${ids.map}&node=${ids.node}&worldView=nodes&reviewActivity=${reviewItem(1).id}`,
        ),
    );
});

test('the lifted Review queue keeps the pinned-source loading and empty states at both viewports', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page);
    let fulfillQueue: (() => Promise<void>) | undefined;
    const queueResponse = new Promise<void>((resolve) => {
        fulfillQueue = async () => {
            resolve();
        };
    });
    await page.route(
        '**/api/v1/admin/world-builder/review-queue?*',
        async (route) => {
            await queueResponse;
            await route.fulfill({
                body: JSON.stringify(reviewPage({ items: [] })),
                contentType: 'application/json',
            });
        },
    );

    const queue = await openReviewQueue(page, viewports[0]);
    await expectBounded(queue, viewports[0]);
    await expect(queue.getByText('Loading review queue…')).toBeVisible();
    await fulfillQueue?.();
    await expect(
        queue.getByText('Everything in this world is up to date.'),
    ).toBeVisible();
    await expect(
        queue.getByText(
            'New or changed activities will appear here after an author saves them.',
        ),
    ).toBeVisible();

    await page.setViewportSize(viewports[1]);
    await expectBounded(queue, viewports[1]);
    await expect(
        queue.getByText('Everything in this world is up to date.'),
    ).toBeVisible();
});

test('the lifted Review queue exposes the source unavailable state for a Rust failure', async ({
    page,
}) => {
    await installWorldBuilderRoutes(page);
    await page.route(
        '**/api/v1/admin/world-builder/review-queue?*',
        async (route) => {
            await route.fulfill({
                body: JSON.stringify({
                    code: 'service_unavailable',
                    title: 'Review queue unavailable',
                }),
                contentType: 'application/problem+json',
                status: 503,
            });
        },
    );

    for (const viewport of viewports) {
        const queue = await openReviewQueue(page, viewport);
        await expectBounded(queue, viewport);
        await expect(
            queue.getByText('The review queue could not be loaded.'),
        ).toBeVisible();
        await expect(queue.getByRole('button', { name: 'Try again' })).toBeVisible();
    }
});
