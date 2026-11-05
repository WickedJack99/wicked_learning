import { expect, test } from '@playwright/test';

test('the root renders the public welcome screen and offers exploration', async ({
    page,
}) => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toBeVisible();
    await expect(page.getByText('Register', { exact: true })).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Light' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dark' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Enter the first world' }).click();
    await expect(page).toHaveURL(/\/world$/);
});

test('the public welcome screen offers its alternative orientation messages', async ({
    page,
}) => {
    await page.goto('/');

    await page
        .getByRole('button', {
            name: 'Show Motivation without pressure loops',
        })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'Motivation without pressure loops',
        }),
    ).toBeVisible();
});

test('the login surface uses the original platform logo asset', async ({
    page,
}) => {
    await page.goto('/login');

    await expect(page.locator('img[src="/images/logo.png"]')).toBeVisible();
    await page.getByRole('button', { name: 'Light' }).click();
    await expect(page.getByRole('button', { name: 'Light' })).toHaveClass(
        /bg-current\/12/,
    );
});

test('all public-information navigation entries resolve to their published pages', async ({
    page,
}) => {
    await page.goto('/about');

    await page.getByRole('link', { name: 'Imprint' }).click();
    await expect(page).toHaveURL(/\/imprint$/);
    await expect(page.getByRole('heading', { name: 'Imprint' })).toBeVisible();
    await expect(
        page.getByText('deployment-specific publisher information'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Data protection' }).click();
    await expect(page).toHaveURL(/\/data-protection$/);
    await expect(
        page.getByRole('heading', { name: 'Data Protection' }),
    ).toBeVisible();
    await expect(
        page.getByText('privacy and data protection information'),
    ).toBeVisible();
});

test('the source-code page provides the original project link without adding a public-page launcher', async ({
    page,
}) => {
    await page.goto('/about');

    await expect(page.getByRole('link', { name: 'Source code' })).toHaveCount(
        0,
    );

    await page.goto('/source');
    await expect(
        page.getByRole('heading', { name: 'Source code' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Original project' }),
    ).toHaveAttribute(
        'href',
        'https://github.com/WickedJack99/wicked_learning',
    );
    await expect(
        page.getByRole('link', { name: 'Original project' }),
    ).toHaveAttribute('rel', 'noreferrer');
});

test('the public explorer presents maps and places without requiring a session', async ({
    page,
}) => {
    await page.goto('/about');

    await page.getByRole('link', { name: 'Home' }).click();
    await page.getByRole('link', { name: 'Enter the first world' }).click();
    await expect(page).toHaveURL(/\/world$/);
    await expect(
        page.getByRole('heading', { name: 'The First Path' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Notice the map, open location' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: 'Choose a direction, open location',
        }),
    ).toBeVisible();
});

test('a public map place keeps the original keyboard focus and selection path', async ({
    page,
}) => {
    await page.goto('/world');

    const place = page.getByRole('button', {
        name: 'Choose a direction, open location',
    });
    await place.focus();
    await expect(place).toHaveAttribute('data-map-asset-highlighted', 'true');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(
        /\/world\?map=first-path&focused=choose-a-direction$/,
    );
});

test('an anonymous visitor can inspect a map place without substitute route pages', async ({
    page,
}) => {
    await page.goto('/world');

    await page
        .getByRole('button', { name: 'Choose a direction, open location' })
        .click();

    await expect(page).toHaveURL(
        /\/world\?map=first-path&focused=choose-a-direction$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Choose a direction' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'View available routes' }),
    ).toHaveCount(0);
    await expect(page.getByText('Choose your next step')).toHaveCount(0);
});

test('the learner shell keeps the source-derived public navigation available on a narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/world');

    await expect(
        page.getByRole('navigation', { name: 'Learner navigation' }),
    ).toBeVisible();
    await expect(
        page.locator('[data-wl-id="learner.navigation.brand"] img'),
    ).toHaveAttribute('src', '/images/logo.png');
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
    await expect(
        page.getByRole('heading', { name: 'The First Path' }),
    ).toBeVisible();
});

test('the lifted World drawer keeps its close control usable on a narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/world');
    await page
        .getByRole('button', { name: 'Choose a direction, open location' })
        .click();

    const closeButton = page.getByRole('button', {
        name: 'Close node panel',
    });
    await expect(closeButton).toBeVisible();
    await expect
        .poll(
            async () =>
                (
                    await page
                        .getByRole('complementary', {
                            name: 'Selected learning place',
                        })
                        .boundingBox()
                )?.x ?? -1,
        )
        .toBe(0);
    const bounds = await closeButton.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(bounds?.y).toBeGreaterThanOrEqual(0);
    expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);

    await closeButton.click();
    await expect(page).toHaveURL(/\/world\?map=first-path$/);
});

test('a transparent public map overlay hides only over its visible image pixels', async ({
    page,
}) => {
    const circularOverlay = `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="34" fill="#ffffff"/></svg>',
    )}`;
    await page.route('**/api/v1/public/world', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                slug: 'transparent-overlay-world',
                title: 'Transparent overlay world',
                description: '',
                theme_config: {},
                maps: [
                    {
                        slug: 'transparent-overlay-map',
                        title: 'Transparent overlay map',
                        description: '',
                        background_config: {},
                        grid_config: {},
                        map_assets_locked: false,
                        assets: [
                            {
                                slug: 'visible-place',
                                title: 'Visible place',
                                description: '',
                                x: 50,
                                y: 50,
                                z: 0,
                                image_url: null,
                                text: 'Visible place',
                                width: 24,
                                opacity: 1,
                                locked: false,
                                visual_config: {},
                                interaction_config: {},
                                sound_config: {},
                                interaction_mode: 'focusable',
                            },
                            {
                                slug: 'transparent-overlay',
                                title: 'Transparent overlay',
                                description: '',
                                x: 50,
                                y: 50,
                                z: 1,
                                image_url: circularOverlay,
                                text: null,
                                width: 24,
                                opacity: 1,
                                locked: false,
                                visual_config: {},
                                interaction_config: {},
                                sound_config: {},
                                interaction_mode: 'hide_on_hover',
                            },
                        ],
                        nodes: [
                            {
                                slug: 'visible-place',
                                title: 'Visible place',
                                description: '',
                                asset_slug: 'visible-place',
                                q: 0,
                                r: 0,
                                state: 'available',
                                visual_config: {},
                                outgoing_portal_links: [],
                            },
                        ],
                    },
                ],
            }),
        });
    });

    await page.goto('/world');
    const overlay = page.locator('[data-map-asset-slug="transparent-overlay"]');
    await expect(overlay.locator('img')).toBeVisible();
    await page.waitForTimeout(100);
    const box = await overlay.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
        return;
    }

    await page.mouse.move(box.x + 3, box.y + 3);
    await expect(overlay).toHaveAttribute(
        'data-map-asset-visibility',
        'visible',
    );

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(overlay).toHaveAttribute(
        'data-map-asset-visibility',
        'hidden',
    );
});

test('the learner World exposes the original-style user menu for an authenticated session', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['platform_administrator'],
            }),
        });
    });

    await page.goto('/world');

    await expect(
        page.getByRole('button', { name: 'Open user menu' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
});

test('the authenticated World restores the original bookmark toggle with a server-owned result', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['learner'],
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'bookmark-csrf-token' }),
        });
    });
    await page.route(
        '**/api/v1/learner/maps/first-path/nodes/choose-a-direction/bookmark',
        async (route) => {
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'bookmark-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    bookmarked: true,
                    bookmarked_nodes: [
                        {
                            map_slug: 'first-path',
                            node_slug: 'choose-a-direction',
                        },
                    ],
                }),
            });
        },
    );

    await page.goto('/world');
    await page
        .getByRole('button', { name: 'Choose a direction, open location' })
        .click();
    await page.getByRole('button', { name: 'Bookmark this tile' }).click();
    await expect(
        page.getByRole('button', { name: 'Remove bookmark' }),
    ).toBeVisible();
});

test('the original bookmark map keeps a saved place, return link, and removal flow', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['learner'],
            }),
        });
    });
    await page.route('**/api/v1/learner/bookmarks', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                background_config: {},
                grid_config: {},
                places: [
                    {
                        asset: {
                            slug: 'saved-place-asset',
                            title: 'Saved place',
                            description: 'A visual bookmark asset.',
                            x: 50,
                            y: 50,
                            z: 1,
                            image_url: null,
                            text: 'Saved place',
                            width: 24,
                            opacity: 1,
                            locked: false,
                            visual_config: {},
                            interaction_config: {},
                            sound_config: {},
                            interaction_mode: 'focusable',
                        },
                        description: 'Return here when you want to continue.',
                        map_slug: 'first-path',
                        map_title: 'The First Path',
                        node_slug: 'saved-place',
                        state: 'available',
                        title: 'Saved place',
                        visual_config: {},
                    },
                ],
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'bookmark-map-csrf-token' }),
        });
    });
    await page.route(
        '**/api/v1/learner/maps/first-path/nodes/saved-place/bookmark',
        async (route) => {
            expect(route.request().method()).toBe('DELETE');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'bookmark-map-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    bookmarked: false,
                    bookmarked_nodes: [],
                }),
            });
        },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/bookmarks');
    await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(390);
    await page
        .getByRole('button', {
            name: 'Saved place, open bookmarked place',
        })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Saved place' }),
    ).toBeVisible();
    await expect(page.getByText('The First Path')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to node' })).toHaveAttribute(
        'href',
        '/world?map=first-path&focused=saved-place',
    );
    const removeBookmarkButton = page.getByRole('button', {
        name: 'Remove bookmark',
    });
    await expect.poll(async () => {
        const bounds = await removeBookmarkButton.boundingBox();

        return (bounds?.x ?? 390) + (bounds?.width ?? 0);
    }).toBeLessThanOrEqual(390);
    const removeBookmarkBounds = await removeBookmarkButton.boundingBox();
    expect(removeBookmarkBounds).not.toBeNull();
    expect(removeBookmarkBounds?.x).toBeGreaterThanOrEqual(0);
    expect(removeBookmarkBounds?.y).toBeGreaterThanOrEqual(0);
    expect(
        (removeBookmarkBounds?.y ?? 0) + (removeBookmarkBounds?.height ?? 0),
    ).toBeLessThanOrEqual(844);
    await removeBookmarkButton.click();
    await expect(
        page.getByRole('heading', { name: 'No bookmarks yet' }),
    ).toBeVisible();
});

test('the original journal overlay reads only its private paginated contract', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['learner'],
            }),
        });
    });
    await page.route('**/api/v1/learner/journal?*', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pages: [
                    {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d99',
                        title: 'Connect the direction',
                        topic: 'Orientation',
                        subtopic: 'Choosing a direction',
                        markdown: '## Private note\n\nThis remains mine.',
                        preferred_mode: 'view',
                        reflection_count: 1,
                        learning_context: {
                            activity_title: 'Connect the direction',
                            map_slug: 'first-path',
                            map_title: 'The First Path',
                            node_slug: 'private-place',
                            node_title: 'A private place',
                        },
                        updated_at: '2026-11-05T09:00:00.000000Z',
                    },
                ],
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 4,
                    total: 1,
                },
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'journal-csrf-token' }),
        });
    });
    await page.route('**/api/v1/learner/journal/pages', async (route) => {
        expect(await route.request().headerValue('X-CSRF-Token')).toBe(
            'journal-csrf-token',
        );
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                page: {
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88',
                    title: 'Untitled page',
                    topic: 'General',
                    subtopic: null,
                    markdown: '',
                    preferred_mode: 'edit',
                    reflection_count: 0,
                    learning_context: null,
                    updated_at: '2026-11-05T09:01:00.000000Z',
                },
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/journal/pages/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88',
        async (route) => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        deleted_page_id:
                            '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88',
                    }),
                });
                return;
            }
            const body = route.request().postDataJSON();
            expect(body.title).toBe('A manual note');
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    page: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88',
                        ...body,
                        reflection_count: 0,
                        learning_context: null,
                        updated_at: '2026-11-05T09:02:00.000000Z',
                    },
                }),
            });
        },
    );

    await page.goto('/world');
    await page.getByRole('button', { name: 'Journal' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByText('Connect the direction', { exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText('This remains mine.')).toBeVisible();
    await page.getByRole('button', { name: 'Add journal page' }).click();
    await page.getByLabel('Title').fill('A manual note');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('All changes saved.')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete journal page' }).click();
    await expect(page.locator('input[value="A manual note"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close journal' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('the signed-in explorer starts and completes an original open-practice route through server-owned playback', async ({
    page,
}) => {
    const activityStarts = [
        ['018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e', 'Begin private orientation'],
        ['018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d60', 'Notice the private map'],
        ['018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d61', 'Find a quiet route'],
        ['018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d62', 'Reflect on the next step'],
    ].map(([startId, label], sortOrder) => ({
        start_id: startId,
        node_slug: 'private-place',
        route_slug: 'private-orientation-route',
        activity_slug: 'private-activity',
        label,
        description:
            'A read-only route presentation from the learner snapshot.',
        image_dark: null,
        image_light: null,
        button_color_dark: null,
        button_border_color_dark: null,
        button_color_light: null,
        button_border_color_light: null,
        sort_order: sortOrder,
        progress:
            sortOrder === 0
                ? {
                      current_activity_slug: 'private-activity',
                      status: 'completed',
                      completion_count: 1,
                      last_completed_at: '2026-11-04T00:00:00.000000Z',
                      last_entered_at: '2026-11-04T00:00:00.000000Z',
                  }
                : null,
    }));

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['platform_administrator'],
            }),
        });
    });
    await page.route('**/api/v1/learner/world', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                world: {
                    slug: 'private-orientation',
                    title: 'Private orientation',
                    description: 'A role-scoped map for the signed-in learner.',
                    theme_config: {},
                    maps: [
                        {
                            slug: 'private-path',
                            title: 'A private path',
                            description: '',
                            background_config: {},
                            grid_config: {},
                            map_assets_locked: false,
                            assets: [
                                {
                                    slug: 'private-place',
                                    title: 'Private place',
                                    description: '',
                                    x: 50,
                                    y: 50,
                                    z: 0,
                                    image_url: null,
                                    text: 'Private place',
                                    width: 24,
                                    opacity: 1,
                                    locked: false,
                                    visual_config: {},
                                    interaction_config: {},
                                    sound_config: {},
                                    interaction_mode: 'focusable',
                                },
                            ],
                            nodes: [
                                {
                                    asset_slug: 'private-place',
                                    slug: 'private-place',
                                    title: 'Private place',
                                    description: '',
                                    q: 0,
                                    r: 0,
                                    state: 'available',
                                    visual_config: {},
                                },
                            ],
                        },
                    ],
                },
                bookmarked_nodes: [
                    {
                        map_slug: 'private-path',
                        node_slug: 'private-place',
                    },
                ],
                activity_progress: [
                    {
                        node_slug: 'private-place',
                        activity_slug: 'private-activity',
                        status: 'completed',
                        completed_at: '2026-11-04T00:00:00.000000Z',
                    },
                ],
                route_progress: [],
                start_routes: activityStarts,
                available_routes: [
                    {
                        node_slug: 'private-place',
                        route_slug: 'private-orientation-route',
                        title: 'Private orientation route',
                        description:
                            'A route visible only in this learner snapshot.',
                        activity_count: 1,
                    },
                ],
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route(
        '**/api/v1/learner/activity-starts/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e/start',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    node_slug: 'private-place',
                    route_slug: 'private-orientation-route',
                    activity_slug: 'private-activity',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66',
                    status: 'in_progress',
                    completion_count: 0,
                    reset_count: 0,
                }),
            });
        },
    );
    let playbackReadCount = 0;
    await page.route(
        '**/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66',
        async (route) => {
            playbackReadCount += 1;
            const secondActivity = playbackReadCount > 1;
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66',
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Begin private orientation',
                    },
                    activity: {
                        slug: secondActivity
                            ? 'next-private-activity'
                            : 'private-activity',
                        title: secondActivity
                            ? 'Choose the next step'
                            : 'Begin private orientation',
                        description: 'A server-authorized activity.',
                        activity_type: 'open_practice',
                        config: {
                            nextStep: 'Pause here, then continue when ready.',
                        },
                        completion: {
                            label: secondActivity
                                ? null
                                : 'Continue to the next step',
                            next_activity_slug: secondActivity
                                ? null
                                : 'next-private-activity',
                        },
                    },
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66/activities/private-activity/complete',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66',
                    status: 'in_progress',
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66/activities/next-private-activity/complete',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66',
                    status: 'completed',
                }),
            });
        },
    );

    await page.goto('/world');

    await expect(
        page.getByRole('heading', { name: 'A private path' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Open user menu' }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Private place, open location' })
        .click();
    await expect(page.getByLabel('Saved place')).toBeVisible();
    await expect(page.getByLabel('Node completed')).toBeVisible();
    await expect(page.getByText('Begin private orientation')).toBeVisible();
    await page
        .getByRole('button', { name: 'Begin private orientation' })
        .click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/private-place\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Begin private orientation' }),
    ).toBeVisible();
    await expect(
        page.locator('aside[aria-label="Learning context"]'),
    ).toContainText('Private place');
    await expect(
        page.getByRole('link', { name: 'A private path' }),
    ).toHaveAttribute('href', '/world?map=private-path&focused=private-place');
    await page.setViewportSize({ width: 390, height: 844 });
    const continueButton = page.getByRole('button', {
        name: 'Continue to the next step',
    });
    const continueBounds = await continueButton.boundingBox();
    expect(continueBounds).not.toBeNull();
    expect(continueBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
        (continueBounds?.x ?? 0) + (continueBounds?.width ?? 0),
    ).toBeLessThanOrEqual(390);
    expect(continueBounds?.y).toBeGreaterThanOrEqual(0);
    expect(
        (continueBounds?.y ?? 0) + (continueBounds?.height ?? 0),
    ).toBeLessThanOrEqual(844);
    await page
        .getByRole('button', { name: 'Continue to the next step' })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Choose the next step' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/world\?focused=private-place$/);
});

test('a removed substitute map-place URL returns to the retained welcome surface', async ({
    page,
}) => {
    await page.goto(
        '/world/orientation-garden/maps/first-path/assets/not-published',
    );

    await expect(page).toHaveURL(/\/$/);
    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toBeVisible();
});

test('the original question surface posts only selected option keys and waits for server feedback', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77';
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    play_run_id: playRunId,
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Question route',
                    },
                    activity: {
                        slug: 'learner-choice',
                        title: 'Keep choice visible',
                        description: 'A server-authorized question.',
                        activity_type: 'question',
                        config: {
                            allowMultiple: false,
                            prompt: 'Which choice keeps exploration learner-directed?',
                            options: [
                                {
                                    key: 'choice',
                                    label: 'A',
                                    body: 'Keep useful choices visible.',
                                },
                                {
                                    key: 'sequence',
                                    label: 'B',
                                    body: 'Hide all other routes.',
                                },
                            ],
                        },
                        completion: { label: null, next_activity_slug: null },
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/learner-choice/answer`,
        async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                confidence: 'settled',
                option_keys: ['choice'],
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    activity_slug: 'learner-choice',
                    selected_option_keys: ['choice'],
                    is_correct: true,
                    feedback: 'This keeps the learner in charge.',
                    explanation: 'Maps support orientation and choice.',
                    confidence: 'settled',
                    calibration: 'aligned',
                    attempt_number: 1,
                    next_transition_label: null,
                }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await expect(
        page.getByText('Which choice keeps exploration learner-directed?'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Settled' }).click();
    await page
        .getByRole('button', { name: /Keep useful choices visible/ })
        .click();
    await expect(page.getByText('Useful clue found')).toBeVisible();
    await expect(
        page.getByText('This keeps the learner in charge.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Try again independently' }).click();
    await expect(
        page.getByText('Which choice keeps exploration learner-directed?'),
    ).toBeVisible();
});

test('the original reflection surface sends private writing only to its active server-owned run', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88';
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    play_run_id: playRunId,
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Reflection route',
                    },
                    activity: {
                        slug: 'private-reflection',
                        title: 'Connect the direction',
                        description: 'A private learner reflection.',
                        activity_type: 'reflection',
                        config: {
                            prompt: 'What feels clearer about your direction?',
                            note: 'This response stays in your private journal.',
                        },
                        completion: { label: null, next_activity_slug: null },
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/private-reflection/reflection`,
        async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                reflection: 'I want to compare the routes before choosing.',
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    activity_slug: 'private-reflection',
                    status: 'completed',
                }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await page
        .getByRole('textbox', { name: '' })
        .fill('I want to compare the routes before choosing.');
    await page.getByRole('button', { name: 'Keep reflection' }).click();
    await expect(page).toHaveURL(/\/world\?focused=private-place$/);
});

test('the public explorer search is bounded and presents matching places', async ({
    page,
}) => {
    await page.goto('/world');

    await page.getByLabel('Search maps and places').fill('direction');
    await expect(
        page.getByRole('button', { name: 'Choose a direction The First Path' }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Choose a direction The First Path' })
        .click();

    await expect(page).toHaveURL(
        /\/world\?map=first-path&focused=choose-a-direction$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Choose a direction' }),
    ).toBeVisible();
    await expect(page.getByText('The First Path')).toBeVisible();
});

test('a legacy standalone search URL returns to the retained welcome surface', async ({
    page,
}) => {
    await page.goto('/learning/search?query=direction');

    await expect(page).toHaveURL(/\/$/);
    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toBeVisible();
});

test('a CI-only local administrator can use the React sign-in and sign-out flow', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable CI identity');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/world$/);
    await page.getByRole('button', { name: 'Open user menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
});

test('an unavailable public-page API is presented without a stale page', async ({
    page,
}) => {
    await page.route('**/api/v1/public/pages/about', async (route) => {
        await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
        });
    });

    await page.goto('/about');

    await expect(page.getByRole('alert')).toHaveText(
        'Public information is temporarily unavailable.',
    );
    await expect(
        page.getByRole('heading', { name: 'About Wicked Learning' }),
    ).not.toBeVisible();
});

test('unknown browser routes return to the retained welcome surface', async ({
    page,
}) => {
    await page.goto('/not-a-public-page');

    await expect(page).toHaveURL(/\/$/);
    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toBeVisible();
});
