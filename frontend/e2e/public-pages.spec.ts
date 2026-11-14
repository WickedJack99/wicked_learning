import { expect, test } from './authenticated';

function journalTheme() {
    const mode = {
        accent: '#14b8a6',
        accent_opacity: 100,
        accent_text: '#042f2e',
        accent_text_opacity: 100,
        background_assets: [],
        background_image: '',
        background_overlay: '#0f172a',
        background_overlay_opacity: 82,
        background_position_x: 50,
        background_position_y: 50,
        background_zoom: 100,
        body_text: '#cbd5e1',
        body_text_opacity: 100,
        button_background: '#134e4a',
        button_background_opacity: 100,
        button_border: '#2dd4bf',
        button_border_opacity: 100,
        button_text: '#f0fdfa',
        button_text_opacity: 100,
        content_background: '#0f172a',
        content_background_opacity: 100,
        header_background: '#042f2e',
        header_background_opacity: 100,
        heading_text: '#f8fafc',
        heading_text_opacity: 100,
        input_background: '#1e293b',
        input_background_opacity: 100,
        muted_text: '#94a3b8',
        muted_text_opacity: 100,
        panel_background: '#111827',
        panel_background_opacity: 100,
        panel_border: '#334155',
        panel_border_opacity: 100,
        selected_background: '#134e4a',
        selected_background_opacity: 100,
        selected_border: '#2dd4bf',
        selected_border_opacity: 100,
        selected_text: '#f0fdfa',
        selected_text_opacity: 100,
        sidebar_background: '#0f172a',
        sidebar_background_opacity: 100,
    };

    return { dark: mode, light: mode };
}

test('the root renders the public welcome screen and offers exploration', async ({
    page,
}) => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toBeVisible();
    await expect(page.getByText('Register', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Light' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dark' })).toBeVisible();
    await page.getByRole('link', { name: 'Enter the first world' }).click();
    await expect(page).toHaveURL(/\/world$/);
});

test('the lifted welcome uses the server-owned presentation model', async ({
    page,
}) => {
    await page.route('**/api/v1/public/presentation', async (route) => {
        const response = await route.fetch();
        const presentation = await response.json();
        presentation.welcome.pages[0].title = 'Server-owned welcome title';
        presentation.welcome.pages[0].eyebrow = 'Rust presentation contract';

        await route.fulfill({ response, json: presentation });
    });

    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Server-owned welcome title' }),
    ).toBeVisible();
    await expect(page.getByText('Rust presentation contract')).toBeVisible();
});

test('a missing public presentation does not fall back to copied page settings', async ({
    page,
}) => {
    await page.route('**/api/v1/public/presentation', async (route) => {
        await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
                code: 'dependency_unavailable',
                title: 'A required service is unavailable.',
            }),
        });
    });

    await page.goto('/');

    await expect(page.getByRole('alert')).toHaveText(
        'Public presentation is temporarily unavailable.',
    );
    await expect(
        page.getByRole('heading', { name: 'Learning Worlds' }),
    ).toHaveCount(0);
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

test('the anonymous source appearance choice persists across public routes and reloads', async ({
    page,
}) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Light' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(page.locator('[data-wl-id="public.welcome"]')).toHaveAttribute(
        'style',
        /--auth-background-color: #ecfeff/,
    );

    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(
        page.locator('[data-wl-id="public.information"]'),
    ).toHaveAttribute('style', /--auth-background-color: #ecfeff/);

    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Light' })).toHaveClass(
        /bg-current\/12/,
    );
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Light' })).toHaveClass(
        /bg-current\/12/,
    );
    await expect(page).toHaveURL(/\/login$/);
    await expect(
        page.evaluate(() =>
            window.localStorage.getItem('theme-preference-unauthenticated'),
        ),
    ).resolves.toBe('light');
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

test('the original login and invitation registration surfaces link to each other', async ({
    page,
}) => {
    await page.goto('/login');

    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
        page.getByRole('heading', { name: 'Create an account' }),
    ).toBeVisible();
    await expect(page.getByLabel('Registration token')).toBeVisible();

    await page.getByRole('link', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/login$/);
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
        page.locator('[data-wl-id="learner.navigation.header"]'),
    ).toHaveAttribute('style', /--learner-header-background:/);
    await expect(
        page.locator('[data-wl-id="learner.navigation.brand"] img'),
    ).toHaveAttribute('src', '/images/logo.png');
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
    await expect(
        page.getByRole('heading', { name: 'The First Path' }),
    ).toBeVisible();
});

test('the narrow world search uses the source mobile search panel', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/world');

    await page.getByRole('button', { name: 'Open map search' }).click();
    await expect(
        page.getByRole('region', { name: 'Map search' }),
    ).toBeVisible();
    await expect(
        page.getByRole('searchbox', { name: 'Search maps and places' }),
    ).toBeFocused();

    await page.getByRole('button', { name: 'Close map search' }).last().click();
    await expect(page.getByRole('region', { name: 'Map search' })).toHaveCount(
        0,
    );
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
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'navigation.primary.current_map': 'My map',
                },
            }),
        });
    });
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'dark',
                avatar_url: null,
                capabilities: [],
                email: 'learner@example.test',
                name: 'World learner',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['platform_administrator'],
                settings_access: {},
                username: 'world_learner',
            }),
        });
    });

    await page.goto('/world');

    await expect(
        page.getByRole('button', { name: 'Open user menu' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Open inventory' }),
    ).toBeVisible();
    const notificationsLink = page.getByRole('link', {
        name: 'Notifications',
    });
    await expect(notificationsLink).toHaveAttribute(
        'href',
        '/settings?panel=personal&personal=notifications',
    );
    await expect(
        page.getByRole('navigation', { name: 'Learner navigation' })
            .getByRole('link', { name: 'My map' }),
    ).toHaveAttribute('aria-current', 'page');
    await page.setViewportSize({ width: 390, height: 844 });
    const notificationsBounds = await notificationsLink.boundingBox();
    expect(notificationsBounds).not.toBeNull();
    expect(notificationsBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
        (notificationsBounds?.x ?? 0) +
            (notificationsBounds?.width ?? Infinity),
    ).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('button', { name: 'Open tools' }).click();
    await expect(
        page.getByRole('dialog', { name: 'Select a tool' }),
    ).toContainText('No tools acquired yet.');
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open user menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Log out' })).toBeVisible();
    await expect(page.getByRole('menu')).toContainText('world_learner');
    await expect(page.getByRole('menu')).toContainText('learner@example.test');
});

test('the source Settings shell retains the authenticated account control', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'dark',
                avatar_url: null,
                capabilities: [],
                email: 'administrator@example.test',
                name: 'Administrator',
                roles: ['platform_administrator'],
                settings_access: {
                    world_activities: true,
                    world_maps: true,
                    world_nodes: true,
                },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                username: 'world_admin',
            }),
        });
    });
    await page.route('**/api/v1/admin/settings/notifications', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pending_feedback_requests: 0,
                pending_organization_icon_reports: 0,
                reported_organizations: [],
            }),
        });
    });

    await page.goto(
        '/settings?panel=admin-learning-support&support=support-signals',
    );

    const accountControl = page.getByLabel('Signed-in account');
    await expect(accountControl).toBeVisible();
    await expect(accountControl).toContainText('world_admin');
    await expect(accountControl.locator('[aria-hidden="true"]')).toContainText('W');
    await expect(accountControl.locator('[aria-hidden="true"]')).toHaveClass(/rounded-lg/);
    await expect
        .poll(() =>
            accountControl.evaluate(
                (element) => getComputedStyle(element).backgroundColor,
            ),
        )
        .toBe('rgba(45, 212, 191, 0.1)');

    await page.setViewportSize({ width: 390, height: 844 });
    const accountBounds = await accountControl.boundingBox();
    expect(accountBounds).not.toBeNull();
    expect(accountBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
        (accountBounds?.x ?? 0) + (accountBounds?.width ?? Infinity),
    ).toBeLessThanOrEqual(390);
});

test('the lifted tool belt and its panel remain inside desktop and narrow World viewports', async ({
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

    await page.goto('/world');
    await page.getByRole('button', { name: 'Open tools' }).click();
    const desktopPanel = page.getByRole('dialog', { name: 'Select a tool' });
    await expect(desktopPanel).toBeVisible();
    const desktopBox = await desktopPanel.boundingBox();
    expect(desktopBox).not.toBeNull();
    if (!desktopBox) return;
    expect(desktopBox.x).toBeGreaterThanOrEqual(0);
    expect(desktopBox.y).toBeGreaterThanOrEqual(0);
    expect(desktopBox.x + desktopBox.width).toBeLessThanOrEqual(1280);
    expect(desktopBox.y + desktopBox.height).toBeLessThanOrEqual(720);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Open tools' }).click();
    const narrowBox = await desktopPanel.boundingBox();
    expect(narrowBox).not.toBeNull();
    if (!narrowBox) return;
    expect(narrowBox.x).toBeGreaterThanOrEqual(0);
    expect(narrowBox.y).toBeGreaterThanOrEqual(0);
    expect(narrowBox.x + narrowBox.width).toBeLessThanOrEqual(390);
    expect(narrowBox.y + narrowBox.height).toBeLessThanOrEqual(844);
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
                appearance: 'dark',
                avatar_url: null,
                capabilities: [],
                email: 'learner@example.test',
                name: 'Bookmark learner',
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                roles: ['learner'],
                settings_access: {},
                username: 'saved_places',
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
                        topic: {
                            href: '/topics/map-orientation',
                            slug: 'map-orientation',
                            title: 'Map orientation',
                        },
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
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'bookmarks.panel.go_to': 'Continue at place',
                    'bookmarks.panel.open_topic': 'Explore local topic',
                    'bookmarks.panel.remove': 'Forget this place',
                },
            }),
        });
    });

    await page.goto('/bookmarks');
    const learnerNavigation = page.getByRole('navigation', {
        name: 'Learner navigation',
    });
    await expect(learnerNavigation).toBeVisible();
    await expect(
        learnerNavigation.getByRole('link', { name: 'Bookmarks' }),
    ).toHaveAttribute('aria-current', 'page');
    const userMenu = page.getByRole('button', { name: 'Open user menu' });
    await userMenu.click();
    await expect(page.getByRole('menu')).toContainText('saved_places');
    await userMenu.click();
    await page
        .getByRole('button', {
            name: 'Saved place, open bookmarked place',
        })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Saved place' }),
    ).toBeVisible();
    await expect(
        page.getByText('The First Path', { exact: true }),
    ).toBeVisible();
    const topicLink = page.getByRole('link', {
        name: 'Explore local topic: Map orientation',
    });
    await expect(topicLink).toHaveAttribute('href', '/topics/map-orientation');
    const desktopViewport = page.viewportSize();
    expect(desktopViewport).not.toBeNull();
    await expect
        .poll(async () => (await topicLink.boundingBox())?.x ?? -1)
        .toBeGreaterThanOrEqual(0);
    await expect
        .poll(async () => {
            const bounds = await topicLink.boundingBox();

            return (bounds?.x ?? 0) + (bounds?.width ?? Infinity);
        })
        .toBeLessThanOrEqual(desktopViewport!.width);
    await expect(
        page.getByRole('link', { name: 'Continue at place' }),
    ).toHaveAttribute('href', '/world?map=first-path&focused=saved-place');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
    const learnerNavigationItems = learnerNavigation.locator(
        '[data-wl-id^="learner.navigation.item."]',
    );
    await expect(learnerNavigationItems).toHaveCount(6);
    for (
        let index = 0;
        index < (await learnerNavigationItems.count());
        index += 1
    ) {
        const bounds = await learnerNavigationItems.nth(index).boundingBox();

        expect(bounds).not.toBeNull();
        expect(bounds?.x).toBeGreaterThanOrEqual(0);
        expect(
            (bounds?.x ?? 0) + (bounds?.width ?? Infinity),
        ).toBeLessThanOrEqual(390);
    }
    await expect
        .poll(async () => (await topicLink.boundingBox())?.x ?? -1)
        .toBeGreaterThanOrEqual(0);
    await expect
        .poll(async () => {
            const bounds = await topicLink.boundingBox();

            return (bounds?.x ?? 0) + (bounds?.width ?? Infinity);
        })
        .toBeLessThanOrEqual(390);
    const removeBookmarkButton = page.getByRole('button', {
        name: 'Forget this place',
    });
    await expect
        .poll(async () => {
            const bounds = await removeBookmarkButton.boundingBox();

            return (bounds?.x ?? 390) + (bounds?.width ?? 0);
        })
        .toBeLessThanOrEqual(390);
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

    await page.unroute('**/api/v1/learner/bookmarks');
    await page.route('**/api/v1/learner/bookmarks', async (route) => {
        await route.fulfill({ status: 503 });
    });
    await page.reload();
    await expect(
        page.getByRole('navigation', { name: 'Learner navigation' }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText(
        'Bookmarked places are temporarily unavailable.',
    );
});

test('the source feedback route uses translated fixed copy and its typed submission', async ({
    page,
}) => {
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'feedback.heading': 'Tell us what you noticed',
                    'feedback.message.label': 'Message for the platform',
                    'feedback.submit': 'Send it',
                    'feedback.success': 'Your note was shared.',
                },
            }),
        });
    });
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'dark',
                avatar_url: null,
                capabilities: [],
                email: 'learner@example.test',
                name: 'Feedback learner',
                roles: ['learner'],
                settings_access: {},
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                username: null,
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'feedback-csrf-token' }),
        });
    });
    await page.route('**/api/v1/platform-feedback', async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(await route.request().headerValue('X-CSRF-Token')).toBe(
            'feedback-csrf-token',
        );
        expect(route.request().postDataJSON()).toEqual({
            category: 'idea',
            message: 'The new route selection was easier to understand.',
        });
        await route.fulfill({ status: 204 });
    });

    await page.goto('/feedback');
    await expect(
        page.getByRole('heading', { name: 'Tell us what you noticed' }),
    ).toBeVisible();
    await page.getByLabel('What kind of feedback is this?').selectOption('idea');
    const message = page.getByLabel('Message for the platform');
    await message.fill('The new route selection was easier to understand.');
    await page.getByRole('button', { name: 'Send it' }).click();
    await expect(page.getByRole('status')).toHaveText('Your note was shared.');

    await page.setViewportSize({ width: 390, height: 844 });
    const messageBounds = await message.boundingBox();
    expect(messageBounds).not.toBeNull();
    expect(messageBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
        (messageBounds?.x ?? 0) + (messageBounds?.width ?? Infinity),
    ).toBeLessThanOrEqual(390);
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
                allow_expert_access_requests: false,
                check_ins: [
                    {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d69',
                        activity_slug: 'consider-a-direction',
                        activity_title: 'Consider a direction',
                        feeling: 'forming',
                        note: 'I want to return to this thought after walking.',
                        next_direction: 'related',
                        recorded_at: '2026-11-05T08:00:00.000000Z',
                        map_slug: 'first-path',
                        map_title: 'The First Path',
                        node_slug: 'private-place',
                        node_title: 'A private place',
                    },
                ],
                feedback_domains: [],
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
                revisit_invitations: [
                    {
                        check_in_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d70',
                        activity_slug: 'first-revisit',
                        activity_title: 'Return to the first question',
                        available_after_days: 3,
                        available_at: '2026-11-03T09:00:00.000000Z',
                        available_since: '2026-10-31T09:00:00.000000Z',
                        revisit_reason: 'pause',
                        map_slug: 'first-path',
                        map_title: 'The First Path',
                        node_slug: 'private-place',
                        node_title: 'A private place',
                    },
                    {
                        check_in_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d71',
                        activity_slug: 'second-revisit',
                        activity_title: 'Return to a second question',
                        available_after_days: 3,
                        available_at: '2026-11-04T09:00:00.000000Z',
                        available_since: '2026-11-01T09:00:00.000000Z',
                        revisit_reason: 'later',
                        map_slug: 'first-path',
                        map_title: 'The First Path',
                        node_slug: 'private-place',
                        node_title: 'A private place',
                    },
                ],
                theme: journalTheme(),
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'journal-csrf-token' }),
        });
    });
    await page.route(
        '**/api/v1/learner/activities/consider-a-direction/replay',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'journal-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'consider-a-direction',
                    node_slug: 'private-place',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d72',
                    status: 'in_progress',
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/revisit-invitations/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d70',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(route.request().postDataJSON()).toEqual({
                action: 'snooze',
            });
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'journal-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    check_in_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d70',
                    revisit_status: 'snoozed',
                    available_at: '2026-11-12T09:00:00.000000Z',
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/revisit-invitations/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d71/open',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'journal-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'second-revisit',
                    node_slug: 'private-place',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77',
                    status: 'in_progress',
                }),
            });
        },
    );
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
                        deleted_page_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88',
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
        page.getByLabel('Recent learning check-ins'),
    ).toBeVisible();
    await expect(page.getByText('Still forming')).toBeVisible();
    await expect(
        page.getByText('I want to return to this thought after walking.'),
    ).toBeVisible();
    await expect(
        page.getByText('Next direction: Look for something related'),
    ).toBeVisible();
    await page.getByRole('button', { name: /Still forming/ }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/private-place\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d72$/,
    );
    await page.goto('/world');
    await page.getByRole('button', { name: 'Journal' }).click();
    await expect(
        page.locator('section[aria-label="Revisit invitations"]'),
    ).toBeVisible();
    await expect(
        page.getByText('Return to the first question', { exact: true }),
    ).toBeVisible();
    const invitationRegion = page.locator(
        'section[aria-label="Revisit invitations"]',
    );
    const desktopInvitationBounds = await invitationRegion.boundingBox();
    expect(desktopInvitationBounds).not.toBeNull();
    expect(desktopInvitationBounds?.width).toBeGreaterThan(0);
    await page.setViewportSize({ width: 390, height: 844 });
    const laterButton = page.getByRole('button', { name: 'Later' });
    await expect(laterButton).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await laterButton.boundingBox();

            return (bounds?.x ?? 390) + (bounds?.width ?? 0);
        })
        .toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'Later' }).click();
    await expect(
        page.getByText('Return to the first question', { exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Open activity' }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/private-place\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77$/,
    );
    await page.goto('/world');
    await page.getByRole('button', { name: 'Journal' }).click();
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

test('the authenticated Topics reader keeps the source directory, topic Trail and Routes flow', async ({
    page,
}) => {
    await mockTopicReader(page);

    await page.goto('/topics');

    await expect(page.getByRole('heading', { name: 'Topics' })).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Topics' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Topic area')).toHaveValue('orientation');
    await page.getByRole('link', { name: /Map orientation/ }).click();

    await expect(
        page.getByRole('heading', { name: 'Map orientation' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Your trail in this topic' }),
    ).toBeVisible();
    await expect(page.getByText('Recent reflections')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open journal' })).toHaveAttribute(
        'href',
        '/journal',
    );
    await page.getByRole('link', { name: 'Open focused map' }).click();
    await expect(page).toHaveURL(
        /\/competence\?topic=map-orientation&from=map-orientation$/,
    );

    await page.goto('/topics/map-orientation');
    await page
        .locator('section[aria-labelledby="topic-learning-pulse-heading"]')
        .getByRole('button', { name: /Consider a direction/ })
        .click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/choose-a-direction\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d74$/,
    );

    await page.goto('/topics/map-orientation');
    await expect(page.getByText('Recent moments')).toBeVisible();
    await page.getByRole('button', { name: /Notice the map/ }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/notice-the-map\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d75$/,
    );

    await page.goto('/topics/map-orientation');
    await page
        .getByRole('button', { name: /Return to Consider a direction/ })
        .click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/choose-a-direction\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d74$/,
    );

    await page.goto('/topics/map-orientation');

    await page.getByRole('tab', { name: 'Routes' }).click();
    await expect(page).toHaveURL(/\/topics\/map-orientation\?section=routes$/);
    await expect(
        page.getByRole('heading', { name: 'Map orientation' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Start with a route' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Enter route' }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/choose-a-direction\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e$/,
    );
});

test('the authenticated Paths reader keeps the standalone source filters and route-start flow', async ({
    page,
}) => {
    await mockTopicReader(page);

    await page.goto('/paths');

    await expect(page.getByRole('heading', { name: 'Paths' })).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Paths' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
        page.getByRole('heading', { name: 'Available routes' }),
    ).toBeVisible();
    await page.getByLabel('Learning purpose').selectOption('retrieve');
    await expect(page).toHaveURL(/\/paths\?purpose=retrieve$/);
    await page.getByRole('button', { name: 'Enter route' }).click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/choose-a-direction\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e$/,
    );
});

test('the authenticated competence reader keeps the source star map and private learning pulse', async ({
    page,
}) => {
    await mockCompetenceReader(page);

    await page.goto('/competence');

    await expect(
        page.getByRole('heading', { name: 'Star Map' }),
    ).toBeVisible();
    await expect(
        page.getByRole('navigation', { name: 'Learner navigation' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Competence map' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
        page.getByRole('img', { name: 'Competence star map' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Map orientation:/ }).click();
    await expect(
        page.getByRole('heading', { name: 'Map orientation' }),
    ).toBeVisible();
    await expect(
        page.getByText('I can name a next step.').first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'How to read this map' }).click();
    await expect(page.getByText(/last 30 days/)).toBeVisible();
    await page.getByRole('button', { name: 'Revisit this activity' }).first().click();
    await expect(page).toHaveURL(
        /\/learning\/nodes\/choose-a-direction\/play\?run=018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d73$/,
    );
});

test('the source competence map remains usable on a narrow screen', async ({
    page,
}) => {
    await mockCompetenceReader(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/competence');

    const map = page.getByRole('img', { name: 'Competence star map' });
    await expect(map).toBeVisible();
    await expect
        .poll(async () => {
            const box = await map.boundingBox();
            return box ? box.x >= 0 && box.x + box.width <= 390 : false;
        })
        .toBe(true);
    await page.getByRole('button', { name: /Map orientation:/ }).click();
    await expect(
        page.getByRole('heading', { name: 'Map orientation' }),
    ).toBeVisible();
});

test('the competence map preserves its source topic and origin query context', async ({
    page,
}) => {
    await mockCompetenceReader(page);

    await page.goto('/competence?topic=unseen-area&from=map-orientation');

    await expect(
        page.getByText('Viewing the learning trail around'),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Map orientation', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Unseen Area' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Open topic' }).click();
    await expect(page).toHaveURL(/\/topics\/unseen-area$/);
});

async function mockCompetenceReader(page: import('@playwright/test').Page) {
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
            body: JSON.stringify({ token: 'competence-csrf-token' }),
        });
    });
    await page.route(
        '**/api/v1/learner/activities/consider-a-direction/replay',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'competence-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'consider-a-direction',
                    node_slug: 'choose-a-direction',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d73',
                    status: 'in_progress',
                }),
            });
        },
    );
    await page.route('**/api/v1/learner/competence', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                check_ins: [
                    {
                        activity_slug: 'consider-a-direction',
                        activity_title: 'Consider a direction',
                        feeling: 'clearer',
                        map_slug: 'first-path',
                        next_direction: 'related',
                        node_slug: 'choose-a-direction',
                        node_title: 'Choose a direction',
                        note: 'I can name a next step.',
                        recorded_at: '2026-11-05T12:00:00Z',
                        topics: [
                            { name: 'Map orientation', slug: 'map-orientation' },
                        ],
                    },
                ],
                month_key: '2026-11',
                recent_window_days: 30,
                review_attempts: [],
                topics: [
                    {
                        name: 'Map orientation',
                        related_topic: {
                            slug: 'map-orientation',
                            title: 'Map orientation',
                        },
                        revisit: {
                            activity_slug: 'consider-a-direction',
                            activity_title: 'Consider a direction',
                            node_slug: 'choose-a-direction',
                            node_title: 'Choose a direction',
                        },
                        slug: 'map-orientation',
                        visual: {
                            aura_ratio: 0.5,
                            brightness_ratio: 0.6,
                            description: 'A growing sense of orientation.',
                            evidence_ledger: [
                                {
                                    activity_slug: 'consider-a-direction',
                                    activity_title: 'Consider a direction',
                                    assistance_level: null,
                                    attempt_number: 1,
                                    concepts: ['orientation'],
                                    confidence: 'leaning',
                                    confidence_after_feedback: null,
                                    evidence_claim: 'reflection',
                                    evidence_criterion: null,
                                    evidence_rubric: [],
                                    evidence_type: 'reflect',
                                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                                    independent_check: false,
                                    learning_purpose: null,
                                    node_slug: 'choose-a-direction',
                                    node_title: 'Choose a direction',
                                    objective: null,
                                    observed_cues: [],
                                    outcome: 'clearer',
                                    recorded_at: '2026-11-05T12:00:00Z',
                                    sources: [],
                                },
                            ],
                            evidence_types: ['reflect'],
                            learning_periods: ['Nov 2026'],
                            recent_description: 'You returned to this area recently.',
                            size_ratio: 0.4,
                            size_tier: 'star',
                        },
                    },
                ],
                transitions: [],
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/topics/map-orientation/trail',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    competence: {
                        name: 'Map orientation',
                        revisit: {
                            activity_slug: 'consider-a-direction',
                            activity_title: 'Consider a direction',
                            node_slug: 'choose-a-direction',
                            node_title: 'Choose a direction',
                        },
                        slug: 'map-orientation',
                        visual: {
                            aura_ratio: 0.4,
                            brightness_ratio: 0.4,
                            description: 'A growing light.',
                            evidence_ledger: [
                                {
                                    activity_slug: 'notice-the-map',
                                    activity_title: 'Notice the map',
                                    assistance_level: null,
                                    attempt_number: 1,
                                    concepts: [],
                                    confidence: null,
                                    confidence_after_feedback: null,
                                    evidence_claim: 'participation',
                                    evidence_criterion: null,
                                    evidence_rubric: [],
                                    evidence_type: 'participate',
                                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d76',
                                    independent_check: false,
                                    learning_purpose: null,
                                    node_slug: 'notice-the-map',
                                    node_title: 'Notice the map',
                                    objective: null,
                                    observed_cues: [],
                                    outcome: 'completed',
                                    recorded_at: '2026-11-04T12:00:00Z',
                                    sources: [],
                                },
                            ],
                            evidence_types: ['participate'],
                            learning_periods: ['Nov 2026'],
                            recent_description:
                                'A recent learning moment is gently lighting this area.',
                            size_ratio: 0.4,
                            size_tier: 'star',
                        },
                    },
                    learning_areas: [],
                    learning_pulse: [],
                    reflection_narrative: null,
                    subtopic_competence: [],
                    topic: {
                        area_slug: 'orientation',
                        area_title: 'Orientation',
                        content: null,
                        description: 'Notice the map.',
                        parent: null,
                        slug: 'map-orientation',
                        title: 'Map orientation',
                    },
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/topics/unseen-area/trail',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    competence: null,
                    learning_areas: [],
                    learning_pulse: [],
                    reflection_narrative: null,
                    subtopic_competence: [],
                    topic: {
                        area_slug: 'orientation',
                        area_title: 'Orientation',
                        content: null,
                        description: 'A route that has not been explored.',
                        parent: null,
                        slug: 'unseen-area',
                        title: 'Unseen Area',
                    },
                }),
            });
        },
    );
}

test('the source Topic tab strip remains inside a narrow viewport and loads only its selected section', async ({
    page,
}) => {
    await mockTopicReader(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/topics/map-orientation');

    const tabStrip = page.locator('[data-wl-id="learner.topic.sections"]');
    await expect(tabStrip).toBeVisible();
    await expect
        .poll(async () => {
            const box = await tabStrip.boundingBox();
            return box ? box.x >= 0 && box.x + box.width <= 390 : false;
        })
        .toBe(true);
    await page.getByRole('tab', { name: 'Trail' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Routes' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await page.getByRole('tab', { name: 'Routes' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Maps' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page).toHaveURL(/section=overview/);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(
        page.getByRole('heading', { name: 'Subtopics' }),
    ).toBeVisible();
});

async function mockTopicReader(page: import('@playwright/test').Page) {
    const topic = {
        area_slug: 'orientation',
        area_title: 'Orientation',
        content: 'A guide to **map orientation**.',
        description: 'Notice where you are before choosing a direction.',
        parent: null,
        slug: 'map-orientation',
        title: 'Map orientation',
    };
    const pagination = { current_page: 1, last_page: 1, per_page: 6, total: 1 };
    const topicCompetence = {
        name: 'Map orientation',
        revisit: {
            activity_slug: 'consider-a-direction',
            activity_title: 'Consider a direction',
            node_slug: 'choose-a-direction',
            node_title: 'Choose a direction',
        },
        slug: 'map-orientation',
        visual: {
            aura_ratio: 0.4,
            brightness_ratio: 0.4,
            description: 'A growing light.',
            evidence_ledger: [
                {
                    activity_slug: 'notice-the-map',
                    activity_title: 'Notice the map',
                    assistance_level: null,
                    attempt_number: 1,
                    concepts: [],
                    confidence: null,
                    confidence_after_feedback: null,
                    evidence_claim: 'participation',
                    evidence_criterion: null,
                    evidence_rubric: [],
                    evidence_type: 'participate',
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d76',
                    independent_check: false,
                    learning_purpose: null,
                    node_slug: 'notice-the-map',
                    node_title: 'Notice the map',
                    objective: null,
                    observed_cues: [],
                    outcome: 'completed',
                    recorded_at: '2026-11-04T12:00:00Z',
                    sources: [],
                },
            ],
            evidence_types: ['participate'],
            learning_periods: ['Nov 2026'],
            recent_description:
                'A recent learning moment is gently lighting this area.',
            size_ratio: 0.4,
            size_tier: 'star',
        },
    };

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
    await page.route(
        '**/api/v1/learner/activities/consider-a-direction/replay',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'consider-a-direction',
                    node_slug: 'choose-a-direction',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d74',
                    status: 'in_progress',
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/activities/notice-the-map/replay',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'notice-the-map',
                    node_slug: 'notice-the-map',
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d75',
                    status: 'in_progress',
                }),
            });
        },
    );
    await page.route('**/api/v1/learner/topics', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                areas: [{ slug: 'orientation', title: 'Orientation' }],
                pagination,
                search: '',
                selected_area: {
                    description: 'Begin with a bearing.',
                    slug: 'orientation',
                    title: 'Orientation',
                    topics: [
                        {
                            description: 'Notice the map.',
                            href: '/topics/map-orientation',
                            map_count: 1,
                            slug: 'map-orientation',
                            title: 'Map orientation',
                        },
                    ],
                },
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/topics/map-orientation/trail',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    competence: topicCompetence,
                    learning_areas: [
                        {
                            learning_intents: ['retrieve'],
                            name: 'Orientation',
                            slug: 'orientation',
                        },
                    ],
                    learning_pulse: [
                        {
                            activity_slug: 'consider-a-direction',
                            activity_title: 'Consider a direction',
                            feeling: 'clearer',
                            node_title: 'Choose a direction',
                            note: 'I can name a next step.',
                            recorded_at: '2026-11-05T12:00:00Z',
                        },
                    ],
                    reflection_narrative: {
                        earlier: {
                            activity_title: 'Notice the map',
                            created_at: '2026-10-02T12:00:00Z',
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d76',
                            question: 'What did you notice first?',
                            reflection: 'The paths made more sense.',
                        },
                        entries: [
                            {
                                activity_title: 'Notice the map',
                                created_at: '2026-10-02T12:00:00Z',
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d76',
                                question: 'What did you notice first?',
                                reflection: 'The paths made more sense.',
                            },
                            {
                                activity_title: 'Consider a direction',
                                created_at: '2026-11-05T12:00:00Z',
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77',
                                question: 'What will you try next?',
                                reflection: 'I will start with one route.',
                            },
                        ],
                        later: {
                            activity_title: 'Consider a direction',
                            created_at: '2026-11-05T12:00:00Z',
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77',
                            question: 'What will you try next?',
                            reflection: 'I will start with one route.',
                        },
                    },
                    subtopic_competence: [],
                    topic,
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/topics/map-orientation/overview**',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    subtopics: [],
                    subtopics_pagination: {
                        ...pagination,
                        per_page: 4,
                        total: 0,
                    },
                    topic,
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/learner/topics/map-orientation/maps**',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    maps: [],
                    maps_pagination: { ...pagination, per_page: 4, total: 0 },
                    topic,
                }),
            });
        },
    );
    await page.route('**/api/v1/learner/paths**', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pagination,
                paths: [
                    {
                        activity_title: 'Consider a direction',
                        activity_type: 'question',
                        description: 'Consider a useful next step.',
                        image_url: null,
                        label: 'Choose your next step',
                        learning_areas: [],
                        learning_intent: 'retrieve',
                        map_href: '/world?map=first-path',
                        map_title: 'The First Path',
                        node_href:
                            '/world?map=first-path&focused=choose-a-direction',
                        node_slug: 'choose-a-direction',
                        node_title: 'Choose a direction',
                        progress: null,
                        route_description: 'A short route for orientation.',
                        start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                        time_guide_minutes: 15,
                        topic: {
                            href: '/topics/map-orientation',
                            slug: 'map-orientation',
                            title: 'Map orientation',
                        },
                    },
                ],
                selected_purpose: null,
                selected_time_budget: null,
                topic_context: topic,
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
        '**/api/v1/learner/activity-starts/**/start',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                }),
            });
        },
    );
}

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
        image_dark: 'https://example.test/dark-route.png',
        image_light: 'https://example.test/light-route.png',
        button_color_dark: '#112233',
        button_border_color_dark: '#223344',
        button_color_light: '#ddeeff',
        button_border_color_light: '#ccddee',
        learning_intent: 'participate',
        sort_order: sortOrder,
        time_guide_minutes: 15,
        desk: {
            current_activity_title: null,
            learning_areas: [
                { name: 'Orientation', slug: 'orientation' },
            ],
            learning_intent: 'participate',
            time_guide_minutes: 15,
            topic: {
                href: '/topics/map-orientation',
                slug: 'map-orientation',
                title: 'Map orientation',
            },
        },
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
                            background_config: {
                                dark: { pageBackground: '#0b1117' },
                                light: { pageBackground: '#f0fdfa' },
                            },
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
                    run_kind: 'route',
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
                        check_in: {
                            choice_prompt:
                                'Choose the kind of continuation that would support your next step.',
                            concepts: ['Learner choice'],
                            learning_areas: [
                                {
                                    name: 'Orientation',
                                    slug: 'orientation',
                                },
                            ],
                            objective: 'Keep useful choices visible.',
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
    await page.route(
        '**/api/v1/learner/play-runs/018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66/activities/private-activity/check-ins',
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            expect(route.request().postDataJSON()).toEqual({
                feeling: null,
                next_direction: 'related',
                note: 'I will compare the next options.',
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d80',
                    activity_slug: 'private-activity',
                    feeling: null,
                    note: 'I will compare the next options.',
                    next_direction: 'related',
                    recorded_at: '2026-11-05T10:00:00.000000Z',
                }),
            });
        },
    );

    await page.addInitScript(() => {
        window.localStorage.setItem(
            'theme-preference-unauthenticated',
            'light',
        );
    });
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
    await expect(page.locator('[data-wl-id="public-world"]')).toHaveCSS(
        'background-color',
        'rgb(240, 253, 250)',
    );
    await expect(
        page.locator('[data-wl-id="learner.world.route-starts"] img').first(),
    ).toHaveAttribute('src', 'https://example.test/light-route.png');
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
        page.getByRole('heading', {
            name: 'A small pause after Begin private orientation',
        }),
    ).toBeVisible();
    await expect(page.getByText('Learning focus')).toBeVisible();
    await page.getByRole('button', { name: 'Hide conclusion' }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Begin private orientation',
        }),
    ).not.toBeVisible();
    const showConclusionButton = page.getByRole('button', {
        name: 'Show conclusion',
    });
    await expect(showConclusionButton).toBeFocused();
    const showConclusionBounds = await showConclusionButton.boundingBox();
    expect(showConclusionBounds).not.toBeNull();
    expect(showConclusionBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
        (showConclusionBounds?.x ?? 0) +
            (showConclusionBounds?.width ?? 0),
    ).toBeLessThanOrEqual(390);
    expect(showConclusionBounds?.y).toBeGreaterThanOrEqual(0);
    expect(
        (showConclusionBounds?.y ?? 0) +
            (showConclusionBounds?.height ?? 0),
    ).toBeLessThanOrEqual(844);
    await showConclusionButton.click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Begin private orientation',
        }),
    ).toBeVisible();
    await page
        .getByLabel('Add a note (optional)')
        .fill('I will compare the next options.');
    const relatedDirection = page.getByRole('button', {
        name: 'Look for something related',
    });
    await expect
        .poll(async () => {
            const bounds = await relatedDirection.boundingBox();

            return (bounds?.x ?? 390) + (bounds?.width ?? 0);
        })
        .toBeLessThanOrEqual(390);
    await relatedDirection.click();
    await page.getByRole('button', { name: 'Save note and continue' }).click();
    await expect(
        page.getByRole('heading', { name: 'Choose the next step' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Choose the next step',
        }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();
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

test('the source Recall Queue opens an opaque private recall run', async ({
    page,
}) => {
    const recallItemId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d88';
    const recallRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d89';

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
    await page.route('**/api/v1/learner/recall-items', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                items: [
                    {
                        recall_item_id: recallItemId,
                        activity_slug: 'learner-choice',
                        activity_title: 'Keep choice visible',
                        map_title: 'A private path',
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        prompt: 'Which choice keeps exploration learner-directed?',
                        is_due: true,
                        last_confidence: null,
                        last_confidence_after_feedback: null,
                        last_outcome: null,
                        last_reviewed_at: null,
                        next_review_at: '2026-11-07T10:00:00.000Z',
                        review_count: 0,
                    },
                ],
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
                    description: '',
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
                                    text: null,
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
                items: [],
                tools: [],
                bookmarked_nodes: [],
                activity_progress: [],
                route_progress: [],
                available_routes: [],
                start_routes: [
                    {
                        start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                        map_slug: 'private-path',
                        node_slug: 'private-place',
                        route_slug: 'private-orientation-route',
                        activity_slug: 'private-activity',
                        label: 'Begin private orientation',
                        description: null,
                        image_dark: null,
                        image_light: null,
                        button_color_dark: null,
                        button_border_color_dark: null,
                        button_color_light: null,
                        button_border_color_light: null,
                        learning_intent: 'participate',
                        sort_order: 0,
                        time_guide_minutes: 15,
                        desk: {
                            current_activity_title: null,
                            learning_areas: [
                                { name: 'Orientation', slug: 'orientation' },
                            ],
                            learning_intent: 'participate',
                            time_guide_minutes: 15,
                            topic: {
                                href: '/topics/map-orientation',
                                slug: 'map-orientation',
                                title: 'Map orientation',
                            },
                        },
                        progress: {
                            current_activity_slug: 'private-activity',
                            status: 'completed',
                            completion_count: 1,
                            last_completed_at: '2026-11-04T00:00:00.000000Z',
                            last_entered_at: '2026-11-04T00:00:00.000000Z',
                        },
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
        `**/api/v1/learner/recall-items/${recallItemId}/open`,
        async (route) => {
            expect(route.request().headers()['x-csrf-token']).toBe(
                'test-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'learner-choice',
                    node_slug: 'private-place',
                    play_run_id: recallRunId,
                    status: 'in_progress',
                }),
            });
        },
    );

    await page.goto('/home');

    await page.getByRole('button', { name: 'Recall queue' }).click();
    await expect(
        page.getByRole('heading', { name: 'Recall queue' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Learning desk' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
        page.getByText('Which choice keeps exploration learner-directed?'),
    ).toBeVisible();
    await expect(page.getByText('Ready to recall')).toBeVisible();
    await page.getByRole('button', { name: 'Recent traces' }).click();
    await expect(
        page.getByRole('heading', { name: 'Recent traces' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Map orientation' }),
    ).toHaveAttribute('href', '/topics/map-orientation');
    await expect(page.getByText('Learning areas:')).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Orientation', exact: true }),
    ).toHaveAttribute('href', '/competence?topic=orientation&from=map-orientation');
    await page.getByRole('button', { name: 'Recall queue' }).click();
    await page.getByRole('button', { name: 'Open question' }).click();
    await expect(page).toHaveURL(
        `/learning/nodes/private-place/play?run=${recallRunId}`,
    );
});

test('the source Learning Desk search uses its authenticated result contract', async ({
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
    await page.route('**/api/v1/learner/recall-items', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
        });
    });
    await page.route('**/api/v1/learner/world', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                world: { maps: [] },
                items: [],
                tools: [],
                bookmarked_nodes: [],
                activity_progress: [],
                route_progress: [],
                available_routes: [],
                start_routes: [],
            }),
        });
    });
    await page.route('**/api/v1/learner/journal?*', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                check_ins: [],
                pages: [],
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 1,
                    total: 0,
                },
                revisit_invitations: [],
            }),
        });
    });
    await page.route('**/api/v1/learner/bookmarks', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                background_config: {},
                grid_config: {},
                places: [],
            }),
        });
    });
    await page.route('**/api/v1/learner/search?*', async (route) => {
        const requestUrl = new URL(route.request().url());

        expect(requestUrl.searchParams.get('query')).toBe('map');
        expect(requestUrl.searchParams.get('page')).toBe('1');
        expect(requestUrl.searchParams.get('per_page')).toBe('5');
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 5,
                    total: 1,
                },
                results: [
                    {
                        href: '/topics/map-orientation',
                        id: 'topic:018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66',
                        kind: 'topic',
                        map_slug: null,
                        node_slug: null,
                        subtitle: 'Topic',
                        title: 'Map orientation',
                    },
                ],
            }),
        });
    });

    await page.goto('/home');
    await page.getByLabel('Search learning content').fill('map');
    await expect(
        page.getByRole('button', { name: /Map orientation Topic/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Map orientation Topic/ }).click();
    await expect(page).toHaveURL(/\/topics\/map-orientation$/);
});

test('the source Learning Desk revisit section opens an opaque private revisit run', async ({
    page,
}) => {
    const checkInId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d70';
    const secondCheckInId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d71';
    const revisitRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77';

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
    await page.route('**/api/v1/learner/recall-items', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
        });
    });
    await page.route('**/api/v1/learner/journal?*', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                check_ins: [],
                pages: [],
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 1,
                    total: 0,
                },
                revisit_invitations: [
                    {
                        check_in_id: checkInId,
                        activity_slug: 'return-to-direction',
                        activity_title: 'Return to the first question',
                        available_after_days: 3,
                        available_at: '2026-11-03T09:00:00.000000Z',
                        available_since: '2026-10-31T09:00:00.000000Z',
                        revisit_reason: 'pause',
                        map_slug: 'first-path',
                        map_title: 'The First Path',
                        node_slug: 'private-place',
                        node_title: 'A private place',
                    },
                    {
                        check_in_id: secondCheckInId,
                        activity_slug: 'return-to-a-second-question',
                        activity_title: 'Return to a second question',
                        available_after_days: 3,
                        available_at: '2026-11-04T09:00:00.000000Z',
                        available_since: '2026-11-01T09:00:00.000000Z',
                        revisit_reason: 'later',
                        map_slug: 'first-path',
                        map_title: 'The First Path',
                        node_slug: 'private-place',
                        node_title: 'A private place',
                    },
                ],
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'revisit-csrf-token' }),
        });
    });
    await page.route(
        `**/api/v1/learner/revisit-invitations/${checkInId}`,
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(route.request().postDataJSON()).toEqual({ action: 'snooze' });
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'revisit-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    check_in_id: checkInId,
                    revisit_status: 'snoozed',
                    available_at: '2026-11-12T09:00:00.000000Z',
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/revisit-invitations/${secondCheckInId}/open`,
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'revisit-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_slug: 'return-to-a-second-question',
                    node_slug: 'private-place',
                    play_run_id: revisitRunId,
                    status: 'in_progress',
                }),
            });
        },
    );

    await page.goto('/home');

    await page
        .getByRole('button', { name: 'Return when useful' })
        .click();

    await expect(
        page.getByRole('heading', { name: 'Return when useful' }),
    ).toBeVisible();
    await expect(
        page.getByText('Return to the first question', { exact: true }),
    ).toBeVisible();
    await page
        .getByText('Return to the first question', { exact: true })
        .locator('xpath=../..')
        .getByRole('button', { name: 'Later' })
        .click();
    await expect(
        page.getByText('Return to the first question', { exact: true }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Open activity' }).click();
    await expect(page).toHaveURL(
        `/learning/nodes/private-place/play?run=${revisitRunId}`,
    );
});

test('the original question surface posts only selected option keys and waits for server feedback', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d77';
    let answerAttempt = 0;
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    play_run_id: playRunId,
                    run_kind: 'route',
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
                        question_feedback:
                            answerAttempt === 0
                                ? null
                                : {
                                      play_run_id: playRunId,
                                      activity_slug: 'learner-choice',
                                      selected_option_keys: ['choice'],
                                      is_correct: true,
                                      feedback:
                                          'This keeps the learner in charge.',
                                      explanation:
                                          'Maps support orientation and choice.',
                                      confidence: 'settled',
                                      calibration: 'aligned',
                                      attempt_number: 1,
                                      earlier_attempts: [],
                                      next_transition_label: null,
                                      status: 'in_progress',
                                  },
                        completion: { label: null, next_activity_slug: null },
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
                        review_context: [],
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
            answerAttempt += 1;
            expect(route.request().postDataJSON()).toEqual({
                confidence: answerAttempt === 1 ? 'settled' : 'leaning',
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
                    attempt_number: answerAttempt,
                    earlier_attempts:
                        answerAttempt === 1
                            ? []
                            : [
                                  {
                                      answered_at:
                                          '2026-11-06T10:00:00.000Z',
                                      calibration: 'aligned',
                                      confidence: 'settled',
                                      is_correct: true,
                                      option_label: 'A',
                                      option_labels: ['A'],
                                  },
                              ],
                    next_transition_label: null,
                    status: 'in_progress',
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/learner-choice/complete`,
        async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                confidence_after_feedback: 'settled',
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    status: 'completed',
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
    await page.reload();
    await expect(
        page.getByText('This keeps the learner in charge.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Try again independently' }).click();
    await expect(
        page.getByText('Which choice keeps exploration learner-directed?'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'I have a hunch' }).click();
    await page
        .getByRole('button', { name: /Keep useful choices visible/ })
        .click();
    await expect(page.getByText('This keeps the learner in charge.')).toBeVisible();
    await expect(page.getByText('Confidence reflection:')).toBeVisible();
    await expect(
        page.getByText('Your confidence matched this result.'),
    ).toBeVisible();
    await expect(page.getByText('Earlier tries (1)')).toBeVisible();
    await page
        .getByRole('group', {
            name: 'After comparing, how settled does this feel now?',
        })
        .getByRole('button', { name: 'Settled' })
        .click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Keep choice visible',
        }),
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
                    run_kind: 'route',
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
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
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
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/private-reflection/complete`,
        async (route) => {
            expect(route.request().postData()).toBeNull();
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
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
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Connect the direction',
        }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();
    await expect(page).toHaveURL(/\/world\?focused=private-place$/);
});

test('the original review reflection keeps earlier notes private and records only source-defined choices', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d89';
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    play_run_id: playRunId,
                    run_kind: 'route',
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Review route',
                    },
                    activity: {
                        slug: 'review-the-direction',
                        title: 'Review the direction',
                        description: 'A private learner review.',
                        activity_type: 'review',
                        config: {
                            prompt: 'What feels clearer about the direction now?',
                            learningIntent: 'review',
                            feedbackGuidance: {
                                purpose: 'Notice what changed without grading yourself.',
                                rubric: ['Connects the idea to a useful context.'],
                            },
                        },
                        completion: { label: null, next_activity_slug: null },
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
                        review_context: [
                            {
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d8a',
                                question: 'What did you notice before?',
                                reflection: 'The routes seemed separate at first.',
                                created_at: '2026-11-01T12:00:00.000Z',
                            },
                        ],
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/review-the-direction/reflection`,
        async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                reflection: 'The route choices now connect to the same purpose.',
                observed_cues: ['Connects the idea to a useful context.'],
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    activity_slug: 'review-the-direction',
                    status: 'completed',
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/review-the-direction/complete`,
        async (route) => {
            expect(route.request().postDataJSON()).toEqual({
                confidence: 'leaning',
                confidence_after_feedback: 'settled',
                outcome: 'connected',
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    status: 'completed',
                }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);

    await expect(page.getByText('Review / revisit')).toBeVisible();
    await expect(page.getByText('Earlier notes from you')).toBeVisible();
    await page
        .locator('summary')
        .filter({ hasText: 'What did you notice before?' })
        .click();
    await expect(
        page.getByText('The routes seemed separate at first.'),
    ).toBeVisible();
    await page
        .getByRole('textbox', { name: '' })
        .fill('The route choices now connect to the same purpose.');
    await page
        .getByRole('group', {
            name: 'After your response, how settled does this feel before comparing with the guidance? (optional)',
        })
        .getByRole('button', { name: 'I have a hunch' })
        .click();
    await page
        .getByRole('checkbox', {
            name: 'Connects the idea to a useful context.',
        })
        .check();
    await page
        .getByRole('group', { name: 'What changed for you? (optional)' })
        .getByRole('button', { name: 'More connected' })
        .click();
    await page.getByRole('button', { name: 'Save review note' }).click();

    await expect(page.getByText('Response saved privately')).toBeVisible();
    await page
        .getByRole('group', {
            name: 'After comparing, how settled does this feel now? (optional)',
        })
        .getByRole('button', { name: 'Settled' })
        .click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after Review the direction',
        }),
    ).toBeVisible();
});

test('the original tool-grant surface claims only its active configured tool before completing', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d99';
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                    play_run_id: playRunId,
                    run_kind: 'route',
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Tool route',
                    },
                    activity: {
                        slug: 'receive-magnifier',
                        title: 'A closer look',
                        description: 'A source-authored tool grant.',
                        activity_type: 'tool_grant',
                        config: {
                            alreadyOwned: false,
                            backgroundDark: null,
                            backgroundLight: null,
                            backgroundMirrored: false,
                            bubbleBorderColorDark: '#2dd4bf',
                            bubbleBorderColorLight: '#0891b2',
                            bubbleColorDark: '#0f172a',
                            bubbleColorLight: '#ffffff',
                            bubbleOpacityDark: 92,
                            bubbleOpacityLight: 94,
                            fadeDurationSeconds: 0,
                            slideDirection: 'left',
                            slideDurationSeconds: 0,
                            text: 'Use this magnifier to notice hidden details.',
                            toolId: 'magnifier',
                            toolMirrored: false,
                            toolX: 50,
                            toolY: 40,
                            typingSpeed: 1,
                            tool: {
                                animation_dark: null,
                                animation_light: null,
                                config: { imageWidthPercent: 18 },
                                description: 'A tool for closer inspection.',
                                image_dark: null,
                                image_light: null,
                                slug: 'magnifier',
                                title: 'Magnifier',
                            },
                        },
                        completion: { label: null, next_activity_slug: null },
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/receive-magnifier/grant-tool`,
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    already_owned: false,
                    tool: {
                        animation_dark: null,
                        animation_light: null,
                        config: { imageWidthPercent: 18 },
                        description: 'A tool for closer inspection.',
                        image_dark: null,
                        image_light: null,
                        slug: 'magnifier',
                        title: 'Magnifier',
                    },
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/receive-magnifier/complete`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    status: 'completed',
                }),
            });
        },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await expect(
        page.getByRole('heading', { name: 'A closer look' }),
    ).toBeVisible();
    await expect(page.getByText('Magnifier').first()).toBeVisible();
    const takeTool = page.getByRole('button', { name: 'Take tool' });
    await expect(takeTool).toBeVisible();
    const bounds = await takeTool.boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.x ?? 390) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    await takeTool.click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after A closer look',
        }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();
    await expect(page).toHaveURL(/\/world\?focused=private-place$/);
});

test('the original item-grant surface rolls only the active configured items before completing', async ({
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
                    run_kind: 'route',
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Item route',
                    },
                    activity: {
                        slug: 'receive-portal-key',
                        title: 'A useful key',
                        description: 'A source-authored item grant.',
                        activity_type: 'item_grant',
                        config: {
                            backgroundDark: null,
                            backgroundLight: null,
                            backgroundMirrored: false,
                            items: [{ itemId: 'portal-key', quantity: 2 }],
                            probabilityPercent: 100,
                        },
                        completion: { label: null, next_activity_slug: null },
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/receive-portal-key/grant-items`,
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    items: [
                        {
                            image_dark: null,
                            image_light: null,
                            quantity: 2,
                            slug: 'portal-key',
                            title: 'Portal key',
                        },
                    ],
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/receive-portal-key/complete`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    status: 'completed',
                }),
            });
        },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await expect(
        page.getByRole('heading', { name: 'A useful key' }),
    ).toBeVisible();
    await expect(page.getByText('Item received:')).toBeVisible();
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeVisible();
    const bounds = await continueButton.boundingBox();
    expect(bounds).not.toBeNull();
    expect((bounds?.x ?? 390) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    await continueButton.click();
    await expect(
        page.getByRole('heading', { name: 'A small pause after A useful key' }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();
    await expect(page).toHaveURL(/\/world\?focused=private-place$/);
});

test('the original item-obstacle surface accepts only its dragged inventory item before completing', async ({
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
                    run_kind: 'route',
                    context: {
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        map_slug: 'private-path',
                        map_title: 'A private path',
                        route_label: 'Obstacle route',
                    },
                    items: [
                        {
                            config: {},
                            description: 'The source-configured key.',
                            image_dark: null,
                            image_light: null,
                            quantity: 1,
                            slug: 'portal-key',
                            title: 'Portal key',
                        },
                    ],
                    activity: {
                        slug: 'unlock-the-gate',
                        title: 'A blocked gate',
                        description: 'A source-authored item obstacle.',
                        activity_type: 'item_obstacle',
                        config: {
                            backgroundDark: null,
                            backgroundLight: null,
                            backgroundMirrored: false,
                            configuredItems: [
                                {
                                    image_dark: null,
                                    image_light: null,
                                    slug: 'portal-key',
                                    title: 'Portal key',
                                },
                            ],
                            metBackgroundDark: null,
                            metBackgroundLight: null,
                            metBackgroundMirrored: false,
                            overlayDark: null,
                            overlayLight: null,
                            overlayMirrored: false,
                            overlayWidth: 30,
                            overlayX: 50,
                            overlayY: 50,
                            slots: [
                                {
                                    itemId: 'portal-key',
                                    slotIndex: 0,
                                    width: 18,
                                    x: 50,
                                    y: 45,
                                },
                            ],
                            state: {
                                can_continue: null,
                                conditions_met: false,
                                filled_slots: [],
                                locked_until: null,
                            },
                        },
                        completion: { label: null, next_activity_slug: null },
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/unlock-the-gate/item-obstacle-slots/0`,
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            expect(route.request().postDataJSON()).toEqual({
                item_slug: 'portal-key',
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    inventory: [],
                    state: {
                        can_continue: null,
                        conditions_met: true,
                        filled_slots: [
                            { item_slug: 'portal-key', slot_index: 0 },
                        ],
                        locked_until: null,
                    },
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/unlock-the-gate/item-obstacle/continue`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    inventory: [],
                    state: {
                        can_continue: true,
                        conditions_met: true,
                        filled_slots: [
                            { item_slug: 'portal-key', slot_index: 0 },
                        ],
                        locked_until: null,
                    },
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/unlock-the-gate/complete`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    status: 'completed',
                }),
            });
        },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await expect(
        page.getByRole('heading', { name: 'A blocked gate' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open inventory' }).click();
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await page.getByTitle('Portal key').dispatchEvent('dragstart', {
        dataTransfer,
    });
    await page
        .locator('[data-wl-id="learner.activity.item-obstacle.slot.0"]')
        .dispatchEvent('drop', { dataTransfer });
    await expect(
        page.getByRole('button', { name: 'Open inventory' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after A blocked gate',
        }),
    ).toBeVisible();
});

test('the original obstacle surface selects an owned tool and uses only the active obstacle contract', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d66';
    await page.route(`**/api/v1/learner/play-runs/${playRunId}`, async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                play_run_id: playRunId,
                run_kind: 'route',
                context: {
                    node_slug: 'private-place',
                    node_title: 'Private place',
                    map_slug: 'private-path',
                    map_title: 'A private path',
                    route_label: 'Obstacle route',
                },
                items: [],
                tools: [
                    {
                        animation_dark: null,
                        animation_light: null,
                        config: { animationDurationSeconds: 0 },
                        description: 'A source-owned tool.',
                        image_dark: null,
                        image_light: null,
                        slug: 'hammer',
                        title: 'Hammer',
                    },
                ],
                activity: {
                    slug: 'clear-the-gate',
                    title: 'A blocked gate',
                    description: 'A source-authored obstacle.',
                    activity_type: 'obstacle',
                    config: {
                        allowedToolIds: ['hammer'],
                        backgroundDark: null,
                        backgroundLight: null,
                        backgroundMirrored: false,
                        bubbleBorderColorDark: '#2dd4bf',
                        bubbleBorderColorLight: '#0891b2',
                        bubbleColorDark: '#0f172a',
                        bubbleColorLight: '#ffffff',
                        bubbleOpacityDark: 92,
                        bubbleOpacityLight: 94,
                        isResolved: false,
                        obstacleImageDark: null,
                        obstacleImageLight: null,
                        obstacleImageMirrored: false,
                        obstacleWidth: 28,
                        obstacleX: 50,
                        obstacleY: 50,
                        persistAfterSolved: true,
                        promptText: 'Choose the right tool.',
                        revisitBackgroundDark: null,
                        revisitBackgroundLight: null,
                        revisitBackgroundMirrored: false,
                        revisitImageDark: null,
                        revisitImageLight: null,
                        revisitImageMirrored: false,
                        revisitText: 'Already clear.',
                        successAnimation: 'none',
                        successText: 'The gate opens.',
                        typingSpeed: 1,
                    },
                    completion: { label: null, next_activity_slug: null },
                    check_in: {
                        choice_prompt: null,
                        concepts: [],
                        learning_areas: [],
                        objective: null,
                    },
                },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/clear-the-gate/use-obstacle-tool`,
        async (route) => {
            expect(route.request().method()).toBe('POST');
            expect(await route.request().headerValue('X-CSRF-Token')).toBe(
                'test-csrf-token',
            );
            expect(route.request().postDataJSON()).toEqual({
                tool_slug: 'hammer',
            });
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ is_resolved: true, is_useful: true }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/clear-the-gate/complete`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ play_run_id: playRunId, status: 'completed' }),
            });
        },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await page.getByRole('button', { name: 'Open tools' }).click();
    await page.getByRole('button', { name: 'Hammer' }).click();
    await page
        .locator('[data-wl-id="learner.activity.obstacle.scene"]')
        .getByRole('button', { name: 'Use an equipped tool on the gate' })
        .click();
    await expect(
        page.getByRole('heading', {
            name: 'A small pause after A blocked gate',
        }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Continue without answering' })
        .click();
    await expect(page).toHaveURL(/\/world\?focused=private-place$/);
});

test('the original Markdown activity follows its authored pages before server-owned completion', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d55';
    await page.route(`**/api/v1/learner/play-runs/${playRunId}`, async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                play_run_id: playRunId,
                run_kind: 'route',
                context: {
                    node_slug: 'private-place',
                    node_title: 'Private place',
                    map_slug: 'private-path',
                    map_title: 'A private path',
                    route_label: 'Reading route',
                },
                items: [],
                tools: [],
                activity: {
                    slug: 'read-the-map',
                    title: 'Read the map',
                    description: 'A source-authored reading activity.',
                    activity_type: 'markdown',
                    config: {
                        markdownPages: [
                            markdownPage(
                                'first',
                                'First',
                                '# First page\n\nRead this first.',
                            ),
                            markdownPage(
                                'second',
                                'Second',
                                '## Second page\n\nThen continue.',
                            ),
                        ],
                        markdownTransitions: [
                            { from: 'start', to: 'first' },
                            { from: 'first', to: 'second' },
                            { from: 'second', to: 'end' },
                        ],
                    },
                    completion: { label: null, next_activity_slug: null },
                    check_in: {
                        choice_prompt: null,
                        concepts: [],
                        learning_areas: [],
                        objective: null,
                    },
                },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/read-the-map/complete`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    play_run_id: playRunId,
                    status: 'completed',
                }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await expect(page.getByRole('heading', { name: 'First page' })).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'Second page' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'A small pause after Read the map' })).toBeVisible();
});

function markdownPage(id: string, title: string, body: string) {
    return {
        id,
        title,
        body,
        visual: {
            borderColorDark: '#2dd4bf',
            borderColorLight: '#0891b2',
            headingColorDark: '#67e8f9',
            headingColorLight: '#0e7490',
            pageColorDark: '#0f172a',
            pageColorLight: '#ffffff',
            textColorDark: '#f8fafc',
            textColorLight: '#0f172a',
        },
    };
}

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
    await expect(
        page.getByRole('heading', { name: 'The First Path', exact: true }),
    ).toBeVisible();
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
