import { expect, test } from '@playwright/test';

test('the root renders the public welcome screen and offers exploration', async ({
    page,
}) => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toBeVisible();
    await expect(page.getByText('Register', { exact: true })).toHaveCount(0);
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

test('the source-code page provides the original project link safely', async ({
    page,
}) => {
    await page.goto('/about');

    await page.getByRole('link', { name: 'Source code' }).click();
    await expect(page).toHaveURL(/\/source$/);
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

test('the learner shell keeps public navigation available on a narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/world');

    await expect(
        page.getByRole('navigation', { name: 'Learner navigation' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Log in' }),
    ).toBeVisible();
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
    await expect(overlay).toHaveAttribute('data-map-asset-visibility', 'visible');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(overlay).toHaveAttribute('data-map-asset-visibility', 'hidden');
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

    await expect(page.getByRole('button', { name: 'Open user menu' })).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Log in' }),
    ).not.toBeVisible();
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
        description: 'A read-only route presentation from the learner snapshot.',
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
                bookmarked_node_slugs: ['private-place'],
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
                        description: 'A route visible only in this learner snapshot.',
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
                    activity: {
                        slug: secondActivity ? 'next-private-activity' : 'private-activity',
                        title: secondActivity ? 'Choose the next step' : 'Begin private orientation',
                        description: 'A server-authorized activity.',
                        activity_type: 'open_practice',
                        config: {
                            nextStep: 'Pause here, then continue when ready.',
                        },
                        completion: {
                            label: secondActivity ? null : 'Continue to the next step',
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
    await expect(
        page.getByText('Begin private orientation'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Begin private orientation' }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/private-place\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Begin private orientation' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const continueButton = page.getByRole('button', {
        name: 'Continue to the next step',
    });
    const continueBounds = await continueButton.boundingBox();
    expect(continueBounds).not.toBeNull();
    expect(continueBounds?.x).toBeGreaterThanOrEqual(0);
    expect((continueBounds?.x ?? 0) + (continueBounds?.width ?? 0)).toBeLessThanOrEqual(390);
    expect(continueBounds?.y).toBeGreaterThanOrEqual(0);
    expect((continueBounds?.y ?? 0) + (continueBounds?.height ?? 0)).toBeLessThanOrEqual(844);
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
    await expect(page.getByRole('heading', { name: 'Learning Worlds' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Learning Worlds' })).toBeVisible();
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
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Learning Worlds' })).toBeVisible();
});
